import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Set llm_processed to false for all job_postings records
    // Note: To update without a filter, an empty filter or ID check can be used.
    // Supabase client sometimes prevents update without filter.
    const { data, error } = await supabase
      .from('job_postings')
      .update({
        llm_processed: false,
        llm_notes: null, // Clear notes too so it looks like fresh
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // A condition to cover all records
      .select('id'); // Return affected records

    if (error) throw error;

    const count = data ? data.length : 0;
    return NextResponse.json({ message: 'All jobs reset successfully', count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
