import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Job Postings',
  description: 'İş ilanları yönetim paneli',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
