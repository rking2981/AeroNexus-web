import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Features — AeroNexus Virtual Airline Management Platform',
  description: 'Explore every feature of AeroNexus — the most advanced virtual airline management platform for MSFS 2024 and X-Plane. Living economy, ACARS, fleet management, cargo, crew tools, and more.',
  alternates: { canonical: 'https://aeronexus.app/features' },
  openGraph: {
    title: 'AeroNexus Features — Virtual Airline Management Platform',
    description: 'A complete breakdown of every feature in AeroNexus — the platform built for serious virtual airline operators.',
    url: 'https://aeronexus.app/features',
    type: 'website',
  },
};

const features = [
  {
    icon: '✈️',
    title: 'Flight Booking & Dispatch',
    description: 'Book flights on your active routes with full weight-and-balance calculations. Before confirming a flight, AeroNexus generates a live passenger forecast based on your route demand score, ticket pricing relative to the market, your airline\'s reputation, how frequently you fly the route, and how many other airlines are competing for the same traffic. You\'ll see a projected cabin-class split between economy, business, and first class, along with an estimated revenue figure before you ever push back. The system validates aircraft-to-route compatibility — helicopters can only operate from heliports and compatible surfaces, seaplanes require seaplane bases, and heavy jets require large airport facilities. Type rating requirements are enforced: pilots need at least three completed flights on a given aircraft family before flying it unsupervised.',
    sub: ['Live PAX demand forecasting', 'Weight & balance with fuel estimation', 'Aircraft-route compatibility checks', 'Type rating enforcement', 'Cargo attachment at booking'],
  },
  {
    icon: '🖥️',
    title: 'Silent ACARS Desktop Client',
    description: 'AeroNexus ACARS is a native desktop application for Windows that connects directly to Microsoft Flight Simulator 2024 via SimConnect and to X-Plane via a UDP bridge. It runs silently in the background from the moment you start your engines — no manual intervention required. ACARS captures OUT/OFF/ON/IN block times using real sim data (parking brake, weight-on-wheels, engine combustion state), records your complete flight telemetry including altitude, speed, heading, vertical speed, and fuel flow every three seconds, and transmits position reports to the AeroNexus server in real time. If your internet connection drops mid-flight, it buffers up to 10,000 position records locally in an offline SQLite database and flushes them automatically when connectivity is restored. At engine shutdown after landing, ACARS scores your flight across five categories — landing quality, bank angle discipline, speed and systems, flight integrity, and block time accuracy — and displays a detailed post-flight report with a letter grade from S down to F.',
    sub: ['MSFS 2024 SimConnect + X-Plane UDP bridge', 'Automatic OUT/OFF/ON/IN block time capture', 'Real-time telemetry at 3-second intervals', 'Offline buffer with auto-flush on reconnect', 'Automatic flight scoring (S/A/B/C/D/F)', 'Altitude-based descent detection — immune to ATC step-downs and turbulence'],
  },
  {
    icon: '📦',
    title: 'Cargo & Freight System',
    description: 'AeroNexus operates a live global cargo board with shipments generated every 15 minutes across 12 cargo categories — from fresh produce and perishables to pharmaceuticals, machinery, electronics, and humanitarian aid. Each shipment has a weight, volume, density class, origin, destination, and a time-limited availability window. Cargo is priced using a realistic per-kg-per-nautical-mile rate with category multipliers that reward high-value freight types. Density classes matter: low-density cargo like textiles consumes more volume per kilogram than ultra-dense pharmaceuticals, so a full belly load of textiles will fill your aircraft\'s volume before it fills its weight capacity. When loading cargo onto a flight, AeroNexus deducts your passenger checked baggage weight (23 kg per passenger at the IATA standard) from the available belly hold capacity first — so the cargo system accurately reflects what space remains after your passengers\' bags are loaded. Multiple shipments can be loaded onto a single flight up to hull capacity.',
    sub: ['Live board with 500+ shipments refreshed every 15 minutes', '12 cargo types with distinct rate multipliers', 'Low/medium/high/ultra-high density classification', 'Volume and weight dual-capacity validation', 'Pax baggage deducted before freight capacity shown', 'Hub-biased generation ensures cargo at active airports'],
  },
  {
    icon: '💰',
    title: 'Living Economy',
    description: 'AeroNexus runs a persistent global economy that reacts to real pilot and airline activity. Fuel prices are not static — they fluctuate based on each airport\'s proximity to one of eight global fuel distribution hubs and the volume of recent flights through the region. The more pilots fly through an area, the higher local fuel demand, and prices rise accordingly. Route demand scores decay over time if a route isn\'t being flown and recover as traffic picks up. Ticket pricing is dynamic: you set your base economy price per route, and AeroNexus calculates a market-relative factor — price your tickets 20% below market and you attract more passengers; price them above market and load factors fall. Every expense in the system is modeled: fuel burn (adjusted for aircraft weight and distance), landing fees, catering, pilot pay, gate slots, maintenance, insurance premiums, and taxes. Your airline\'s financial health is tracked on a live P&L dashboard.',
    sub: ['Dynamic fuel prices tied to hub proximity and demand', 'Route demand scores that decay and recover', 'Market-relative ticket pricing model', 'Full expense modeling (fuel, fees, pay, maintenance)', 'Live P&L with time filtering', 'Multi-currency with live FX rates'],
  },
  {
    icon: '🛩️',
    title: 'Fleet Management',
    description: 'Your fleet in AeroNexus is a managed asset, not just a list of aircraft. Every hull accumulates airframe hours and cycles, and maintenance checks fall due on a realistic schedule — A-checks, C-checks, and D-checks each with their own interval thresholds. Engine wear accumulates over flights and resets after an engine overhaul. When an aircraft is placed into maintenance, it is removed from active service and returns after the scheduled downtime completes. Component damage from hard landings or abnormal operations triggers maintenance flags. Cabin configurations are fully customizable: you decide how many seats each aircraft carries in economy, premium economy, business, and first class, and set price multipliers per class up to 8× the base economy rate. Aircraft can be listed for sale on the used aircraft market at a price you set, with fair value estimation provided. Aircraft can also be leased with a weekly fee deducted automatically.',
    sub: ['A/C/D-check scheduling with realistic intervals', 'Engine wear accumulation and TBO tracking', 'Rotor wear for helicopter fleets', 'Per-aircraft cabin configuration with class pricing', 'Maintenance grades A through F', 'Buy, lease, or sell aircraft on the market'],
  },
  {
    icon: '🌐',
    title: 'Route Network & Hub Management',
    description: 'Build your airline\'s network across 85,289 airports, heliports, seaplane bases, and off-airport facilities. Routes are typed — scheduled passenger service, cargo, charter, medevac, bush operations, offshore, VIP, military, and humanitarian — and each type behaves differently in the economy. Set your own base ticket prices per route with separate multipliers for business and first class. Configure your cabin split percentages to match your target market. Waypoints can be added to any route for realistic intermediate stops. Live METAR weather data from aviationweather.gov is displayed for every origin and destination — including flight category (VFR/MVFR/IFR/LIFR), wind, visibility, ceiling, temperature, and icing risk. Route saturation is tracked across the entire network: if too many airlines pile onto the same popular route, a saturation penalty reduces revenue by up to 15% to incentivize network diversification.',
    sub: ['85,289 worldwide facilities including heliports and seaplane bases', '9 route types with distinct economic behavior', 'Live METAR weather for every origin and destination', 'Route saturation penalty (up to 15% revenue reduction)', 'Intermediate waypoint support', 'Reverse route creation in one click'],
  },
  {
    icon: '👥',
    title: 'Crew Center & Pilot Management',
    description: 'AeroNexus gives airline managers a full suite of crew management tools. Your pilot roster shows each pilot\'s reputation score, total hours, flights completed, average landing quality, rank, current airport, and account standing. Rank progression is automatic — pilots advance through your rank tiers (which you define) as they accumulate hours and flight counts. You can override ranks manually or reset to the system defaults. Incoming pilot applications are reviewed in a dedicated tab: view the pilot\'s stats, their answers to your custom application questions, and accept or decline with an optional note sent to the applicant. The application form itself is fully configurable — up to 10 custom questions, each marked required or optional, with the form openable and closable as recruitment demand fluctuates. Pilots can be suspended for a defined period with a reason, banned from the airline entirely, or removed from the roster. Position-based permissions let you restrict who can manage cargo, finances, routes, fleet, and crew.',
    sub: ['Automatic rank promotion based on hours and flights', 'Custom application forms with up to 10 questions', 'Pilot suspension with end date and reason', 'Position-based permission system', 'Live pilot location tracking', 'Reputation and landing quality per pilot'],
  },
  {
    icon: '📋',
    title: 'Logbook & Flight History',
    description: 'Every completed flight is permanently recorded in your logbook with full telemetry replay. View the track on an interactive map, check your block times, review fuel consumption, landing vertical speed, max G-force, PAX happiness, and gross revenue. Flights are scored by ACARS across five weighted categories with a letter grade preserved on the record. The logbook shows completed, in-progress, and cancelled flights with status badges. For pilots on the free tier, the logbook displays the last 10 flights — upgrading to a PRO subscription unlocks the full flight history. Flight records include the flight score breakdown (landing quality, bank angle, systems discipline, integrity, and block time), so you can see exactly where points were gained or lost on any past flight.',
    sub: ['Interactive track map replay for every flight', 'Full block time recording (OUT/OFF/ON/IN)', 'Flight score and grade preserved on record', 'Score breakdown by category', 'Free tier: last 10 flights; PRO: full history', 'Fuel, G-force, landing VS all recorded'],
  },
  {
    icon: '📄',
    title: 'Contract Board & SkyOps Missions',
    description: 'The contract board lists special-purpose flights posted by other airlines or generated by the AeroNexus system. Contracts specify an exact route, aircraft category requirement, payload, pilot pay, and an XP bonus. They expire if not accepted within the window. Accepting a contract commits you to completing the flight within the deadline. SkyOps missions are a higher-tier contract type with narrative briefings — they include custom objectives like minimum PAX happiness thresholds, landing quality requirements, or minimum block times. SkyOps missions can optionally integrate with SayIntentions.AI to generate AI-driven ATC and crew briefings based on the mission scenario. Completing contracts earns pilot pay deposited directly to your account and XP toward rank progression.',
    sub: ['Open contract board with route and category filters', 'Pilot pay and XP bonus on every contract', 'Deadline enforcement after acceptance', 'SkyOps missions with custom objectives', 'SayIntentions.AI integration for AI briefings', 'VA-posted contracts (managers can post their own)'],
  },
  {
    icon: '🛡️',
    title: 'Insurance System',
    description: 'AeroNexus models commercial aviation insurance for your virtual airline. Hull insurance covers the loss value of your aircraft in the event of a declared incident. Civil liability insurance covers passenger and third-party claims. Four providers are available — Vantage Aero, RotorGuard, Sentinel Civil, and Civitas Global — each with different coverage tiers (Basic, Standard, Premium), deductible amounts, and monthly premium rates. Premiums are deducted from your airline balance automatically each billing cycle. Insurance claims can be filed for hull damage, flight nullification (voiding a flight that encountered a system error or unjust condition), or passenger liability events. Claims are reviewed against eligibility criteria, with abuse protection built in — a maximum of two claims per 30-day window and a 7-day cooldown between consecutive claims of the same type.',
    sub: ['Hull and civil liability insurance', '4 providers with 3 coverage tiers each', 'Automatic monthly premium deductions', 'Hull damage, flight nullification, and liability claims', 'Anti-abuse rate limiting on claims', 'Claim status tracking (pending, approved, denied)'],
  },
  {
    icon: '🏪',
    title: 'Aircraft Market',
    description: 'Purchase factory-new aircraft from a catalog of 80+ models spanning every category — widebody jets, narrowbody airliners, regional jets, turboprops, helicopters, cargo freighters, private aircraft, and seaplanes. Each aircraft listing includes its full performance specification: ICAO type code, passenger and cargo capacity, cruise speed, max range, MTOW, fuel capacity, engine count, and factory delivery airport. New aircraft are delivered to a hub of your choice for a delivery fee, or you can jumpseat to the factory airport and fly the aircraft back yourself for a flat $150 fee. The used aircraft market lists aircraft sold by other airlines, with condition data including airframe hours, engine wear percentage, maintenance grade, and a seller-determined price compared against a fair market value estimate. Aircraft purchased used carry their maintenance history forward.',
    sub: ['80+ aircraft across all categories', 'Full performance specs on every listing', 'Buy new or purchase used from other airlines', 'Delivery to hub or jumpseat to factory', 'Fair value estimation on used market', 'Lease option with weekly fee calculation'],
  },
  {
    icon: '🤝',
    title: 'Alliance Network',
    description: 'Airlines on AeroNexus can form bilateral alliances with each other. Alliances unlock optional codeshare agreements and lounge access bonuses. To form an alliance, search for another airline by name or ICAO code and send a request with an optional message. The receiving airline\'s manager sees the request in their Alliance page and can accept or decline. Once allied, both airlines can toggle codeshare and lounge bonus features independently. Alliances can be dissolved at any time. Alliance requests are delivered by email so managers are notified promptly even when not logged in.',
    sub: ['Bilateral alliance formation', 'Codeshare and lounge bonus toggles', 'In-platform search for alliance partners', 'Email notification on new requests', 'Accept/decline workflow with optional message', 'Alliance dissolution at any time'],
  },
  {
    icon: '📈',
    title: 'Statistics & Leaderboards',
    description: 'AeroNexus tracks detailed performance statistics for every pilot and airline on the network and publishes network-wide leaderboards. Pilots are ranked across five categories: total flights, total hours, passengers carried, average PAX happiness, and average landing quality. Airlines are ranked across flights, hours, passengers, happiness, and total revenue. The top 25 in each category are displayed with gold, silver, and bronze medals. Airline managers also see an internal leaderboard ranking their own pilots. Personal statistics are available for any time window — this month, last 30/60/90 days, or all time — giving pilots and managers a clear picture of performance trends. Landing quality is interpreted qualitatively (greaser, smooth, firm, hard) to give instant context without requiring pilots to know specific fpm thresholds.',
    sub: ['Network top-25 leaderboards (pilots and airlines)', 'Five ranking categories each', 'Internal airline pilot rankings', 'Adjustable time windows (30/60/90 days, all time)', 'Landing quality qualitative interpretation', 'Reputation and XP tracking'],
  },
  {
    icon: '💳',
    title: 'Banking & Loans',
    description: 'When your airline needs capital for fleet expansion, AeroNexus offers a built-in loan system. Your available credit is calculated as 60% of your net equity (cash balance plus fleet value minus existing debt). Loan applications require a minimum number of completed flights, hours flown, and a reputation threshold to qualify — ensuring loans are only available to established airlines with a track record. Loan terms include weekly, biweekly, or monthly repayment schedules, and daily interest accrues on the outstanding principal. The banking dashboard shows your full credit overview (cash, fleet value, equity, available credit), all active loans with principal/interest breakdowns and payoff progress visualizations, and your loan history. A bankruptcy protection system triggers if your balance falls critically low, locking certain actions until the debt is resolved.',
    sub: ['Credit limit based on net equity (60% of fleet value + cash)', 'Flight history and reputation requirements', 'Weekly, biweekly, or monthly repayment', 'Daily interest accrual', 'Payoff progress visualization', 'Bankruptcy protection system'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-6xl mx-auto border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-[#00D1FF]">NEXUS</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/features" className="text-white font-medium">Features</Link>
          <Link href="/faq" className="hover:text-white transition">FAQ</Link>
          <Link href="/#pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/contact" className="hover:text-white transition">Contact</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition">Login</Link>
          <Link href="/register" className="bg-[#00D1FF] text-black px-5 py-2 rounded-full text-sm font-bold hover:brightness-110 transition">
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-8 py-20 text-center">
        <span className="text-[#00D1FF] font-semibold tracking-widest text-xs uppercase mb-4 block">Platform Features</span>
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">
          Everything your virtual airline needs.
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
          AeroNexus is a complete virtual airline management ecosystem — not a flight tracker bolted onto a spreadsheet. Every feature is designed to reflect how real airline operations actually work.
        </p>
      </div>

      {/* Feature list */}
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="flex flex-col gap-16">
          {features.map((f, i) => (
            <div key={f.title} className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-start ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}>
              <div className={i % 2 === 1 ? 'md:[direction:ltr]' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{f.icon}</span>
                  <h2 className="text-2xl font-bold">{f.title}</h2>
                </div>
                <p className="text-gray-400 leading-relaxed text-sm mb-6">{f.description}</p>
                <ul className="flex flex-col gap-2">
                  {f.sub.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-[#00D1FF] mt-0.5 flex-shrink-0">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`rounded-2xl bg-white/3 border border-white/7 h-52 flex items-center justify-center ${i % 2 === 1 ? 'md:[direction:ltr]' : ''}`}>
                <span className="text-7xl opacity-20">{f.icon}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/5 py-20 text-center px-8">
        <h2 className="text-3xl font-extrabold mb-4">Ready to start your virtual airline?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm">7-day free trial. No credit card required to get started.</p>
        <Link href="/register" className="inline-block bg-[#00D1FF] text-black font-bold px-10 py-4 rounded-xl hover:brightness-110 transition text-sm">
          Create Your Airline →
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-8 text-center">
        <p className="text-gray-600 text-xs">
          © {new Date().getFullYear()} AeroNexus ·{' '}
          <Link href="/features" className="hover:text-gray-400 transition">Features</Link>{' · '}
          <Link href="/faq" className="hover:text-gray-400 transition">FAQ</Link>{' · '}
          <Link href="/privacy" className="hover:text-gray-400 transition">Privacy</Link>{' · '}
          <Link href="/terms" className="hover:text-gray-400 transition">Terms</Link>{' · '}
          <Link href="/contact" className="hover:text-gray-400 transition">Contact</Link>
        </p>
        <p className="text-gray-700 text-xs mt-2 font-bold tracking-widest">THE SKY IS NO LONGER A GRID.</p>
      </footer>
    </div>
  );
}
