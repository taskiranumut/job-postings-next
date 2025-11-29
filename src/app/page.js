import { Suspense } from 'react';
import {
  JobPostingsTable,
  JobPostingsTableSkeleton,
} from '@/components/job-postings-table';
import { getJobPostingsPaginated, getUniquePlatforms } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;

  // Read URL parameters
  const page = parseInt(params?.page || '1', 10);
  const pageSize = parseInt(params?.pageSize || '20', 10);
  const platforms = params?.platform?.split(',').filter(Boolean) || [];
  const llmStatuses = params?.llm_status?.split(',').filter(Boolean) || [];
  const jobTitle = params?.job_title || '';
  const company = params?.company || '';

  // Fetch data
  const [result, uniquePlatforms] = await Promise.all([
    getJobPostingsPaginated({
      page,
      pageSize,
      platforms,
      llmStatuses,
      jobTitle,
      company,
    }),
    getUniquePlatforms(),
  ]);

  return (
    <main className="container mx-auto max-w-8xl sm:p-4">
      <Suspense fallback={<JobPostingsTableSkeleton />}>
        <JobPostingsTable
          initialData={result.data}
          initialPagination={result.pagination}
          initialPlatforms={uniquePlatforms}
        />
      </Suspense>
    </main>
  );
}
