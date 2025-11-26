import './globals.css';

export const metadata = {
  title: 'Job Postings',
  description: '',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
