'use client';

import Link from 'next/link';

interface Props {
  airline: {
    name: string;
    icao_code?: string;
    website_slug?: string | null;
  };
  className?: string;
  showIcao?: boolean;
}

/**
 * Renders an airline name as a link to its public VA page when
 * website_slug is available, otherwise renders plain text.
 */
export function AirlineLink({ airline, className = '', showIcao = false }: Props) {
  const text = showIcao && airline.icao_code
    ? `${airline.name} (${airline.icao_code})`
    : airline.name;

  if (!airline.website_slug) {
    return <span className={className}>{text}</span>;
  }

  return (
    <Link
      href={`/va/${airline.website_slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:text-aero transition-colors underline-offset-2 hover:underline ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {text}
    </Link>
  );
}
