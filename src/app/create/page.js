import { JobForm } from '@/components/job-form';

export const metadata = {
  title: 'Yeni İlan Ekle | Job Postings',
};

export default function CreateJobPostingPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Yeni İlan Ekle</h1>
      <JobForm mode="create" />
    </main>
  );
}
