import { NextResponse } from 'next/server';
import { processPendingJobs } from '@/lib/processPendingJobs';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit ? parseInt(body.limit) : 10;

    // Asenkron çalıştırmak yerine sonucu bekleyip dönüyoruz
    // Not: Çok uzun sürecekse bunu background job'a çevirmek gerekebilir
    const result = await processPendingJobs(limit);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

