import { supabase } from './supabase';
import { llmClient } from './llmClient';

// Timeout süresi: 5 dakika (ms cinsinden)
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Belirli süre bekler
 * @param {number} ms - Milisaniye
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry ile job'ı çeker (race condition için)
 * @param {string} jobId - Job UUID
 * @param {number} maxRetries - Maksimum deneme sayısı
 * @param {number} delayMs - Denemeler arası bekleme süresi
 */
async function fetchJobWithRetry(jobId, maxRetries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: job, error } = await supabase
      .from('job_postings')
      .select('id, platform_name, url, raw_text, llm_processed, llm_started_at')
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
 * Tek bir iş ilanını LLM ile işler (çakışma korumalı)
 * Extension'dan gelen kayıtlar için kullanılır
 * @param {string} jobId - İşlenecek ilanın UUID'si
 * @returns {Promise<Object>} İşlem sonucu
 */
export async function processSingleJob(jobId) {
  const modelName = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';
  const now = new Date().toISOString();
  const timeoutThreshold = new Date(
    Date.now() - PROCESSING_TIMEOUT_MS
  ).toISOString();

  console.log(`[ProcessSingleJob] Starting for job ID: ${jobId}`);

  try {
    // 1. İlgili kaydı çek (retry ile - race condition için)
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

    // Zaten işlenmişse atla
    if (job.llm_processed) {
      console.log(`[ProcessSingleJob] Job already processed: ${jobId}`);
      return {
        success: true,
        job_id: jobId,
        status: 'already_processed',
      };
    }

    // 2. Başka işlem tarafından işleniyor mu kontrol et
    const isBeingProcessed =
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

    // 3. Atomik claim: llm_started_at'ı güncelle
    const { error: claimError } = await supabase
      .from('job_postings')
      .update({ llm_started_at: now })
      .eq('id', jobId)
      .eq('llm_processed', false);

    if (claimError) {
      console.error(
        `[ProcessSingleJob] Claim failed for job ${jobId}:`,
        claimError
      );
      throw new Error('Failed to claim job');
    }

    // 3. LLM Çağrısı (süre ölçümü ile)
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

    // 4. DB Update (başarılı)
    const { error: updateError } = await supabase
      .from('job_postings')
      .update({
        ...extraction,
        llm_processed: true,
        llm_started_at: null, // Kilidi kaldır
        llm_model_version: modelName,
        llm_notes: `Auto-processed from extension at ${new Date().toISOString()}`,
      })
      .eq('id', job.id);

    if (updateError) {
      throw updateError;
    }

    // 5. Log kaydı
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

    // Hata logu
    await supabase.from('llm_logs').insert({
      job_posting_id: jobId,
      level: 'error',
      message: err.message || 'Processing failed',
      details: { error: err.message || String(err), trigger: 'extension' },
    });

    // Kilidi kaldır ve hata notu düş
    await supabase
      .from('job_postings')
      .update({
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
 * Otomatik işleme ayarını kontrol eder
 * @returns {Promise<boolean>} Otomatik işleme açık mı?
 */
async function isAutoProcessingEnabled() {
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
 * Fire-and-forget wrapper - Promise'i await etmeden başlatır
 * Otomatik işleme ayarına göre çalışır
 * @param {string} jobId - İşlenecek ilanın UUID'si
 * @param {number} initialDelayMs - İlk bekleme süresi (INSERT'in tamamlanması için)
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
