import { ComingSoon } from '@/components/coming-soon';

export default function MapPage() {
  return (
    <ComingSoon
      icon="🗺️"
      title="Live Flight Map"
      description="Real-time tracking of all active flights using MapLibre GL with smooth 60fps interpolation. Watch aircraft slide across the globe as pilots dispatch, fly, and land."
      eta="Phase 2 — Next on the build list"
    />
  );
}
