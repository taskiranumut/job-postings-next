import { JobPostingsTable } from '@/components/job-postings-table';
import { getJobPostings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const postings = await getJobPostings();

  return (
    <main className="container mx-auto max-w-8xl sm:p-4">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">İş İlanları</h1>

      <JobPostingsTable postings={postings} />
    </main>
  );
}
