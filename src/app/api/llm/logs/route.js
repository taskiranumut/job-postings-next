import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobPostingId = searchParams.get('job_posting_id');
    const runId = searchParams.get('run_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('llm_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (jobPostingId) {
      query = query.eq('job_posting_id', jobPostingId);
    }
    if (runId) {
      query = query.eq('run_id', runId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

