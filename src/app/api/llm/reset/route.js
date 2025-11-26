import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Tüm job_postings kayıtlarının llm_processed değerini false yap
    // Not: Filtre vermeden update yapmak için boş bir filtre veya ID kontrolü kullanılabilir.
    // Supabase client bazen filtresiz update'i engeller.
    const { data, error } = await supabase
      .from('job_postings')
      .update({
        llm_processed: false,
        llm_notes: null, // Notları da temizleyelim ki sıfır gibi olsun
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Tüm kayıtları kapsayacak bir koşul
      .select('id'); // Etkilenen kayıtları döndür

    if (error) throw error;

    const count = data ? data.length : 0;
    return NextResponse.json({ message: 'All jobs reset successfully', count });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

