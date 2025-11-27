'use server';

import { supabase } from './supabase';
import { revalidatePath } from 'next/cache';
import { processPendingJobs } from './processPendingJobs';

// ==================== JOB POSTINGS ====================

export async function getJobPostings() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('is_deleted', false)
    .order('scraped_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getJobPosting(id) {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createJobPosting(formData) {
  const { error } = await supabase.from('job_postings').insert({
    platform_name: formData.platform_name,
    raw_text: formData.raw_text,
    url: formData.url,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return { success: true };
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
    .eq('id', id)
    .eq('is_deleted', false);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath(`/edit/${id}`);
  revalidatePath(`/view/${id}`);
  return { success: true };
}

export async function deleteJobPosting(id) {
  const { error } = await supabase
    .from('job_postings')
    .update({ is_deleted: true })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return { success: true };
}

// ==================== LLM DASHBOARD ====================

export async function getLLMStatus() {
  const [
    { count: totalPostings },
    { count: totalProcessed },
    { count: totalPending },
    { data: lastRun },
  ] = await Promise.all([
    supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false),
    supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('llm_processed', true)
      .eq('is_deleted', false),
    supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('llm_processed', false)
      .eq('is_deleted', false),
    supabase
      .from('llm_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    total_postings: totalPostings,
    total_processed: totalProcessed,
    total_pending: totalPending,
    last_run: lastRun,
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
      llm_notes: null,
    })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .eq('is_deleted', false)
    .select('id');

  if (error) throw new Error(error.message);

  revalidatePath('/llm-dashboard');
  revalidatePath('/');
  return { count: data?.length || 0 };
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
