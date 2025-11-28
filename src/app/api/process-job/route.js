import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import {
  processSingleJob,
  isAutoProcessingEnabled,
} from '@/lib/processSingleJob';

/**
 * Internal API endpoint for triggering job processing
 * Used by server actions to leverage waitUntil in Vercel
 */
export async function POST(request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const autoEnabled = await isAutoProcessingEnabled();

    if (!autoEnabled) {
      console.log(
        `[ProcessJob API] Auto-processing disabled, skipping job: ${jobId}`
      );
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'auto_processing_disabled',
      });
    }

    console.log(`[ProcessJob API] Starting processing for job: ${jobId}`);

    // waitUntil: Response hemen döner, işlem arka planda devam eder
    waitUntil(
      processSingleJob(jobId).catch((err) => {
        console.error(
          `[ProcessJob API] processSingleJob error for ${jobId}:`,
          err
        );
      })
    );

    return NextResponse.json({
      success: true,
      status: 'processing_started',
      jobId,
    });
  } catch (error) {
    console.error('[ProcessJob API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
