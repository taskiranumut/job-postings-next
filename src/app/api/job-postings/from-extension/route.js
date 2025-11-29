import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { supabase } from '@/lib/supabase';
import {
  processSingleJob,
  isAutoProcessingEnabled,
} from '@/lib/processSingleJob';

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
    // 1. Token validation
    const token = request.headers.get('x-jpm-extension-token');

    if (!EXTENSION_SHARED_SECRET) {
      console.error('EXTENSION_SHARED_SECRET environment variable is not set');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    if (!token || token !== EXTENSION_SHARED_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    // 3. Validate required fields
    const {
      platform_name,
      url,
      raw_text,
      job_title,
      company_name,
      location_text,
      job_badges, // Badges like Salary, Remote, Full-time
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

    // 4. Check if a record with the same URL already exists
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

    // 5. Enrich raw_text - include scraped meta info
    // This way LLM gets more comprehensive data (like manual copy-paste)
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
    // Job badges (salary, remote, full-time etc.)
    if (Array.isArray(job_badges) && job_badges.length > 0) {
      const validBadges = job_badges
        .filter((b) => typeof b === 'string' && b.trim() !== '')
        .map((b) => b.trim());
      if (validBadges.length > 0) {
        enrichedRawTextParts.push(`Tags: ${validBadges.join(' | ')}`);
      }
    }

    // Combine meta info + original raw_text
    const enrichedRawText =
      enrichedRawTextParts.length > 0
        ? `${enrichedRawTextParts.join('\n')}\n\n---\n\n${raw_text.trim()}`
        : raw_text.trim();

    // 6. Insert new job posting
    const insertData = {
      platform_name: platform_name.trim(),
      url: url.trim(),
      raw_text: enrichedRawText,
      llm_processed: false,
      llm_status: 'pending', // Required for auto processing
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

    // Start LLM processing if auto processing is enabled
    const autoEnabled = await isAutoProcessingEnabled();

    if (autoEnabled) {
      console.log(
        `[FromExtension] Auto-processing enabled, starting job: ${data.id}`
      );

      // waitUntil: Response returns immediately, process continues in background
      // This ensures background processes run in Vercel serverless
      waitUntil(
        processSingleJob(data.id).catch((err) => {
          console.error(
            `[FromExtension] processSingleJob error for ${data.id}:`,
            err
          );
        })
      );
    } else {
      console.log(
        `[FromExtension] Auto-processing disabled, skipping job: ${data.id}`
      );
    }

    return jsonResponse({
      success: true,
      id: data.id,
      message: 'Job posting saved successfully',
      auto_processing: autoEnabled,
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
