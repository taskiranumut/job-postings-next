import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/header';

export const metadata = {
  title: 'Job Postings Management',
  description: 'Job postings management panel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <Header />
        <main className="container mx-auto py-6 px-4">{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
