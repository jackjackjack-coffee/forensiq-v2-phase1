import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ForensiQ — Fraud Detection',
  description: 'Forensic accounting fraud detection system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('dark font-sans', inter.variable)}>
      <body className="bg-[#050505] text-[#d4d4d4] min-h-screen antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
