import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('id, platform_name, url, scraped_at')
      .eq('llm_processed', false)
      .order('scraped_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

