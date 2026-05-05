import { NextRequest, NextResponse } from 'next/server';

const MAIN_DOMAIN = 'aeronexus.app';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://aeronexus-api-production.up.railway.app';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const isLocalhost = host.includes('localhost') || host.includes('vercel.app');

  // Skip middleware for localhost and Vercel preview URLs
  if (isLocalhost) return NextResponse.next();

  // Extract subdomain from host (e.g. "delta" from "delta.aeronexus.app")
  const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');
  const isSubdomain = subdomain && subdomain !== MAIN_DOMAIN && subdomain !== 'www';

  if (!isSubdomain) return NextResponse.next();

  // Validate subdomain is a live VA website
  try {
    const res = await fetch(`${API_URL}/va-site/${subdomain}`, { next: { revalidate: 300 } });
    if (!res.ok) {
      // Subdomain exists but no VA website — show 404
      return NextResponse.rewrite(new URL('/not-found', req.url));
    }

    const airline = await res.json();

    // Rewrite to /va/[slug] route, passing airline data via headers
    const url = req.nextUrl.clone();
    const response = NextResponse.rewrite(new URL(`/va/${subdomain}${url.pathname}`, req.url));
    response.headers.set('x-va-airline-id', airline.id);
    response.headers.set('x-va-airline-name', airline.name);
    response.headers.set('x-va-slug', subdomain);
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
