import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const EXTENSION_SHARED_SECRET = process.env.EXTENSION_SHARED_SECRET;

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-jpm-extension-token',
};

/**
 * Helper function to create JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  try {
    // 1. Token doğrulama
    const token = request.headers.get('x-jpm-extension-token');

    if (!EXTENSION_SHARED_SECRET) {
      console.error('EXTENSION_SHARED_SECRET environment variable is not set');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    if (!token || token !== EXTENSION_SHARED_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Request body'yi parse et
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    console.log('body', body);
    // 3. Gerekli alanları validate et
    // const {
    //   platform_name,
    //   url,
    //   raw_text,
    //   job_title,
    //   company_name,
    //   location_text,
    // } = body;

    // if (
    //   !platform_name ||
    //   typeof platform_name !== 'string' ||
    //   platform_name.trim() === ''
    // ) {
    //   return jsonResponse({ error: 'platform_name is required' }, 400);
    // }

    // if (!url || typeof url !== 'string' || url.trim() === '') {
    //   return jsonResponse({ error: 'url is required' }, 400);
    // }

    // if (!raw_text || typeof raw_text !== 'string' || raw_text.trim() === '') {
    //   return jsonResponse({ error: 'raw_text is required' }, 400);
    // }

    // // 4. Aynı URL ile daha önce kayıt var mı kontrol et
    // const { data: existing } = await supabase
    //   .from('job_postings')
    //   .select('id')
    //   .eq('url', url.trim())
    //   .eq('is_deleted', false)
    //   .single();

    // if (existing) {
    //   return jsonResponse(
    //     {
    //       error: 'A job posting with this URL already exists',
    //       duplicate: true,
    //     },
    //     409
    //   );
    // }

    // // 5. Yeni job posting insert et
    // const insertData = {
    //   platform_name: platform_name.trim(),
    //   url: url.trim(),
    //   raw_text: raw_text.trim(),
    //   llm_processed: false,
    // };

    // // Opsiyonel alanları ekle (null değilse)
    // if (job_title && typeof job_title === 'string' && job_title.trim() !== '') {
    //   insertData.job_title = job_title.trim();
    // }
    // if (
    //   company_name &&
    //   typeof company_name === 'string' &&
    //   company_name.trim() !== ''
    // ) {
    //   insertData.company_name = company_name.trim();
    // }
    // if (
    //   location_text &&
    //   typeof location_text === 'string' &&
    //   location_text.trim() !== ''
    // ) {
    //   insertData.location_text = location_text.trim();
    // }

    // const { data, error } = await supabase
    //   .from('job_postings')
    //   .insert(insertData)
    //   .select('id')
    //   .single();

    // if (error) {
    //   console.error('Supabase insert error:', error);
    //   return jsonResponse({ error: 'Database error' }, 500);
    // }

    return jsonResponse({
      success: true,
      // id: data.id,
      message: 'Job posting saved successfully',
    });
  } catch (error) {
    console.error('Unexpected error in from-extension route:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
