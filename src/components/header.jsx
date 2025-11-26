import Link from 'next/link';
import { Briefcase, PlusCircle, LayoutDashboard, Home } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg text-ring hover:text-primary transition-colors"
          >
            <Briefcase className="h-5 w-5" />
            <span className="hidden sm:inline-block">
              Job Postings Management
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline-block">İlanlar</span>
          </Link>
          <Link
            href="/create"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline-block">İlan Ekle</span>
          </Link>
          <Link
            href="/llm-dashboard"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline-block">LLM Dashboard</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
