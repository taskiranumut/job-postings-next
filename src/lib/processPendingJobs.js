import { supabase } from './supabase';
import { llmClient } from './llmClient';

/**
 * Bekleyen iş ilanlarını işler
 * @param {number} limit - İşlenecek maksimum ilan sayısı
 * @returns {Promise<Object>} İşlem sonucu
 */
export async function processPendingJobs(limit = 5) {
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  console.log(`Starting batch process. Limit: ${limit}`);

  // 0. Önce işlenecek ilan var mı kontrol et
  const { count } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('llm_processed', false)
    .eq('is_deleted', false);

  if (count === 0 || count === null) {
    console.log('No pending jobs found. Skipping run creation.');
    return {
      run_id: null,
      status: 'skipped',
      total_selected: 0,
      total_success: 0,
      total_error: 0,
      message: 'No pending jobs found',
    };
  }

  // 1. Yeni bir Run kaydı oluştur
  const { data: runData, error: runError } = await supabase
    .from('llm_runs')
    .insert({
      status: 'running',
      total_selected: 0,
    })
    .select()
    .single();

  if (runError || !runData) {
    console.error(
      'Failed to create execution run record:',
      JSON.stringify(runError, null, 2)
    );
    return { error: 'Failed to initialize run', details: runError };
  }

  const runId = runData.id;
  let successCount = 0;
  let errorCount = 0;

  try {
    // 2. İşlenmemiş ilanları çek
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, platform_name, url, raw_text')
      .eq('llm_processed', false)
      .eq('is_deleted', false)
      .order('scraped_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Fetch failed: ${fetchError.message}`);
    }

    const jobsToProcess = pendingJobs || [];
    console.log(`Found ${jobsToProcess.length} pending jobs.`);

    // Run kaydını güncelle (seçilen sayı)
    await supabase
      .from('llm_runs')
      .update({ total_selected: jobsToProcess.length })
      .eq('id', runId);

    // 3. Her ilanı işle
    let counter = 0;
    for (const job of jobsToProcess) {
      counter++;
      try {
        // Log: Processing started
        await supabase.from('llm_logs').insert({
          run_id: runId,
          job_posting_id: job.id,
          level: 'info',
          message: 'Processing job posting',
          details: { url: job.url },
        });

        // LLM Çağrısı
        const extraction = await llmClient.parseJobPosting({
          platform_name: job.platform_name,
          url: job.url,
          raw_text: job.raw_text,
        });

        // DB Update (Extraction sonucu + metadata)
        console.log('---------------------------------------------------');
        console.log(`PROCESSING - Job ID: ${job.id}`);
        console.log(
          'LLM Extraction Result:',
          JSON.stringify(extraction, null, 2)
        );
        console.log(`Counter: ${counter} / ${jobsToProcess.length}`);
        console.log('---------------------------------------------------');

        const { error: updateError } = await supabase
          .from('job_postings')
          .update({
            ...extraction,
            llm_processed: true,
            llm_model_version: modelName,
            llm_notes: `Processed successfully at ${new Date().toISOString()}`,
          })
          .eq('id', job.id);

        if (updateError) throw updateError;

        // Log: Success
        await supabase.from('llm_logs').insert({
          run_id: runId,
          job_posting_id: job.id,
          level: 'info',
          message: 'Processed successfully',
        });

        successCount++;
      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err);
        errorCount++;

        // Log: Error
        await supabase.from('llm_logs').insert({
          run_id: runId,
          job_posting_id: job.id,
          level: 'error',
          message: 'Processing failed',
          details: { error: err.message || String(err) },
        });

        // Job kaydına not düş (llm_processed false kalsın ki tekrar denenebilsin)
        await supabase
          .from('job_postings')
          .update({
            llm_notes: `Parsing failed: ${err.message}`,
          })
          .eq('id', job.id);
      }
    }

    // 4. Run tamamlandı, durumu güncelle
    const finalStatus =
      errorCount === 0 && successCount > 0
        ? 'success'
        : successCount === 0 && errorCount > 0
        ? 'error'
        : successCount > 0 && errorCount > 0
        ? 'partial'
        : 'success';

    await supabase
      .from('llm_runs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        total_success: successCount,
        total_error: errorCount,
      })
      .eq('id', runId);

    return {
      run_id: runId,
      status: finalStatus,
      total_selected: jobsToProcess.length,
      total_success: successCount,
      total_error: errorCount,
    };
  } catch (globalError) {
    // Global bir hata olursa Run'ı error olarak kapat
    console.error('Global processing error:', globalError);
    await supabase
      .from('llm_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        notes: `Global crash: ${globalError.message}`,
      })
      .eq('id', runId);

    throw globalError;
  }
}
