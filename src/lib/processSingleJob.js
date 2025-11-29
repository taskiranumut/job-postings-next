import { supabase } from './supabase';
import { llmClient } from './llmClient';

// Timeout duration: 5 minutes (in ms)
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

// LLM Status enum values
export const LLM_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Waits for a specified duration
 * @param {number} ms - Milliseconds
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches job with retry (for race condition)
 * @param {string} jobId - Job UUID
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries
 */
async function fetchJobWithRetry(jobId, maxRetries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: job, error } = await supabase
      .from('job_postings')
      .select(
        'id, platform_name, url, raw_text, llm_processed, llm_status, llm_started_at'
      )
      .eq('id', jobId)
      .single();

    if (job) {
      return { job, error: null };
    }

    if (attempt < maxRetries) {
      console.log(
        `[ProcessSingleJob] Job not found, retry ${attempt}/${maxRetries} in ${delayMs}ms...`
      );
      await sleep(delayMs);
    } else {
      return { job: null, error };
    }
  }
  return { job: null, error: new Error('Max retries exceeded') };
}

/**
 * Processes a single job posting with LLM (concurrency protected)
 * Used for records coming from the extension
 * @param {string} jobId - UUID of the job to process
 * @returns {Promise<Object>} Process result
 */
export async function processSingleJob(jobId) {
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  const now = new Date().toISOString();

  console.log(`[ProcessSingleJob] Starting for job ID: ${jobId}`);

  try {
    // 1. Fetch the record (with retry - for race condition)
    const { job, error: fetchError } = await fetchJobWithRetry(jobId);

    if (fetchError || !job) {
      console.error(
        `[ProcessSingleJob] Job not found after retries: ${jobId}`,
        fetchError
      );
      return {
        success: false,
        job_id: jobId,
        error: 'Job not found',
      };
    }

    // Skip if already processed (llm_status check)
    if (job.llm_status === LLM_STATUS.COMPLETED || job.llm_processed) {
      console.log(`[ProcessSingleJob] Job already processed: ${jobId}`);
      return {
        success: true,
        job_id: jobId,
        status: 'already_processed',
      };
    }

    // 2. Check if being processed by another process (llm_status + timeout)
    const isBeingProcessed =
      job.llm_status === LLM_STATUS.PROCESSING &&
      job.llm_started_at &&
      new Date(job.llm_started_at).getTime() >
        Date.now() - PROCESSING_TIMEOUT_MS;

    if (isBeingProcessed) {
      console.log(
        `[ProcessSingleJob] Job ${jobId} already being processed by another process.`
      );
      return {
        success: true,
        job_id: jobId,
        status: 'already_processing',
      };
    }

    // 3. Atomic claim: set llm_status to 'processing' and update llm_started_at
    // Accept NULL values too (for old records)
    const { error: claimError } = await supabase
      .from('job_postings')
      .update({
        llm_status: LLM_STATUS.PROCESSING,
        llm_started_at: now,
      })
      .eq('id', jobId)
      .or(
        `llm_status.eq.${LLM_STATUS.PENDING},llm_status.eq.${LLM_STATUS.FAILED},llm_status.is.null`
      );

    if (claimError) {
      console.error(
        `[ProcessSingleJob] Claim failed for job ${jobId}:`,
        claimError
      );
      throw new Error('Failed to claim job');
    }

    // 4. LLM Call (with duration measurement)
    const startTime = Date.now();
    const extraction = await llmClient.parseJobPosting({
      platform_name: job.platform_name,
      url: job.url,
      raw_text: job.raw_text,
    });
    const durationMs = Date.now() - startTime;

    console.log(`[ProcessSingleJob] LLM completed in ${durationMs}ms`);
    console.log(
      `[ProcessSingleJob] Job: ${extraction.job_title} @ ${extraction.company_name}`
    );

    // 5. DB Update (success) - llm_status = 'completed'
    const { error: updateError } = await supabase
      .from('job_postings')
      .update({
        ...extraction,
        llm_processed: true,
        llm_status: LLM_STATUS.COMPLETED,
        llm_started_at: null,
        llm_model_version: modelName,
        llm_notes: `Auto-processed from extension at ${new Date().toISOString()}`,
      })
      .eq('id', job.id);

    if (updateError) {
      throw updateError;
    }

    // 6. Log record
    await supabase.from('llm_logs').insert({
      job_posting_id: job.id,
      level: 'info',
      message: 'Processed successfully',
      job_title: extraction.job_title || null,
      company_name: extraction.company_name || null,
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

    // Error log
    await supabase.from('llm_logs').insert({
      job_posting_id: jobId,
      level: 'error',
      message: err.message || 'Processing failed',
      details: { error: err.message || String(err), trigger: 'extension' },
    });

    // Set llm_status to 'failed' and release lock
    await supabase
      .from('job_postings')
      .update({
        llm_status: LLM_STATUS.FAILED,
        llm_started_at: null,
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
 * Checks auto processing setting
 * @returns {Promise<boolean>} Is auto processing enabled?
 */
export async function isAutoProcessingEnabled() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('auto_llm_processing')
      .single();

    if (error) {
      console.error('[AutoProcessing] Failed to fetch settings:', error);
      return false;
    }

    return data?.auto_llm_processing ?? false;
  } catch (err) {
    console.error('[AutoProcessing] Unexpected error:', err);
    return false;
  }
}

/**
 * Fire-and-forget wrapper - Starts without awaiting Promise
 * Works according to auto processing setting
 * @param {string} jobId - UUID of the job to process
 * @param {number} initialDelayMs - Initial delay (for INSERT completion)
 */
export function triggerProcessSingleJob(jobId, initialDelayMs = 300) {
  sleep(initialDelayMs)
    .then(() => isAutoProcessingEnabled())
    .then((enabled) => {
      if (!enabled) {
        console.log(
          `[TriggerProcess] Auto-processing disabled, skipping job: ${jobId}`
        );
        return { success: true, status: 'skipped_auto_disabled' };
      }
      return processSingleJob(jobId);
    })
    .then((result) => {
      if (result.success) {
        console.log(`[TriggerProcess] Job ${jobId} result: ${result.status}`);
      } else {
        console.error(`[TriggerProcess] Job ${jobId} failed: ${result.error}`);
      }
    })
    .catch((err) => {
      console.error(`[TriggerProcess] Unexpected error for job ${jobId}:`, err);
    });
}
