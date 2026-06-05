import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ — AeroNexus Virtual Airline Management Platform',
  description: 'Frequently asked questions about AeroNexus — the virtual airline management ecosystem for MSFS 2024 and X-Plane. Learn about subscriptions, ACARS, flights, cargo, crew management, and more.',
  alternates: { canonical: 'https://aeronexus.app/faq' },
  openGraph: {
    title: 'AeroNexus FAQ — Virtual Airline Platform',
    description: 'Everything you need to know about AeroNexus — subscriptions, ACARS, economy, crew management, and more.',
    url: 'https://aeronexus.app/faq',
    type: 'website',
  },
};

const sections = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'What is AeroNexus?',
        a: 'AeroNexus is a full-stack virtual airline management platform built for Microsoft Flight Simulator 2024 and X-Plane. It provides everything a virtual airline operator needs to run a realistic airline: flight dispatch, a living economy with dynamic fuel prices and passenger demand, fleet management, crew management, a cargo freight system, financial reporting, insurance, banking, inter-airline alliances, and a desktop ACARS client that connects directly to your simulator. Pilots who fly independently — without managing their own airline — can also use AeroNexus to track flights, build their logbook, apply to virtual airlines, pick up cargo contracts, and climb network leaderboards.',
      },
      {
        q: 'Is AeroNexus free to use?',
        a: 'AeroNexus offers a 7-day free trial for new airline managers. During the trial you have access to all platform features with no restrictions. After the trial period, a subscription is required to continue operating an airline. Pilots who join an existing airline fly for free — there is no subscription cost for pilots. Independent pilots (those not affiliated with any airline) can also use core features including the logbook, flight booking, cargo board, and contract board without a subscription.',
      },
      {
        q: 'What subscription plans are available?',
        a: 'AeroNexus offers a Startup plan and an Enterprise plan. The Startup plan is designed for smaller virtual airlines and covers core operations. The Enterprise plan is for larger, established airlines and unlocks unlimited pilots, advanced analytics, higher fleet capacity, and priority support. Both plans are available on monthly or annual billing, with annual billing offering a significant discount. A Founder\'s Pass is also available as a one-time lifetime purchase that grants permanent Enterprise-tier access.',
      },
      {
        q: 'Do I need to manage an airline to use AeroNexus?',
        a: 'No. AeroNexus supports two types of users: airline managers and pilots. As a pilot, you can register for free, join an existing virtual airline by submitting an application through the platform, and start flying immediately. Your flights are tracked, your logbook builds up, and your reputation and XP accumulate over time. You can also fly independently — booking flights, picking up cargo, completing contracts, and appearing on the global pilot leaderboard — without being part of any airline.',
      },
      {
        q: 'What simulators are supported?',
        a: 'AeroNexus ACARS currently supports Microsoft Flight Simulator 2024 via SimConnect and X-Plane via a local UDP bridge. The web platform itself is simulator-agnostic — all flight booking, dispatch, logbook, financial, and crew management features work regardless of which simulator you fly. ACARS is required for automatic flight tracking, scoring, and telemetry; manual flight completion is not supported.',
      },
    ],
  },
  {
    title: 'ACARS & Flight Tracking',
    questions: [
      {
        q: 'What is ACARS and do I need it?',
        a: 'ACARS (Aircraft Communications Addressing and Reporting System) is AeroNexus\'s desktop client for Windows. It connects to your simulator and automatically tracks every flight from engine start to engine shutdown — recording block times, live position telemetry, fuel consumption, landing performance, and flight events. ACARS is required to complete flights in AeroNexus. Without it, the system has no way to confirm a flight was actually flown. It is a free download available from your dashboard.',
      },
      {
        q: 'Does ACARS work if my internet drops mid-flight?',
        a: 'Yes. ACARS has a built-in offline buffer that stores up to 10,000 position records in a local SQLite database if your internet connection is lost. As soon as your connection is restored, ACARS automatically flushes the buffered data to the server in the background. Your flight record, track points, and block times are all preserved. Long-haul flights that cross areas of intermittent connectivity are fully supported.',
      },
      {
        q: 'How does ACARS detect flight phases?',
        a: 'ACARS uses a state machine that reads real simulator data — engine combustion state, parking brake position, weight-on-wheels, indicated altitude, and vertical speed — to determine your current phase of flight. It detects taxi, takeoff, climb, cruise, descent, approach, landing, and taxi-in automatically. Descent detection is altitude-based: ACARS waits until you have dropped 1,000 feet below your established cruise altitude before committing to a descent phase, which makes it immune to false triggers from ATC step-downs, turbulence, or brief altitude deviations during cruise.',
      },
      {
        q: 'How are flights scored?',
        a: 'Every completed flight is scored out of 100 points across five categories: Landing Rate (30 points) — awarded based on your touchdown vertical speed, with a perfect greaser below 200 fpm earning full marks; Bank Angle (20 points) — deducted for each excessive bank angle violation above 45 degrees; Speed & Systems (20 points) — deducted for overspeed events; Flight Integrity (15 points) — deducted for time acceleration use or slew mode activation; and Block Time (15 points) — awarded for correctly capturing all four OOOI times (OUT, OFF, ON, IN). Scores map to letter grades: S (95–100), A (85–94), B (70–84), C (55–69), D (40–54), and F (below 40).',
      },
      {
        q: 'Will I be penalized for sim freezes or tile loading stutters?',
        a: 'No. AeroNexus does not penalize pilots for position jumps caused by simulator tile loading, brief freezes, or other sim-side artifacts outside the pilot\'s control. The only flight integrity deductions are for deliberate actions: slew mode activation (which zeroes the integrity score) and time acceleration (which costs 5 points per event). Normal simulator behavior never affects your score.',
      },
      {
        q: 'What happens if ACARS fails to complete my flight?',
        a: 'If ACARS loses connection to the API at the moment of flight completion — for example during a token refresh — it automatically retries the completion call after obtaining a fresh authentication token. If the retry also fails, the flight remains in an active state on the server and can be manually reviewed by support. Contact us through the Contact page if a flight did not complete correctly and provide the flight ID from your ACARS log.',
      },
    ],
  },
  {
    title: 'Economy & Finances',
    questions: [
      {
        q: 'How does the living economy work?',
        a: 'AeroNexus runs a persistent global economy that reacts to actual pilot and airline activity. Fuel prices fluctuate based on each airport\'s proximity to one of eight global fuel distribution hubs — airports close to hubs have lower base prices, while remote strips and island airports are more expensive. Route demand scores reflect how much traffic a route has seen recently: fly a route regularly and demand stays high; neglect it and demand decays. Passenger loads on your flights are calculated using a multi-factor model that considers demand score, your ticket price relative to the market average, your airline\'s reputation, how frequently you fly the route, and how many competing airlines operate the same city pair.',
      },
      {
        q: 'What expenses does my airline incur?',
        a: 'AeroNexus models all major airline operating costs. On every flight: fuel burn (calculated from your aircraft\'s fuel burn rate, adjusted for weight and distance), landing fees (based on airport size), catering (per passenger), gate slot fees, and pilot pay (either a flat rate or a percentage of gross revenue, depending on your expense configuration). Recurring costs include insurance premiums (if you hold active policies) and loan interest (if you have outstanding loans). Capital expenditures include aircraft purchase prices and maintenance costs. All expenses are itemized in your Finances dashboard with full transaction history.',
      },
      {
        q: 'How is my airline\'s revenue calculated?',
        a: 'Revenue on each flight is calculated as: base ticket price × cabin class multiplier × number of passengers in each class, summed across all classes. This gross revenue figure is then subject to your configured deductions (pilot pay, fuel, fees, catering) to produce your net flight profit. Cargo revenue is separate and paid out at flight completion based on the shipment\'s per-kg rate and distance. Contract revenue is paid as the contract\'s declared value on completion. Your airline\'s flight multiplier (configurable between 25% and 100% in Dynamic or Fixed mode) applies a boost to ticket revenue for qualifying flights.',
      },
      {
        q: 'What is the flight revenue multiplier?',
        a: 'The flight revenue multiplier is a configurable bonus that scales your ticket and passenger revenue upward based on route performance. In Dynamic mode, the multiplier adjusts automatically based on factors like load factor, route demand, and PAX happiness. In Fixed mode, you set a specific multiplier value (25%, 35%, 50%, 75%, or 100%) that applies consistently. The multiplier applies to passenger revenue only — cargo revenue is always paid at the raw shipment value with no multiplier.',
      },
      {
        q: 'Can my airline go bankrupt?',
        a: 'Yes. If your airline\'s balance falls critically low — particularly if loan obligations exceed available cash — the platform triggers a bankruptcy state that restricts certain operations until the financial situation is resolved. Bankruptcy is a protection mechanism, not a permanent deletion: airlines can recover by completing revenue-generating flights, selling assets, or resolving outstanding debt. You will receive warnings before the bankruptcy threshold is reached.',
      },
    ],
  },
  {
    title: 'Cargo',
    questions: [
      {
        q: 'How does the cargo system work?',
        a: 'The AeroNexus cargo board is a live marketplace of freight shipments refreshed every 15 minutes. Each shipment has a fixed origin, destination, cargo type, weight, volume, rate per kilogram, and a 6-hour availability window. You claim shipments to reserve them for your airline, then attach them to a booked flight before dispatch. At flight completion, the cargo revenue is automatically credited to your airline\'s balance. Unclaimed shipments expire and return to the pool. Multiple shipments can be loaded onto a single flight as long as combined weight and volume stay within your aircraft\'s belly hold capacity.',
      },
      {
        q: 'What cargo types are available and which pay the most?',
        a: 'AeroNexus has 12 cargo categories with different rate multipliers. The highest-paying categories are Pharmaceuticals (7.5× base rate), Luxury Goods (7.0×), Electronics (5.0×), Humanitarian Aid (5.0×), and Medical Supplies (6.0×). Mid-tier categories include Machinery (4.0×), Automotive Parts (3.5×), Industrial Goods (3.0×), and Mail & Parcels (2.0×). The lowest-paying categories are Textiles (1.2×), Perishables (1.4×), and Fresh Produce (1.0×). High-value cargo types like pharmaceuticals are also ultra-dense, meaning they consume less volume per kilogram — a fully loaded belly of pharmaceuticals earns significantly more than the same weight in fresh produce.',
      },
      {
        q: 'How does cargo capacity work with passengers on board?',
        a: 'When passengers are booked on a flight, AeroNexus reserves 23 kilograms of belly hold capacity per passenger for checked baggage — the IATA standard. This is deducted from your aircraft\'s total cargo hold capacity before the cargo board calculates available freight space. So if your aircraft has a 45,000 kg cargo hold and you have 307 passengers aboard, approximately 7,061 kg is reserved for baggage, leaving around 37,939 kg available for freight. The cargo board\'s capacity bar reflects this automatically.',
      },
    ],
  },
  {
    title: 'Crew & Pilots',
    questions: [
      {
        q: 'How do pilots join a virtual airline on AeroNexus?',
        a: 'Pilots apply to virtual airlines through the AeroNexus platform. Each airline can configure a custom application form with up to 10 questions, which prospective pilots fill out and submit. The airline manager reviews incoming applications in the Crew Center, sees the pilot\'s stats and reputation, and can accept or decline the application with an optional note. Accepted pilots are added to the airline roster immediately. Pilots can also be invited directly by email from the manager.',
      },
      {
        q: 'How does pilot rank progression work?',
        a: 'Each airline can define its own rank structure — a sequence of ranks from entry-level to chief pilot, each with a minimum number of flight hours and completed flights required. AeroNexus automatically promotes pilots when they meet both thresholds for the next rank. Managers can also manually assign or override ranks for any pilot on their roster. If no custom rank structure is defined, the platform uses a default set of standard ranks based on hours flown.',
      },
      {
        q: 'What is pilot reputation and how does it affect flights?',
        a: 'Pilot reputation is a score from 0.0 to 5.0 that reflects your overall flight performance history. It is updated after every completed flight based on PAX happiness. A higher reputation score boosts passenger demand on your flights — the platform applies a reputation factor to passenger load calculations, so well-regarded pilots attract more passengers on the same route. Reputation decays slightly after poor flights and recovers after good ones, keeping it as a live reflection of recent performance rather than a permanent historical average.',
      },
      {
        q: 'Can airline managers restrict what pilots can do?',
        a: 'Yes. AeroNexus has a position-based permission system. Managers create named positions (e.g. First Officer, Captain, Fleet Manager) and assign specific permissions to each: managing cargo, managing finances, managing routes, managing fleet, and managing crew. Pilots are assigned to positions, and their in-platform actions are restricted accordingly. This allows managers to give senior pilots more responsibility while limiting what new hires can access.',
      },
    ],
  },
  {
    title: 'Subscriptions & Billing',
    questions: [
      {
        q: 'What happens when my trial ends?',
        a: 'When your 7-day free trial expires, your airline is placed in a restricted state. You will receive reminder emails at 3 days and 1 day before the trial ends. After expiry, flight dispatch and most management features are locked until you subscribe. Your data — pilots, routes, fleet, and history — is preserved and remains intact. Subscribing at any point restores full access immediately.',
      },
      {
        q: 'What happens if I cancel my subscription?',
        a: 'When you cancel, your airline remains fully accessible until the end of your current billing period. After that date, your airline enters a 30-day grace window during which it is visible on the platform but no new flights can be dispatched. At the end of the 30-day grace window, your airline and all associated data is permanently removed from the AeroNexus ecosystem. If you resubscribe before the deletion date, your airline is fully restored with no data loss.',
      },
      {
        q: 'What is the Founder\'s Pass?',
        a: 'The Founder\'s Pass is a one-time lifetime purchase available to early supporters of AeroNexus. It grants permanent Enterprise-tier access with no recurring subscription fee. Founder\'s Pass holders receive a special badge displayed on their profile and airline, are immune to subscription cancellation restrictions, and retain access regardless of future pricing changes. The Founder\'s Pass is transferable — holders can gift or transfer their Founder status to another user through the platform\'s ownership transfer system.',
      },
      {
        q: 'Can I transfer ownership of my airline to another user?',
        a: 'Yes. Airline managers can initiate an ownership transfer to any registered AeroNexus user by entering their email address. The recipient receives an email notification and a banner on their dashboard showing the transfer request with the airline name and details. They have 48 hours to accept or decline. If accepted, the airline transfers in full — all routes, fleet, pilots, finances, and history carry over to the new manager. The original manager\'s account reverts to Pilot status.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-6xl mx-auto border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-[#00D1FF]">NEXUS</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/features" className="hover:text-white transition">Features</Link>
          <Link href="/faq" className="text-white font-medium">FAQ</Link>
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
      <div className="max-w-3xl mx-auto px-8 py-20 text-center">
        <span className="text-[#00D1FF] font-semibold tracking-widest text-xs uppercase mb-4 block">Frequently Asked Questions</span>
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">How does AeroNexus work?</h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          Everything you need to know about the AeroNexus ecosystem — from getting started to advanced platform features.
        </p>
      </div>

      {/* FAQ sections */}
      <div className="max-w-3xl mx-auto px-8 pb-24">
        {sections.map(section => (
          <div key={section.title} className="mb-16">
            <h2 className="text-xs font-bold text-[#00D1FF] uppercase tracking-widest mb-8 pb-3 border-b border-white/5">
              {section.title}
            </h2>
            <div className="flex flex-col gap-8">
              {section.questions.map(item => (
                <div key={item.q}>
                  <h3 className="text-base font-bold text-white mb-3">{item.q}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div className="rounded-2xl border border-white/7 bg-white/3 p-8 text-center">
          <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
          <p className="text-gray-400 text-sm mb-6">
            Our team typically responds within 24 hours.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-[#00D1FF] text-black font-bold px-8 py-3 rounded-xl text-sm hover:brightness-110 transition"
          >
            Contact Us →
          </Link>
        </div>
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
