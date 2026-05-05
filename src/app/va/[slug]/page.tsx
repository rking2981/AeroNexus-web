import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

// This page is served when a VA subdomain is detected by middleware
// e.g. delta.aeronexus.app → /va/delta
// The actual content is custom-built per VA by AeroNexus

export default async function VaWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const headersList = await headers();
  const airlineName = headersList.get('x-va-airline-name');

  if (!airlineName) notFound();

  // Placeholder — replaced with the custom VA website when built by AeroNexus
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        color: '#fff',
        textAlign: 'center',
        padding: '40px',
      }}>
        <p style={{ color: '#00D1FF', fontSize: '12px', letterSpacing: '4px', marginBottom: '16px' }}>
          AERONEXUS MANAGED WEBSITE
        </p>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '12px' }}>{airlineName}</h1>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>
          Your custom VA website is being built. Check back soon.
        </p>
      </div>
    </div>
  );
}
