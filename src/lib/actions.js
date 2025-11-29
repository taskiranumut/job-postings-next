'use server';

import { supabase } from './supabase';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { processPendingJobs } from './processPendingJobs';
import { LLM_STATUS } from './processSingleJob';

// ==================== JOB POSTINGS ====================

export async function getJobPostings() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .order('scraped_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Fetch job postings with pagination and filtering support
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (starts from 1)
 * @param {number} options.pageSize - Records per page (20, 50, 100)
 * @param {string[]} options.platforms - Platform filters
 * @param {string[]} options.llmStatuses - LLM status filters
 * @param {string} options.jobTitle - Job title search
 * @param {string} options.company - Company search
 */
export async function getJobPostingsPaginated({
  page = 1,
  pageSize = 20,
  platforms = [],
  llmStatuses = [],
  jobTitle = '',
  company = '',
} = {}) {
  // Page size validation
  const validPageSizes = [20, 50, 100];
  const validatedPageSize = validPageSizes.includes(pageSize) ? pageSize : 20;

  // Calculate offset
  const offset = (page - 1) * validatedPageSize;

  // Base query builder
  let query = supabase.from('job_postings').select('*', { count: 'exact' });

  // Apply filters
  if (platforms.length > 0) {
    query = query.in('platform_name', platforms);
  }

  if (llmStatuses.length > 0) {
    query = query.in('llm_status', llmStatuses);
  }

  if (jobTitle.trim()) {
    query = query.ilike('job_title', `%${jobTitle.trim()}%`);
  }

  if (company.trim()) {
    query = query.ilike('company_name', `%${company.trim()}%`);
  }

  // Sorting and pagination
  query = query
    .order('scraped_at', { ascending: false })
    .range(offset, offset + validatedPageSize - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  // Calculate total pages
  const totalPages = Math.ceil((count || 0) / validatedPageSize);

  return {
    data: data || [],
    pagination: {
      page,
      pageSize: validatedPageSize,
      totalCount: count || 0,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Get unique platforms (for filter dropdown)
 */
export async function getUniquePlatforms() {
  const { data, error } = await supabase
    .from('job_postings')
    .select('platform_name')
    .not('platform_name', 'is', null);

  if (error) throw new Error(error.message);

  return [...new Set(data?.map((p) => p.platform_name) || [])].sort();
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
      llm_status: 'pending', // Required for auto processing
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // Asynchronously start LLM processing (runs if auto mode is enabled)
  // Using Internal API endpoint to provide waitUntil support in Vercel
  if (data?.id) {
    try {
      // Get host info
      const headersList = await headers();
      const host = headersList.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      // Fire-and-forget: we don't await, just start the request
      fetch(`${baseUrl}/api/process-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: data.id }),
      }).catch((err) => {
        console.error('[createJobPosting] Failed to trigger processing:', err);
      });
    } catch (err) {
      console.error('[createJobPosting] Error triggering processing:', err);
    }
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

  // Add llm_processed field if exists
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
  // 1. First get the record to delete
  const { data: jobToDelete, error: fetchError } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !jobToDelete) {
    throw new Error(fetchError?.message || 'Job posting not found');
  }

  // 2. Move record to deleted_job_postings table
  const { error: insertError } = await supabase
    .from('deleted_job_postings')
    .insert({
      ...jobToDelete,
      deleted_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`Failed to archive job posting: ${insertError.message}`);
  }

  // 3. Delete from original table
  const { error: deleteError } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', id);

  if (deleteError) {
    // Rollback: delete from deleted_job_postings too
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
    // Today's transactions
    supabase
      .from('llm_logs')
      .select('duration_ms, level')
      .gte('created_at', todayStart),
    // This week's transactions
    supabase
      .from('llm_logs')
      .select('duration_ms, level')
      .gte('created_at', weekStart),
    // All time
    supabase.from('llm_logs').select('duration_ms, level'),
  ]);

  // Aggregate calculations
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
 * Returns active processing status (for polling)
 * @returns {Promise<Object>} Processing status
 */
export async function getProcessingStatus() {
  // Get currently processing jobs
  const { data: processingJobs, error: processingError } = await supabase
    .from('job_postings')
    .select('id, job_title, company_name, platform_name, llm_started_at')
    .eq('llm_status', LLM_STATUS.PROCESSING)
    .order('llm_started_at', { ascending: true });

  if (processingError) {
    console.error('Processing jobs fetch error:', processingError);
  }

  // Get pending jobs count
  const { count: pendingCount, error: pendingError } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('llm_status', LLM_STATUS.PENDING);

  if (pendingError) {
    console.error('Pending count fetch error:', pendingError);
  }

  // Get failed jobs count
  const { count: failedCount, error: failedError } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('llm_status', LLM_STATUS.FAILED);

  if (failedError) {
    console.error('Failed count fetch error:', failedError);
  }

  // Return status info of all non-completed jobs (for postings update)
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
    // Return default value
    return { auto_llm_processing: false };
  }

  return data;
}

export async function updateAutoLLMProcessing(enabled) {
  // First get the id of the existing settings record (singleton table)
  const { data: existing, error: fetchError } = await supabase
    .from('app_settings')
    .select('id')
    .single();

  if (fetchError || !existing) {
    throw new Error('Settings record not found');
  }

  // Now update
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
