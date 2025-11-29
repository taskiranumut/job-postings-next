import { notFound } from 'next/navigation';
import { JobForm } from '@/components/job-form';
import { getJobPosting } from '@/lib/actions';

export const metadata = {
  title: 'Edit Job | Job Postings',
};

export default async function EditJobPostingPage({ params }) {
  const { id } = await params;

  let posting;
  try {
    posting = await getJobPosting(id);
  } catch {
    notFound();
  }

  if (!posting) {
    notFound();
  }

  return (
    <main className="container mx-auto max-w-4xl sm:p-4">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Edit Job</h1>
      <JobForm posting={posting} mode="edit" />
    </main>
  );
}
