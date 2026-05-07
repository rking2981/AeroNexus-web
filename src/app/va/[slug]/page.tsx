import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://aeronexus-api-production.up.railway.app';

interface Branding {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  banner_url?: string;
  font?: string;
}

interface AirlinePublic {
  id: string;
  name: string;
  icao_code: string;
  iata_code: string | null;
  hub_country: string | null;
  branding: Branding | null;
  currency_code: string;
  currency_symbol: string;
}

interface Stats {
  completed_flights: number;
  total_hours: number;
  total_pax: number;
  avg_pax_happiness: number | null;
  pilot_count: number;
  avg_reputation: number | null;
  active_hull_count: number;
}

interface Pilot {
  id: string;
  display_name: string;
  reputation: number;
  xp_points: number;
}

interface Route {
  id: string;
  distance_nm: number;
  base_ticket_price: number;
  origin: { icao: string; name: string; city: string | null };
  destination: { icao: string; name: string; city: string | null };
}

async function fetchVaData(slug: string) {
  const res = await fetch(`${API_URL}/va-site/${slug}/public-data`, { cache: 'no-store' });
  if (!res.ok) return { stats: null, pilots: [], routes: [] };
  const data = await res.json();
  return {
    stats: data.stats as Stats | null,
    pilots: (data.pilots as Pilot[]) ?? [],
    routes: (data.routes as Route[]) ?? [],
  };
}

export default async function VaWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const headersList = await headers();

  const airlineName = headersList.get('x-va-airline-name');
  const brandingRaw = headersList.get('x-va-branding');

  if (!airlineName) notFound();

  // Fetch full airline info + public data
  const airlineRes = await fetch(`${API_URL}/va-site/${slug}`, { cache: 'no-store' });
  if (!airlineRes.ok) notFound();
  const airline: AirlinePublic = await airlineRes.json();

  const branding: Branding = brandingRaw ? JSON.parse(brandingRaw) : (airline.branding ?? {});

  // Resolve CSS variables from branding
  const primary = branding.primary_color ?? '#00D1FF';
  const secondary = branding.secondary_color ?? '#0099CC';
  const font = branding.font ?? 'Inter';

  // Derived values
  const primaryDim = `${primary}22`;
  const primaryBorder = `${primary}44`;

  const cssVars = `
    :root {
      --va-primary: ${primary};
      --va-secondary: ${secondary};
      --va-primary-dim: ${primaryDim};
      --va-primary-border: ${primaryBorder};
      --va-font: '${font}', Inter, sans-serif;
    }
  `;

  const { stats, pilots, routes } = await fetchVaData(slug);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div style={{ fontFamily: 'var(--va-font)', background: '#080808', color: '#fff', minHeight: '100vh' }}>

        {/* Hero */}
        <div style={{
          background: branding.banner_url
            ? `linear-gradient(to bottom, rgba(8,8,8,0.4), #080808), url(${branding.banner_url}) center/cover`
            : `linear-gradient(135deg, ${primaryDim} 0%, #080808 60%)`,
          padding: '80px 24px 60px',
          textAlign: 'center',
          borderBottom: `1px solid ${primaryBorder}`,
        }}>
          {branding.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt={`${airline.name} logo`}
              style={{ height: '64px', objectFit: 'contain', margin: '0 auto 24px', display: 'block' }} />
          )}
          <p style={{ color: primary, fontSize: '11px', letterSpacing: '4px', marginBottom: '12px', fontWeight: 700 }}>
            {airline.icao_code}{airline.iata_code ? ` · ${airline.iata_code}` : ''}
            {airline.hub_country ? ` · ${airline.hub_country}` : ''}
          </p>
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '8px', lineHeight: 1.1 }}>
            {airline.name}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px' }}>Virtual Airline · Powered by AeroNexus</p>
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>

          {/* Stats */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '48px' }}>
              {[
                { label: 'Total Flights', value: stats.completed_flights.toLocaleString(), icon: '✈️' },
                { label: 'Flight Hours', value: `${stats.total_hours.toLocaleString()} hrs`, icon: '⏱️' },
                { label: 'Passengers Flown', value: stats.total_pax.toLocaleString(), icon: '👥' },
                { label: 'Active Pilots', value: stats.pilot_count, icon: '🧑‍✈️' },
                { label: 'Active Fleet', value: stats.active_hull_count, icon: '🛩️' },
                ...(stats.avg_pax_happiness ? [{ label: 'Avg PAX Satisfaction', value: `${Number(stats.avg_pax_happiness).toFixed(0)}%`, icon: '😊' }] : []),
              ].map(s => (
                <div key={s.label} style={{
                  background: '#111', border: `1px solid ${primaryBorder}`,
                  borderRadius: '16px', padding: '20px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: primary }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pilots */}
          {pilots.length > 0 && (
            <section style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: primary }}>Our Pilots</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {pilots.map(p => (
                  <div key={p.id} style={{
                    background: '#111', border: `1px solid #222`,
                    borderRadius: '12px', padding: '16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: primaryDim, border: `1px solid ${primaryBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, color: primary, fontSize: '14px', flexShrink: 0,
                    }}>
                      {p.display_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.display_name}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Rep {Number(p.reputation).toFixed(1)} · {p.xp_points.toLocaleString()} XP</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Routes */}
          {routes.length > 0 && (
            <section style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: primary }}>Featured Routes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {routes.map(r => (
                  <div key={r.id} style={{
                    background: '#111', border: '1px solid #222',
                    borderRadius: '12px', padding: '14px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: primary, fontSize: '14px' }}>{r.origin.icao}</span>
                      <span style={{ color: '#444' }}>→</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: '14px' }}>{r.destination.icao}</span>
                      <span style={{ color: '#6B7280', fontSize: '12px' }}>
                        {r.origin.city ?? r.origin.name} → {r.destination.city ?? r.destination.name}
                      </span>
                    </div>
                    <span style={{ color: '#6B7280', fontSize: '12px', flexShrink: 0 }}>{r.distance_nm.toLocaleString()} nm</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer style={{ borderTop: '1px solid #1a1a1a', paddingTop: '24px', textAlign: 'center' }}>
            <p style={{ color: '#333', fontSize: '12px' }}>
              {airline.name} · Virtual Airline ·{' '}
              <a href="https://aeronexus.app" style={{ color: '#444', textDecoration: 'none' }}>
                Powered by AeroNexus
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
