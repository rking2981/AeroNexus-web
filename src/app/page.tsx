import Link from 'next/link';

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

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/10">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple, Scalable Pricing</h2>
          <p className="text-gray-400">Built to turn your passion into a professional operation.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Pilot Free */}
          <div className="glass-card p-8 rounded-3xl flex flex-col">
            <h4 className="text-lg font-bold mb-1">Pilot Free</h4>
            <div className="text-3xl font-extrabold mb-4">
              $0<span className="text-xs font-normal text-gray-500">/mo</span>
            </div>
            <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
              <li>✓ Ad-Supported Briefings</li>
              <li>✓ Standard ACARS Access</li>
              <li>✓ Last 10 Flights History</li>
              <li>✓ Global Live Map</li>
            </ul>
            <Link href="/register" className="w-full border border-white/20 py-3 rounded-xl hover:bg-white/5 transition text-sm font-bold text-center block">
              Join as Pilot
            </Link>
          </div>

          {/* VA Startup */}
          <div className="glass-card p-8 rounded-3xl flex flex-col">
            <h4 className="text-lg font-bold mb-1">VA Startup</h4>
            <div className="text-3xl font-extrabold mb-4">
              $4.99<span className="text-xs font-normal text-gray-500">/mo</span>
            </div>
            <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
              <li>✓ Custom Airline Logo</li>
              <li>✓ Up to 5 Active Pilots</li>
              <li>✓ 10 Persistent Hulls</li>
              <li>✓ Basic Fleet Management</li>
              <li className="text-gray-600 line-through text-xs">Custom Colors &amp; Branding</li>
            </ul>
            <Link href="/register" className="w-full border border-white/20 py-3 rounded-xl hover:bg-white/5 transition text-sm font-bold text-center block">
              Create Airline
            </Link>
          </div>

          {/* Enterprise */}
          <div className="glass-card border-aero p-8 rounded-3xl flex flex-col relative shadow-2xl shadow-[#00D1FF]/5">
            <div className="absolute top-4 right-4 text-[10px] text-aero font-bold tracking-widest uppercase">Most Popular</div>
            <h4 className="text-lg font-bold mb-1 text-aero">Enterprise</h4>
            <div className="text-3xl font-extrabold mb-4">
              $14.99<span className="text-xs font-normal text-gray-500">/mo</span>
            </div>
            <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
              <li>✓ 500 Pilots &amp; 200 Hulls</li>
              <li>✓ Custom Domain Support</li>
              <li>✓ Alliance Management</li>
              <li>✓ Advanced Analytics API</li>
            </ul>
            <Link href="/register" className="w-full bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm text-center block">
              Get Enterprise
            </Link>
          </div>

          {/* Founder's Pass — sold out or available */}
          <div className="glass-card p-8 rounded-3xl flex flex-col border-purple-500/50 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 blur-3xl" />

            {founders.sold_out ? (
              // ─── Sold out state ─────────────────────────────────────────
              <>
                <h4 className="text-lg font-bold mb-1 text-purple-400">Founder&apos;s Pass</h4>
                <div className="text-3xl font-extrabold mb-2 text-gray-500 line-through">$199</div>
                <p className="text-[10px] text-purple-300 uppercase font-bold mb-6 tracking-wider">
                  Sold Out — All 100 Claimed
                </p>
                <div className="flex-grow flex flex-col justify-center text-center py-4">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Thank you to all who purchased the Founder&apos;s Pass. We have reached our limit.
                  </p>
                  <p className="text-purple-400/70 text-xs mt-4">
                    🎖️ {founders.count} Founders are part of history.
                  </p>
                </div>
              </>
            ) : (
              // ─── Available state ─────────────────────────────────────────
              <>
                <h4 className="text-lg font-bold mb-1 text-purple-400">Founder&apos;s Pass</h4>
                <div className="text-3xl font-extrabold mb-4">
                  $199<span className="text-xs font-normal text-gray-500">/once</span>
                </div>
                <p className="text-[10px] text-purple-300 uppercase font-bold mb-4 tracking-wider">
                  {founders.remaining} of {founders.cap} remaining
                </p>
                <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
                  <li>✓ <strong>Lifetime Enterprise Access</strong></li>
                  <li>✓ No Monthly Fees, Ever</li>
                  <li>✓ &quot;Founder&quot; Profile Badge</li>
                  <li>✓ Early Access to New Features</li>
                  <li>✓ Direct Dev Feedback Channel</li>
                </ul>
                <Link
                  href="/register?plan=founders"
                  className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-500 transition text-sm shadow-lg shadow-purple-900/20 text-center block"
                >
                  Secure My Spot
                </Link>
              </>
            )}
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-gray-600 text-sm border-t border-white/5">
        <p>&copy; 2026 AeroNexus Ecosystem. Built for MSFS 2024 &amp; X-Plane.</p>
      </footer>
    </div>
  );
}
