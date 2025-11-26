import { LLMDashboardClient } from '@/components/llm-dashboard-client';
import { getLLMStatus, getLLMLogs } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'LLM Dashboard | Job Postings',
};

export default async function LLMDashboardPage() {
  const [status, logs] = await Promise.all([getLLMStatus(), getLLMLogs(20)]);

  return (
    <main className="container mx-auto max-w-8xl sm:p-4">
      <LLMDashboardClient initialStatus={status} initialLogs={logs} />
    </main>
  );
}
