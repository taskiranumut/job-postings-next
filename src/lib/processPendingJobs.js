import { supabase } from './supabase';
import { llmClient } from './llmClient';
import { LLM_STATUS } from './processSingleJob';

// Timeout duration: 5 minutes (in ms)
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Process pending job postings (concurrency protected)
 * @param {number} limit - Maximum number of jobs to process
 * @returns {Promise<Object>} Process result
 */
export async function processPendingJobs(limit = 5) {
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  const now = new Date().toISOString();

  console.log(`[BatchProcess] Starting. Limit: ${limit}`);

  let successCount = 0;
  let errorCount = 0;
  const processedJobs = [];

  try {
    // 1. Fetch pending jobs (pending/failed status or timed out)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, platform_name, url, raw_text, llm_status, llm_started_at')
      .in('llm_status', [
        LLM_STATUS.PENDING,
        LLM_STATUS.FAILED,
        LLM_STATUS.PROCESSING,
      ])
      .order('scraped_at', { ascending: true })
      .limit(limit * 2); // Fetch extra, some might be skipped

    if (fetchError) {
      throw new Error(`Fetch failed: ${fetchError.message}`);
    }

    // Filter processable ones (pending/failed or processing but timed out)
    const timeoutMs = Date.now() - PROCESSING_TIMEOUT_MS;
    const availableJobs = (pendingJobs || [])
      .filter((job) => {
        // Pending or Failed ones are always processable
        if (
          job.llm_status === LLM_STATUS.PENDING ||
          job.llm_status === LLM_STATUS.FAILED
        ) {
          return true;
        }
        // Processing ones are processable only if timed out
        if (job.llm_status === LLM_STATUS.PROCESSING) {
          if (!job.llm_started_at) return true;
          return new Date(job.llm_started_at).getTime() < timeoutMs;
        }
        return false;
      })
      .slice(0, limit);

    if (availableJobs.length === 0) {
      console.log('[BatchProcess] No pending jobs found.');
      return {
        status: 'skipped',
        total_selected: 0,
        total_success: 0,
        total_error: 0,
        message: 'No pending jobs found',
      };
    }

    console.log(`[BatchProcess] Found ${availableJobs.length} pending jobs.`);

    // 2. Process each job
    for (const job of availableJobs) {
      try {
        // 2a. Claim: set llm_status to 'processing' and update llm_started_at
        const { error: claimError } = await supabase
          .from('job_postings')
          .update({
            llm_status: LLM_STATUS.PROCESSING,
            llm_started_at: now,
          })
          .eq('id', job.id)
          .in('llm_status', [
            LLM_STATUS.PENDING,
            LLM_STATUS.FAILED,
            LLM_STATUS.PROCESSING,
          ]);

        if (claimError) {
          console.log(`[BatchProcess] Job ${job.id} claim failed, skipping.`);
          continue;
        }

        // 2b. LLM Call (with duration measurement)
        const startTime = Date.now();
        const extraction = await llmClient.parseJobPosting({
          platform_name: job.platform_name,
          url: job.url,
          raw_text: job.raw_text,
        });
        const durationMs = Date.now() - startTime;

        console.log(
          `[BatchProcess] Processed: ${extraction.job_title} @ ${extraction.company_name} (${durationMs}ms)`
        );

        // 2c. DB Update (success) - llm_status = 'completed'
        const { error: updateError } = await supabase
          .from('job_postings')
          .update({
            ...extraction,
            llm_processed: true,
            llm_status: LLM_STATUS.COMPLETED,
            llm_started_at: null,
            llm_model_version: modelName,
            llm_notes: `Processed successfully at ${new Date().toISOString()}`,
          })
          .eq('id', job.id);

        if (updateError) throw updateError;

        // 2d. Log record
        await supabase.from('llm_logs').insert({
          job_posting_id: job.id,
          level: 'info',
          message: 'Processed successfully',
          job_title: extraction.job_title || null,
          company_name: extraction.company_name || null,
          duration_ms: durationMs,
        });

        successCount++;
        processedJobs.push({
          id: job.id,
          job_title: extraction.job_title,
          company_name: extraction.company_name,
        });
      } catch (err) {
        console.error(`[BatchProcess] Error processing job ${job.id}:`, err);
        errorCount++;

        // Error log
        await supabase.from('llm_logs').insert({
          job_posting_id: job.id,
          level: 'error',
          message: err.message || 'Processing failed',
          details: { error: err.message || String(err) },
        });

        // Set llm_status to 'failed' and release lock
        await supabase
          .from('job_postings')
          .update({
            llm_status: LLM_STATUS.FAILED,
            llm_started_at: null,
            llm_notes: `Processing failed: ${err.message}`,
          })
          .eq('id', job.id);
      }
    }

    const finalStatus =
      errorCount === 0 && successCount > 0
        ? 'success'
        : successCount === 0 && errorCount > 0
        ? 'error'
        : successCount > 0 && errorCount > 0
        ? 'partial'
        : 'success';

    console.log(
      `[BatchProcess] Completed. Success: ${successCount}, Errors: ${errorCount}`
    );

    return {
      status: finalStatus,
      total_selected: availableJobs.length,
      total_success: successCount,
      total_error: errorCount,
      processed: processedJobs,
    };
  } catch (globalError) {
    console.error('[BatchProcess] Global error:', globalError);
    throw globalError;
  }
}
