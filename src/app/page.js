import { Suspense } from 'react';
import {
  JobPostingsTable,
  JobPostingsTableSkeleton,
} from '@/components/job-postings-table';
import { getJobPostings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const postings = await getJobPostings();

  return (
    <main className="container mx-auto max-w-8xl sm:p-4">
      <Suspense fallback={<JobPostingsTableSkeleton />}>
        <JobPostingsTable postings={postings} />
      </Suspense>
    </main>
  );
}
