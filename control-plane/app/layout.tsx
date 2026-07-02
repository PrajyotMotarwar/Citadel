import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ForgeOS',
  description: 'The AI Engineering Operating System.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
