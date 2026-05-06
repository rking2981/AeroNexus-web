import Link from 'next/link';
import { PricingSection } from '@/components/pricing-section';

interface FoundersStatus {
  enabled: boolean;
  count: number;
  cap: number;
  sold_out: boolean;
  remaining: number;
}

async function getFoundersStatus(): Promise<FoundersStatus> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/founders-status`, {
      next: { revalidate: 60 }, // refresh every 60 seconds
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch {
    // If the API is unreachable, show the card as available
    return { enabled: true, count: 0, cap: 100, sold_out: false, remaining: 100 };
  }
}

export default async function HomePage() {
  const founders = await getFoundersStatus();

  return (
    <div className="antialiased">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tighter italic">
          AERO<span className="text-aero">NEXUS</span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-gray-400">
          <a href="#features" className="hover:text-white transition">Network</a>
          <a href="#features" className="hover:text-white transition">Economy</a>
          <a href="#features" className="hover:text-white transition">ACARS</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition">
            Login
          </Link>
          <Link
            href="/register"
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-[#00D1FF] transition"
          >
            Register
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-gradient pt-24 pb-32 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-aero font-semibold tracking-widest text-xs uppercase mb-4 block">
            Native MSFS 2024 &amp; X-Plane Support
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            THE SKY IS NO LONGER <br />
            <span className="text-aero">A GRID.</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
            Experience a living economy, native rotorcraft physics, and the world&apos;s most
            complete aviation database of 85,289 facilities.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="bg-aero text-black px-8 py-4 rounded-lg font-bold text-lg hover:brightness-110 transition"
            >
              Start Your Airline
            </Link>
            <a href="#" className="glass-card px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10 transition">
              Download ACARS
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 rounded-2xl md:col-span-2">
            <div className="text-aero text-3xl mb-4">🚁</div>
            <h3 className="text-2xl font-bold mb-3">Native Rotorcraft &amp; Seaplane Logic</h3>
            <p className="text-gray-400 leading-relaxed">
              We don&apos;t treat helicopters like slow airplanes. Experience custom LZ tracking,
              Vortex Ring State monitoring, and offshore oil rig logistics that legacy platforms ignore.
            </p>
          </div>
          <div className="glass-card p-8 rounded-2xl">
            <div className="text-aero text-3xl mb-4">🌐</div>
            <h3 className="text-2xl font-bold mb-3">85,289 Facilities</h3>
            <p className="text-gray-400 leading-relaxed">
              From major hubs to remote hospital pads and mountain docks. If it exists in the sim,
              it exists in AeroNexus.
            </p>
          </div>
          <div className="glass-card p-8 rounded-2xl">
            <div className="text-aero text-3xl mb-4">🛡️</div>
            <h3 className="text-2xl font-bold mb-3">Silent ACARS</h3>
            <p className="text-gray-400 leading-relaxed">
              Zero-config logging. It detects your engine start and logs telemetry with an offline
              SQLite buffer.
            </p>
          </div>
          <div className="glass-card p-8 rounded-2xl md:col-span-2">
            <div className="text-aero text-3xl mb-4">📈</div>
            <h3 className="text-2xl font-bold mb-3">The Living Economy</h3>
            <p className="text-gray-400 leading-relaxed">
              A global hub-and-spoke logistics model. Fuel prices fluctuate based on your proximity
              to our 8 global distribution hubs and local pilot demand.
            </p>
          </div>
        </div>
      </section>

      {/* Managed Website */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-white/10">
        <div className="glass-card rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <span className="text-aero font-semibold tracking-widest text-xs uppercase mb-4 block">
              Enterprise Add-On
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">
              Your VA, Your Website.
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Get a fully custom, professionally built website for your Virtual Airline — hosted on
              your own <span className="text-white font-medium">yourva.aeronexus.app</span> subdomain.
              Complete with a live flight map, crew center, fleet page, pilot roster, and a manager portal.
            </p>
            <ul className="text-gray-400 space-y-2 text-sm mb-8">
              <li>✓ Custom design built by AeroNexus</li>
              <li>✓ Live map showing your airline&apos;s flights only</li>
              <li>✓ Crew Center — pilots dispatch, book flights &amp; view logbooks</li>
              <li>✓ Manager Center — full VA management from your own domain</li>
              <li>✓ Hosting &amp; SSL included</li>
            </ul>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-extrabold">$199</p>
                <p className="text-xs text-gray-500">one-time setup</p>
              </div>
              <div className="text-gray-600">+</div>
              <div>
                <p className="text-3xl font-extrabold">$19.99</p>
                <p className="text-xs text-gray-500">per year hosting</p>
              </div>
              <Link
                href="/register"
                className="ml-4 bg-aero text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition text-sm"
              >
                Get Started →
              </Link>
            </div>
            <p className="text-xs text-gray-600 mt-4">Requires Enterprise subscription · Contact us after purchase</p>
          </div>
          <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
            <div className="text-7xl mb-4">🌐</div>
            <p className="text-center text-xs text-gray-500 font-mono">yourva.aeronexus.app</p>
          </div>
        </div>
      </section>

      <PricingSection founders={founders} />

      {/* Footer */}
      <footer className="py-12 text-center text-gray-600 text-sm border-t border-white/5">
        <p>&copy; 2026 AeroNexus Ecosystem. Built for MSFS 2024 &amp; X-Plane.</p>
      </footer>
    </div>
  );
}
