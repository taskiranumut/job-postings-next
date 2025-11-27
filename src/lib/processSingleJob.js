import { supabase } from './supabase';
import { llmClient } from './llmClient';

/**
 * Tek bir iş ilanını LLM ile işler (asenkron, izole)
 * Extension'dan gelen kayıtlar için kullanılır
 * @param {string} jobId - İşlenecek ilanın UUID'si
 * @returns {Promise<Object>} İşlem sonucu
 */
export async function processSingleJob(jobId) {
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  console.log(`[ProcessSingleJob] Starting for job ID: ${jobId}`);

  try {
    // 1. İlgili kaydı çek
    const { data: job, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, platform_name, url, raw_text, llm_processed')
      .eq('id', jobId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !job) {
      console.error(`[ProcessSingleJob] Job not found: ${jobId}`, fetchError);
      return {
        success: false,
        job_id: jobId,
        error: 'Job not found',
      };
    }

    // Zaten işlenmişse atla
    if (job.llm_processed) {
      console.log(`[ProcessSingleJob] Job already processed: ${jobId}`);
      return {
        success: true,
        job_id: jobId,
        status: 'already_processed',
      };
    }

    // 2. Log: Processing started
    await supabase.from('llm_logs').insert({
      job_posting_id: job.id,
      level: 'info',
      message: 'Auto-processing started (from extension)',
      details: { url: job.url, trigger: 'extension' },
    });

    // 3. LLM Çağrısı
    const startTime = Date.now();
    const extraction = await llmClient.parseJobPosting({
      platform_name: job.platform_name,
      url: job.url,
      raw_text: job.raw_text,
    });
    const durationMs = Date.now() - startTime;

    console.log(`[ProcessSingleJob] LLM completed for ${jobId} in ${durationMs}ms`);

    // 4. DB Update
    const { error: updateError } = await supabase
      .from('job_postings')
      .update({
        ...extraction,
        llm_processed: true,
        llm_model_version: modelName,
        llm_notes: `Auto-processed from extension at ${new Date().toISOString()}`,
      })
      .eq('id', job.id);

    if (updateError) {
      throw updateError;
    }

    // 5. Log: Success
    await supabase.from('llm_logs').insert({
      job_posting_id: job.id,
      level: 'info',
      message: 'Auto-processed successfully (from extension)',
      duration_ms: durationMs,
      details: { trigger: 'extension' },
    });

    console.log(`[ProcessSingleJob] Successfully processed job: ${jobId}`);

    return {
      success: true,
      job_id: jobId,
      status: 'processed',
      duration_ms: durationMs,
    };
  } catch (err) {
    console.error(`[ProcessSingleJob] Error processing job ${jobId}:`, err);

    // Log: Error
    await supabase.from('llm_logs').insert({
      job_posting_id: jobId,
      level: 'error',
      message: 'Auto-processing failed (from extension)',
      details: { error: err.message || String(err), trigger: 'extension' },
    });

    // Job kaydına not düş (llm_processed false kalsın ki tekrar denenebilsin)
    await supabase
      .from('job_postings')
      .update({
        llm_notes: `Auto-parse failed: ${err.message}`,
      })
      .eq('id', jobId);

    return {
      success: false,
      job_id: jobId,
      error: err.message || String(err),
    };
  }
}

/**
 * Fire-and-forget wrapper - Promise'i await etmeden başlatır
 * Hata durumunda sadece loglama yapar, throw etmez
 * @param {string} jobId - İşlenecek ilanın UUID'si
 */
export function triggerProcessSingleJob(jobId) {
  // Promise'i await etmeden başlat (fire-and-forget)
  processSingleJob(jobId)
    .then((result) => {
      if (result.success) {
        console.log(`[TriggerProcess] Job ${jobId} processed: ${result.status}`);
      } else {
        console.error(`[TriggerProcess] Job ${jobId} failed: ${result.error}`);
      }
    })
    .catch((err) => {
      // Bu noktaya normalde ulaşılmamalı çünkü processSingleJob hataları yakalıyor
      console.error(`[TriggerProcess] Unexpected error for job ${jobId}:`, err);
    });
}

