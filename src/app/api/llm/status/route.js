import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    const weekStart = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Collect statistics
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
        .eq('llm_processed', true),
      supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('llm_processed', false),
      supabase
        .from('llm_logs')
        .select('duration_ms, level')
        .gte('created_at', todayStart),
      supabase
        .from('llm_logs')
        .select('duration_ms, level')
        .gte('created_at', weekStart),
      supabase.from('llm_logs').select('duration_ms, level'),
    ]);

    // Aggregate calculations
    const calcStats = (logs) => {
      if (!logs || logs.length === 0)
        return { count: 0, avgDuration: 0, errorCount: 0 };
      const successLogs = logs.filter(
        (l) => l.level === 'info' && l.duration_ms
      );
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

    return NextResponse.json({
      total_postings: totalPostings,
      total_processed: totalProcessed,
      total_pending: totalPending,
      stats: {
        today: calcStats(todayLogs),
        week: calcStats(weekLogs),
        allTime: calcStats(allTimeLogs),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
