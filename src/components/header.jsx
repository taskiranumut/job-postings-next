import Link from 'next/link';
import Image from 'next/image';
import { PlusCircle, LayoutDashboard, ClipboardList } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg text-ring hover:text-primary transition-colors"
          >
            <Image
              src="/logo-dark.png"
              alt="Job Postings Management"
              width={0}
              height={0}
              sizes="100vw"
              className="h-8 w-auto"
              style={{ width: 'auto', height: '2rem' }}
              priority
            />
            <span className="hidden sm:inline-block">
              Job Postings Management
            </span>
            <span className="sm:hidden">JPM</span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ClipboardList className="size-6 sm:size-4" />
            <span className="hidden sm:inline-block">İlanlar</span>
          </Link>
          <Link
            href="/llm-dashboard"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <LayoutDashboard className="size-6 sm:size-4" />
            <span className="hidden sm:inline-block">LLM Dashboard</span>
          </Link>
          <div className="h-8 border"></div>
          <Link
            href="/create"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <PlusCircle className="size-6 sm:size-4" />
            <span className="hidden sm:inline-block">İlan Ekle</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
