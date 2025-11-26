import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { JobPostingsTable } from '@/components/job-postings-table';
import { getJobPostings } from '@/lib/actions';
import { Bot, Plus, Briefcase } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const postings = await getJobPostings();

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Briefcase className="size-8" />
          <h1 className="text-3xl font-bold tracking-tight">Job Postings</h1>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/llm-dashboard" target="_blank">
              <Bot className="size-4" />
              LLM Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/create" target="_blank">
              <Plus className="size-4" />
              Yeni İlan Ekle
            </Link>
          </Button>
        </div>
      </div>

      <JobPostingsTable postings={postings} />
    </main>
  );
}
