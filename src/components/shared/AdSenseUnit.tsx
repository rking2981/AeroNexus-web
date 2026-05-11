'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

interface Props {
  slot: string;
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  className?: string;
}

export function AdSenseUnit({ slot, format = 'auto', className }: Props) {
  const { user } = useAuthStore();
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  // Only show ads to FREE_ADS pilots — never to PRO_SUB, VA_MANAGER, or PLATFORM_ADMIN
  const shouldShow = user?.pilot_tier === 'FREE_ADS' && user?.role === 'PILOT';

  useEffect(() => {
    if (!shouldShow || pushed.current || !ref.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      pushed.current = true;
    } catch { /* AdSense not loaded yet */ }
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div className={className}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-3384657062371102"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
