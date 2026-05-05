import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AeroNexus | The Next-Gen VA Ecosystem',
  description: 'Experience a living economy, native rotorcraft physics, and the world\'s most complete aviation database of 85,289 facilities.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
