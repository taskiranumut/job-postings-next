import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination parametreleri
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Filtre parametreleri
    const platforms = searchParams.get('platform')?.split(',').filter(Boolean) || [];
    const llmStatuses = searchParams.get('llm_status')?.split(',').filter(Boolean) || [];
    const jobTitle = searchParams.get('job_title') || '';
    const company = searchParams.get('company') || '';

    // Sayfa boyutu validasyonu
    const validPageSizes = [20, 50, 100];
    const validatedPageSize = validPageSizes.includes(pageSize) ? pageSize : 20;

    // Offset hesapla
    const offset = (page - 1) * validatedPageSize;

    // Base query builder
    let query = supabase
      .from('job_postings')
      .select('*', { count: 'exact' });

    // Filtreleri uygula
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

    // Sıralama ve pagination
    query = query
      .order('scraped_at', { ascending: false })
      .range(offset, offset + validatedPageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Benzersiz platformları al (filtre dropdown için)
    const { data: allPlatforms } = await supabase
      .from('job_postings')
      .select('platform_name')
      .not('platform_name', 'is', null);

    const uniquePlatforms = [...new Set(allPlatforms?.map(p => p.platform_name) || [])].sort();

    // Toplam sayfa sayısını hesapla
    const totalPages = Math.ceil((count || 0) / validatedPageSize);

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        pageSize: validatedPageSize,
        totalCount: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      platforms: uniquePlatforms,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

