import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { triggerProcessSingleJob } from '@/lib/processSingleJob';

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

    // 3. Gerekli alanları validate et
    const {
      platform_name,
      url,
      raw_text,
      job_title,
      company_name,
      location_text,
      job_badges, // Maaş, Remote, Full-time gibi badge'ler
    } = body;

    if (
      !platform_name ||
      typeof platform_name !== 'string' ||
      platform_name.trim() === ''
    ) {
      return jsonResponse({ error: 'platform_name is required' }, 400);
    }

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return jsonResponse({ error: 'url is required' }, 400);
    }

    if (!raw_text || typeof raw_text !== 'string' || raw_text.trim() === '') {
      return jsonResponse({ error: 'raw_text is required' }, 400);
    }

    // 4. Aynı URL ile daha önce kayıt var mı kontrol et
    const { data: existing } = await supabase
      .from('job_postings')
      .select('id')
      .eq('url', url.trim())
      .single();

    if (existing) {
      return jsonResponse(
        {
          error: 'A job posting with this URL already exists',
          duplicate: true,
        },
        409
      );
    }

    // 5. raw_text'i zenginleştir - scrape edilen meta bilgileri dahil et
    // Bu sayede LLM daha kapsamlı veri alır (manuel kopyala-yapıştır gibi)
    const enrichedRawTextParts = [];

    if (job_title && typeof job_title === 'string' && job_title.trim() !== '') {
      enrichedRawTextParts.push(`Job Title: ${job_title.trim()}`);
    }
    if (
      company_name &&
      typeof company_name === 'string' &&
      company_name.trim() !== ''
    ) {
      enrichedRawTextParts.push(`Company: ${company_name.trim()}`);
    }
    if (
      location_text &&
      typeof location_text === 'string' &&
      location_text.trim() !== ''
    ) {
      enrichedRawTextParts.push(`Location: ${location_text.trim()}`);
    }
    // Job badges (maaş, remote, full-time vb.)
    if (Array.isArray(job_badges) && job_badges.length > 0) {
      const validBadges = job_badges
        .filter((b) => typeof b === 'string' && b.trim() !== '')
        .map((b) => b.trim());
      if (validBadges.length > 0) {
        enrichedRawTextParts.push(`Tags: ${validBadges.join(' | ')}`);
      }
    }

    // Meta bilgileri + orijinal raw_text birleştir
    const enrichedRawText =
      enrichedRawTextParts.length > 0
        ? `${enrichedRawTextParts.join('\n')}\n\n---\n\n${raw_text.trim()}`
        : raw_text.trim();

    // 6. Yeni job posting insert et
    const insertData = {
      platform_name: platform_name.trim(),
      url: url.trim(),
      raw_text: enrichedRawText,
      llm_processed: false,
    };

    // console.log('insertData', insertData);

    const { data, error } = await supabase
      .from('job_postings')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return jsonResponse({ error: 'Database error' }, 500);
    }

    // Asenkron olarak LLM işlemesini başlat (fire-and-forget)
    // Bu işlem kullanıcı cevabını bekletmez, arka planda çalışır
    triggerProcessSingleJob(data.id);

    return jsonResponse({
      success: true,
      id: data.id,
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
