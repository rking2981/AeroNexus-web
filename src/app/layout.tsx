import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '600', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = 'https://aeronexus.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AeroNexus — Virtual Airline Management Platform for MSFS 2024 & X-Plane',
    template: '%s | AeroNexus',
  },
  description:
    'AeroNexus is the most advanced virtual airline platform for MSFS 2024 and X-Plane. Create and manage your VA with a living economy, 85,289 airports, native helicopter support, silent ACARS, and real-time flight tracking.',
  keywords: [
    'virtual airline',
    'virtual airline management',
    'virtual airline platform',
    'VA manager',
    'MSFS 2024 virtual airline',
    'X-Plane virtual airline',
    'flight simulator VA',
    'ACARS software',
    'virtual airline economy',
    'helicopter virtual airline',
    'create virtual airline',
    'VA management software',
    'AeroNexus',
    'flight sim airline',
    'pilot logbook',
    'virtual airline community',
  ],
  authors: [{ name: 'AeroNexus', url: SITE_URL }],
  creator: 'AeroNexus',
  publisher: 'AeroNexus',
  category: 'Flight Simulation',
  applicationName: 'AeroNexus',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'AeroNexus',
    title: 'AeroNexus — Virtual Airline Management Platform',
    description:
      'The most advanced virtual airline platform for MSFS 2024 & X-Plane. Living economy, 85,289 airports, helicopter support, silent ACARS.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AeroNexus — Virtual Airline Management Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AeroNexus — Virtual Airline Management Platform',
    description:
      'The most advanced virtual airline platform for MSFS 2024 & X-Plane. Living economy, 85,289 airports, helicopter support, silent ACARS.',
    images: ['/og-image.png'],
    creator: '@aeronexusapp',
    site: '@aeronexusapp',
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3384657062371102"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
