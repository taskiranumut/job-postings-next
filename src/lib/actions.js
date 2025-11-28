'use server';

import { supabase } from './supabase';
import { revalidatePath } from 'next/cache';
import { processPendingJobs } from './processPendingJobs';
import { triggerProcessSingleJob, LLM_STATUS } from './processSingleJob';

// ==================== JOB POSTINGS ====================

export async function getJobPostings() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .order('scraped_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getJobPosting(id) {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createJobPosting(formData) {
  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      platform_name: formData.platform_name,
      raw_text: formData.raw_text,
      url: formData.url,
      llm_status: 'pending', // Otomatik işleme için gerekli
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // Asenkron olarak LLM işlemesini başlat (otomatik mod açıksa çalışır)
  if (data?.id) {
    triggerProcessSingleJob(data.id);
  }

  revalidatePath('/');
  return { success: true, id: data?.id };
}

export async function updateJobPosting(id, formData) {
  const updateData = {
    platform_name: formData.platform_name,
    raw_text: formData.raw_text,
    url: formData.url,
  };

  // llm_processed alanı varsa ekle
  if (typeof formData.llm_processed === 'boolean') {
    updateData.llm_processed = formData.llm_processed;
  }

  const { error } = await supabase
    .from('job_postings')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath(`/edit/${id}`);
  revalidatePath(`/view/${id}`);
  return { success: true };
}

export async function deleteJobPosting(id) {
  // 1. Önce silinecek kaydı al
  const { data: jobToDelete, error: fetchError } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !jobToDelete) {
    throw new Error(fetchError?.message || 'Job posting not found');
  }

  // 2. Kaydı deleted_job_postings tablosuna taşı
  const { error: insertError } = await supabase
    .from('deleted_job_postings')
    .insert({
      ...jobToDelete,
      deleted_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`Failed to archive job posting: ${insertError.message}`);
  }

  // 3. Orijinal tablodan sil
  const { error: deleteError } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', id);

  if (deleteError) {
    // Rollback: deleted_job_postings'den de sil
    await supabase.from('deleted_job_postings').delete().eq('id', id);
    throw new Error(`Failed to delete job posting: ${deleteError.message}`);
  }

  revalidatePath('/');
  return { success: true };
}

// ==================== LLM DASHBOARD ====================

export async function getLLMStatus() {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const weekStart = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { count: totalPostings },
    { count: totalProcessed },
    { count: totalPending },
    { data: todayLogs },
    { data: weekLogs },
    { data: allTimeLogs },
  ] = await Promise.all([
    supabase.from('job_postings').select('*', { count: 'exact', head: true }),
    supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('llm_status', LLM_STATUS.COMPLETED),
    supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .in('llm_status', [
        LLM_STATUS.PENDING,
        LLM_STATUS.PROCESSING,
        LLM_STATUS.FAILED,
      ]),
    // Bugünkü işlemler
    supabase
      .from('llm_logs')
      .select('duration_ms, level')
      .gte('created_at', todayStart),
    // Bu haftaki işlemler
    supabase
      .from('llm_logs')
      .select('duration_ms, level')
      .gte('created_at', weekStart),
    // Tüm zamanlar
    supabase.from('llm_logs').select('duration_ms, level'),
  ]);

  // Aggregate hesaplamaları
  const calcStats = (logs) => {
    if (!logs || logs.length === 0)
      return { count: 0, avgDuration: 0, errorCount: 0 };
    const successLogs = logs.filter((l) => l.level === 'info' && l.duration_ms);
    const avgDuration =
      successLogs.length > 0
        ? successLogs.reduce((sum, l) => sum + l.duration_ms, 0) /
          successLogs.length
        : 0;
    const errorCount = logs.filter((l) => l.level === 'error').length;
    return {
      count: logs.length,
      avgDuration: Math.round(avgDuration),
      errorCount,
    };
  };

  return {
    total_postings: totalPostings,
    total_processed: totalProcessed,
    total_pending: totalPending,
    stats: {
      today: calcStats(todayLogs),
      week: calcStats(weekLogs),
      allTime: calcStats(allTimeLogs),
    },
  };
}

export async function getLLMLogs(limit = 20) {
  const { data, error } = await supabase
    .from('llm_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function processLLMOnce(limit = 5) {
  try {
    const result = await processPendingJobs(limit);

    revalidatePath('/llm-dashboard');
    revalidatePath('/');

    return result;
  } catch (error) {
    throw new Error(error.message || 'Process failed');
  }
}

export async function resetLLMProcessing() {
  const { data, error } = await supabase
    .from('job_postings')
    .update({
      llm_processed: false,
      llm_status: LLM_STATUS.PENDING,
      llm_started_at: null,
      llm_notes: null,
    })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');

  if (error) throw new Error(error.message);

  revalidatePath('/llm-dashboard');
  revalidatePath('/');
  return { count: data?.length || 0 };
}

/**
 * Aktif işleme durumunu döndürür (polling için)
 * @returns {Promise<Object>} İşleme durumu
 */
export async function getProcessingStatus() {
  // Şu an işlenen ilanları getir
  const { data: processingJobs, error: processingError } = await supabase
    .from('job_postings')
    .select('id, job_title, company_name, platform_name, llm_started_at')
    .eq('llm_status', LLM_STATUS.PROCESSING)
    .order('llm_started_at', { ascending: true });

  if (processingError) {
    console.error('Processing jobs fetch error:', processingError);
  }

  // Bekleyen ilanların sayısını getir
  const { count: pendingCount, error: pendingError } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('llm_status', LLM_STATUS.PENDING);

  if (pendingError) {
    console.error('Pending count fetch error:', pendingError);
  }

  // Failed ilanların sayısını getir
  const { count: failedCount, error: failedError } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('llm_status', LLM_STATUS.FAILED);

  if (failedError) {
    console.error('Failed count fetch error:', failedError);
  }

  // Tüm non-completed ilanların status bilgisini döndür (postings güncellemesi için)
  const { data: statusUpdates, error: statusError } = await supabase
    .from('job_postings')
    .select('id, llm_status, llm_processed')
    .neq('llm_status', LLM_STATUS.COMPLETED);

  if (statusError) {
    console.error('Status updates fetch error:', statusError);
  }

  return {
    processing: processingJobs || [],
    pending_count: pendingCount || 0,
    failed_count: failedCount || 0,
    is_processing: (processingJobs?.length || 0) > 0,
    status_updates: statusUpdates || [],
  };
}

// ==================== APP SETTINGS ====================

export async function getAppSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .single();

  if (error) {
    console.error('Failed to fetch app settings:', error);
    // Varsayılan değer döndür
    return { auto_llm_processing: false };
  }

  return data;
}

export async function updateAutoLLMProcessing(enabled) {
  // Önce mevcut ayar kaydının id'sini al (singleton tablo)
  const { data: existing, error: fetchError } = await supabase
    .from('app_settings')
    .select('id')
    .single();

  if (fetchError || !existing) {
    throw new Error('Settings record not found');
  }

  // Şimdi güncelle
  const { data, error } = await supabase
    .from('app_settings')
    .update({ auto_llm_processing: enabled })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/llm-dashboard');
  return data;
}
