import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // İstatistikleri topla
    const { count: totalPostings } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true });

    const { count: totalProcessed } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('llm_processed', true);

    const { count: totalPending } = await supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('llm_processed', false);

    // Son çalışmayı getir
    const { data: lastRun } = await supabase
      .from('llm_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      total_postings: totalPostings,
      total_processed: totalProcessed,
      total_pending: totalPending,
      last_run: lastRun,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
