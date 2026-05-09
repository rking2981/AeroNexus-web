'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

interface Section {
  id: string;
  title: string;
  icon: string;
  role?: 'pilot' | 'manager';
  content: React.ReactNode;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold mb-3 text-white">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold mb-2 text-aero">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 mb-3 leading-relaxed">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm text-gray-400 mb-3 space-y-1.5 list-disc list-inside leading-relaxed">{children}</ul>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-aero/5 border border-aero/20 px-4 py-3 text-sm text-aero mb-3">
      💡 {children}
    </div>
  );
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 text-sm text-amber-300 mb-3">
      ⚠️ {children}
    </div>
  );
}
function Badge({ children, color = 'aero' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    aero:    'text-aero border-aero/20 bg-aero/10',
    purple:  'text-purple-400 border-purple-500/20 bg-purple-500/10',
    green:   'text-green-400 border-green-500/20 bg-green-500/10',
    amber:   'text-amber-400 border-amber-500/20 bg-amber-500/10',
    red:     'text-red-400 border-red-500/20 bg-red-500/10',
  };
  return <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', colors[color])}>{children}</span>;
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Dashboard Overview',
    icon: '🏠',
    content: (
      <>
        <H2>Dashboard Overview</H2>
        <P>The main dashboard is your home base. It shows your most important information at a glance and provides quick links to the areas you use most.</P>
        <H3>Quick Actions</H3>
        <UL>
          <LI><strong className="text-white">Book Flight</strong> — Jump straight to route selection and dispatch a new flight.</LI>
          <LI><strong className="text-white">Logbook</strong> — View your personal flight history and statistics.</LI>
          <LI><strong className="text-white">Live Map</strong> — See all active flights across the AeroNexus network in real time.</LI>
          <LI><strong className="text-white">My Stats</strong> — View your leaderboard position and personal performance metrics.</LI>
        </UL>
        <H3>Manager Quick Actions</H3>
        <P>If you manage a virtual airline, additional cards appear for Airline overview, Fleet, Routes & Hubs, Crew Center, Finances, and Promotions.</P>
        <Tip>If you don't have an airline yet, a card will prompt you to create one. You can start with a free Startup plan.</Tip>
      </>
    ),
  },
  {
    id: 'booking',
    title: 'Booking a Flight',
    icon: '✈️',
    content: (
      <>
        <H2>Booking a Flight</H2>
        <P>To fly, you must be a member of a virtual airline that has active routes. Once you've joined an airline, navigate to <strong className="text-white">Book Flight</strong>.</P>
        <H3>Step 1 — Select a Route</H3>
        <UL>
          <LI>Browse your airline's active routes. Each card shows the flight number, origin, destination, distance, estimated duration, and ticket price.</LI>
          <LI>Routes are colour-coded by demand. Higher demand means more passengers and more revenue.</LI>
          <LI>Helicopter routes use direct point-to-point navigation — no airways required.</LI>
        </UL>
        <H3>Step 2 — Select an Aircraft</H3>
        <UL>
          <LI>Only aircraft assigned to your airline and compatible with the route type are shown.</LI>
          <LI>Engine wear is displayed as a percentage. Aircraft above 80% wear should be maintained before flying.</LI>
          <LI>Maintenance grade (A–F) affects resale value and is visible here.</LI>
        </UL>
        <H3>Step 3 — Review & Dispatch</H3>
        <UL>
          <LI>The booking screen shows your estimated passenger count, load factor, fuel cost, and expected revenue.</LI>
          <LI>Click <strong className="text-white">Dispatch</strong> to begin the flight. Your flight status will change to <Badge>BOARDING</Badge>.</LI>
        </UL>
        <H3>Flight States</H3>
        <P>Progress your flight through these states manually (or via ACARS if connected):</P>
        <UL>
          <LI><Badge>BOARDING</Badge> → <Badge>TAXI</Badge> → <Badge>TAKEOFF</Badge> → <Badge>CLIMB</Badge> → <Badge>CRUISE</Badge> → <Badge>DESCENT</Badge> → <Badge>LANDED</Badge> → <Badge color="green">COMPLETED</Badge></LI>
        </UL>
        <Tip>You can only have one active flight at a time. Complete or cancel your current flight before booking a new one.</Tip>
        <Warn>Cancelling a flight in TAKEOFF or later stages will count as an incomplete flight and may affect your reputation.</Warn>
      </>
    ),
  },
  {
    id: 'logbook',
    title: 'Logbook',
    icon: '📋',
    content: (
      <>
        <H2>Logbook</H2>
        <P>Your logbook is a permanent record of every flight you've completed on AeroNexus.</P>
        <H3>Summary Cards</H3>
        <UL>
          <LI><strong className="text-white">Completed Flights</strong> — Total number of flights you've finished.</LI>
          <LI><strong className="text-white">Total Hours</strong> — Cumulative flight time across all flights.</LI>
          <LI><strong className="text-white">Total Distance</strong> — Nautical miles flown lifetime.</LI>
          <LI><strong className="text-white">Avg PAX Happiness</strong> — Your average passenger satisfaction score.</LI>
        </UL>
        <H3>Flight Details</H3>
        <P>Click any flight in the list to open the detail panel. This shows:</P>
        <UL>
          <LI>Route map with origin and destination markers</LI>
          <LI>Aircraft type and registration</LI>
          <LI>Departure and arrival times</LI>
          <LI>Fuel burn, PAX happiness score, landing vertical speed</LI>
          <LI>Revenue earned (completed flights only)</LI>
        </UL>
        <Warn>Free tier pilots can only see their last 10 flights. Upgrade to a paid plan or join an Enterprise airline for full history access.</Warn>
      </>
    ),
  },
  {
    id: 'livemap',
    title: 'Live Map',
    icon: '🗺️',
    content: (
      <>
        <H2>Live Map</H2>
        <P>The Live Map shows every active flight across the AeroNexus network updating in real time every 10 seconds.</P>
        <H3>Flight Board</H3>
        <P>The Solari-style flip board on the right lists all active flights with:</P>
        <UL>
          <LI>Flight number and airline</LI>
          <LI>Origin and destination ICAO codes</LI>
          <LI>Current altitude and speed</LI>
          <LI>Flight status</LI>
        </UL>
        <H3>Map Interaction</H3>
        <UL>
          <LI>Click any flight marker on the map to highlight it in the board.</LI>
          <LI>Click a flight in the board to pan the map to that aircraft.</LI>
        </UL>
        <Tip>The live map is public — anyone can view it, including non-members browsing the AeroNexus website.</Tip>
      </>
    ),
  },
  {
    id: 'stats',
    title: 'Stats & Leaderboards',
    icon: '📈',
    content: (
      <>
        <H2>Stats & Leaderboards</H2>
        <P>Track your performance and see how you rank against other pilots and airlines on the network.</P>
        <H3>Tabs</H3>
        <UL>
          <LI><strong className="text-white">Network</strong> — Global leaderboards for top airlines and top pilots.</LI>
          <LI><strong className="text-white">My Airline</strong> — Leaderboard of pilots within your airline (managers only).</LI>
          <LI><strong className="text-white">My Stats</strong> — Your personal performance breakdown.</LI>
        </UL>
        <H3>Time Filters</H3>
        <P>Filter leaderboards by This Month, Last 30/60/90 Days, or All Time.</P>
        <H3>Reputation (0.0 – 5.0)</H3>
        <P>Your reputation score is a weighted average of:</P>
        <UL>
          <LI>PAX happiness per flight</LI>
          <LI>Landing smoothness (vertical speed at touchdown)</LI>
          <LI>On-time performance</LI>
        </UL>
        <Tip>Pilots with reputation ≥ 4.0 receive automatic approval on flight nullification insurance claims.</Tip>
      </>
    ),
  },
  {
    id: 'airports',
    title: 'Airport Directory',
    icon: '🏢',
    content: (
      <>
        <H2>Airport Directory</H2>
        <P>AeroNexus has the largest airport database of any VA platform — <strong className="text-white">85,289 real-world facilities</strong> including every airport, heliport, seaplane base, and remote landing strip.</P>
        <H3>Searching</H3>
        <UL>
          <LI>Search by ICAO code, airport name, or city.</LI>
          <LI>Filter by facility type: Large Airport, Medium Airport, Small Airport, Heliport, Seaplane Base.</LI>
        </UL>
        <H3>Airport Detail</H3>
        <P>Click any airport to see:</P>
        <UL>
          <LI>Coordinates, elevation, and timezone</LI>
          <LI>Current demand level (affects ticket prices)</LI>
          <LI>Runway details: surface type, length, lighting</LI>
          <LI>Nearest fuel distribution hub and fuel price</LI>
        </UL>
        <Tip>Heliports and seaplane bases charge a 20% remote handling fee on fuel. Factor this into your route planning.</Tip>
      </>
    ),
  },
  {
    id: 'profile',
    title: 'Profile',
    icon: '👤',
    content: (
      <>
        <H2>Profile</H2>
        <P>Your profile page shows your pilot identity, statistics, certifications, and account settings.</P>
        <H3>Overview Tab</H3>
        <UL>
          <LI>Avatar, display name, home airport, and reputation badge</LI>
          <LI>Stats cards: total flights, hours, PAX happiness, landing VS</LI>
          <LI>PAX happiness trend chart</LI>
          <LI>Recent flights table</LI>
          <LI>Type ratings and certifications earned</LI>
        </UL>
        <H3>Edit Profile</H3>
        <UL>
          <LI>Update your display name, avatar URL, and home airport</LI>
          <LI>Change your password</LI>
          <LI>Connect SimBrief for OFP generation</LI>
          <LI>Connect SayIntentions.AI for AI crew briefings</LI>
          <LI>Link your Discord account for server roles</LI>
        </UL>
        <H3>Linking Discord</H3>
        <UL>
          <LI>Run <code className="text-aero">/link start</code> in the AeroNexus Discord server</LI>
          <LI>Copy the code and paste it into the Link Discord section here</LI>
          <LI>Return to Discord and run <code className="text-aero">/link verify</code> with the same code</LI>
        </UL>
        <Tip>Linking your Discord grants you verified roles in the AeroNexus server based on your account status — Pilot, VA Manager, and Founder roles are assigned automatically.</Tip>
      </>
    ),
  },
  {
    id: 'contracts',
    title: 'Contract Board',
    icon: '📄',
    role: 'pilot',
    content: (
      <>
        <H2>Contract Board</H2>
        <P>The Contract Board is where pilots find and accept special missions and cargo contracts posted by airlines or the platform.</P>
        <H3>Open Board</H3>
        <UL>
          <LI>Browse available contracts filtered by category, origin, and destination.</LI>
          <LI>Each contract shows the route, required aircraft type, pilot pay, and XP bonus.</LI>
          <LI>Click <strong className="text-white">Accept</strong> to take a contract — it's then reserved for you.</LI>
        </UL>
        <H3>SkyOps Missions</H3>
        <P>SkyOps are narrative missions with AI-generated briefings. They include special objectives, unique scenarios, and bonus rewards. Requires a SayIntentions.AI API key to unlock AI crew briefings.</P>
        <H3>My Contracts</H3>
        <P>Shows contracts you've accepted that are pending completion. You can cancel a contract here if needed.</P>
        <Warn>Contracts have expiry times. If you don't complete a contract before it expires, it returns to the open board.</Warn>
      </>
    ),
  },
  {
    id: 'airline',
    title: 'My Airline',
    icon: '🏢',
    role: 'manager',
    content: (
      <>
        <H2>My Airline</H2>
        <P>The airline overview shows your virtual airline's current status, balance, and quick links to all management areas.</P>
        <H3>Balance Card</H3>
        <P>Shows your airline's current spendable balance in your chosen currency. This is the funds available for purchases, maintenance, insurance, and other expenses.</P>
        <H3>Quick Links</H3>
        <UL>
          <LI><strong className="text-white">Fleet</strong> — Manage your aircraft, cabin configs, and maintenance.</LI>
          <LI><strong className="text-white">Routes & Hubs</strong> — Add routes and manage your hub airports.</LI>
          <LI><strong className="text-white">Crew Center</strong> — Manage pilots, applications, and ranks.</LI>
          <LI><strong className="text-white">Finances</strong> — View your transaction ledger and apply for loans.</LI>
          <LI><strong className="text-white">Promotions</strong> — Advertise your airline on the platform (coming soon).</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'airline-settings',
    title: 'Airline Settings',
    icon: '⚙️',
    role: 'manager',
    content: (
      <>
        <H2>Airline Settings</H2>
        <H3>General Tab</H3>
        <UL>
          <LI>Update your airline name, IATA code, hub country, and operating currency.</LI>
          <LI>Currency affects all balances, transactions, and market prices displayed in your airline.</LI>
        </UL>
        <H3>Branding Tab</H3>
        <UL>
          <LI>Set your airline logo URL and banner image.</LI>
          <LI><Badge color="aero">Enterprise</Badge> — Unlock custom primary and secondary brand colours.</LI>
          <LI>Set your VA website slug (e.g. <code className="text-aero">myairline.aeronexus.app</code>).</LI>
        </UL>
        <H3>Expenses Tab</H3>
        <P>Configure how your airline's operating costs are calculated per flight:</P>
        <UL>
          <LI>Cost per flight, per passenger, per landing, per nautical mile</LI>
          <LI>These are deducted automatically when flights are completed</LI>
        </UL>
        <H3>Subscription Tab</H3>
        <UL>
          <LI>View your current plan (Startup, Enterprise, or Founders).</LI>
          <LI>Access the Stripe billing portal to update payment details or cancel.</LI>
        </UL>
        <H3>Transfer Ownership Tab</H3>
        <P>Transfer your airline and Founder status to another pilot. Requires 30 days of ownership. The recipient has 48 hours to accept.</P>
        <Warn>Transferring ownership removes your VA Manager role and Founder badge. The receiving pilot inherits both.</Warn>
      </>
    ),
  },
  {
    id: 'fleet',
    title: 'Fleet',
    icon: '🛩️',
    role: 'manager',
    content: (
      <>
        <H2>Fleet</H2>
        <P>Manage every aircraft in your airline's fleet — from purchasing and configuring cabins to tracking wear and scheduling maintenance.</P>
        <H3>Fleet Summary</H3>
        <UL>
          <LI>Cards at the top show total aircraft, active, in maintenance, and aircraft with critical wear.</LI>
        </UL>
        <H3>Aircraft List</H3>
        <UL>
          <LI>Each row shows registration, aircraft type, status, airframe hours, engine wear %, and rotor wear % (helicopters).</LI>
          <LI>Click an aircraft to expand the management panel.</LI>
        </UL>
        <H3>Cabin Configuration</H3>
        <UL>
          <LI>Configure seat counts per cabin class (Economy, Business, First).</LI>
          <LI>Set price multipliers per class to adjust ticket revenue.</LI>
          <LI>A visual diagram shows your seating layout.</LI>
        </UL>
        <H3>Wear & Maintenance</H3>
        <UL>
          <LI>Engine wear increases +0.1% per flight hour, +0.5% if N1 exceeds 95% for 5+ minutes.</LI>
          <LI>At 90%+ wear there is a 5% chance of critical failure per flight.</LI>
          <LI>Schedule A/B/C/D checks to reset wear and maintain your maintenance grade.</LI>
        </UL>
        <H3>Selling Aircraft</H3>
        <UL>
          <LI>List any aircraft on the used market with a custom asking price.</LI>
          <LI>The system shows a fair market value estimate based on hours and grade.</LI>
        </UL>
        <Tip>Maintenance grade directly affects resale value. Keep it above B to protect your investment.</Tip>
      </>
    ),
  },
  {
    id: 'add-aircraft',
    title: 'Adding Aircraft',
    icon: '➕',
    role: 'manager',
    content: (
      <>
        <H2>Adding Aircraft</H2>
        <P>Purchase new aircraft directly from the manufacturer or browse the used market in the Aircraft Market section.</P>
        <H3>New from Manufacturer</H3>
        <UL>
          <LI>Search by manufacturer name, aircraft name, or ICAO type code.</LI>
          <LI>Select the aircraft type to see full specs: capacity, range, engine type, max speed.</LI>
          <LI>Enter a registration number (must be unique across the platform).</LI>
          <LI>The purchase price is deducted from your airline balance immediately.</LI>
          <LI>Aircraft are delivered from their real-world factory airport — you must ferry them to your hub.</LI>
        </UL>
        <Warn>Make sure you have sufficient balance before purchasing. The system will warn you if funds are insufficient.</Warn>
        <Tip>Boeing 737s come from KRNT Renton, Airbus A320s from LFBO Toulouse, helicopters from their respective manufacturer bases.</Tip>
      </>
    ),
  },
  {
    id: 'network',
    title: 'Routes & Hubs',
    icon: '🌐',
    role: 'manager',
    content: (
      <>
        <H2>Routes & Hubs</H2>
        <H3>Routes Tab</H3>
        <UL>
          <LI>Add new routes by selecting origin and destination airports, assigning a flight number, and choosing the route type (Commercial, Cargo, Charter, Helicopter).</LI>
          <LI>Each route card shows a mini arc map, demand bar, METAR weather, and current status.</LI>
          <LI>Set waypoints for complex routing.</LI>
          <LI>Create a reverse route (A→B and B→A) in one click.</LI>
          <LI>Suspend routes temporarily without deleting them.</LI>
        </UL>
        <H3>Hubs Tab</H3>
        <UL>
          <LI>Add airports as primary or secondary hubs for your airline.</LI>
          <LI>Hub detail shows runways, elevation, coordinates, timezone, and demand level.</LI>
        </UL>
        <H3>Route Demand</H3>
        <P>Demand is calculated dynamically based on:</P>
        <UL>
          <LI>Local time at the destination (morning business peak: +40% at 07:00–09:00)</LI>
          <LI>Route saturation — 3+ pilots flying the same route drops revenue 15%</LI>
          <LI>Seasonal events and fuel crises</LI>
        </UL>
        <Tip>Helicopter routes use direct point-to-point routing with no airways — perfect for hospital pads, offshore platforms, and remote strips.</Tip>
      </>
    ),
  },
  {
    id: 'crew',
    title: 'Crew Center',
    icon: '👥',
    role: 'manager',
    content: (
      <>
        <H2>Crew Center</H2>
        <H3>Roster Tab</H3>
        <UL>
          <LI>View all pilots in your airline with their stats: flights, hours, reputation, average landing VS.</LI>
          <LI>Add a pilot directly by their AeroNexus email address.</LI>
          <LI>Click a pilot to open their detail panel — set VA rank, suspend, or ban.</LI>
        </UL>
        <H3>Applications Tab</H3>
        <UL>
          <LI>Review incoming applications from pilots who applied via your application form.</LI>
          <LI>See their answers to your custom questions.</LI>
          <LI>Accept or decline with one click.</LI>
        </UL>
        <H3>Application Form Tab</H3>
        <UL>
          <LI>Create custom questions for pilot applicants.</LI>
          <LI>Open or close the application form to control when pilots can apply.</LI>
        </UL>
        <H3>Rank Structure Tab</H3>
        <UL>
          <LI>View and customise your airline's rank tiers.</LI>
          <LI>Set minimum flight hours and flight count requirements per rank.</LI>
        </UL>
        <H3>Airline Bans Tab</H3>
        <UL>
          <LI>View all pilots banned from your airline.</LI>
          <LI>Lift a ban to allow a pilot to reapply.</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'finances',
    title: 'Finances',
    icon: '💰',
    role: 'manager',
    content: (
      <>
        <H2>Finances</H2>
        <H3>Overview Tab</H3>
        <UL>
          <LI>Balance, total revenue, total expenses, and net profit for the selected period.</LI>
          <LI>Use quick filters (All Time, YTD, Weekly, Daily) or select a specific month/year.</LI>
          <LI>Transaction ledger shows every credit and debit with type, description, route, amount, and timestamp.</LI>
        </UL>
        <H3>Transaction Types</H3>
        <UL>
          <LI><Badge color="green">Revenue</Badge> — Flight ticket sales, cargo contracts, promotions.</LI>
          <LI><Badge color="red">Expense</Badge> — Fuel, maintenance, insurance premiums, loan repayments.</LI>
          <LI><Badge color="amber">Market</Badge> — Aircraft purchases and sales.</LI>
          <LI><Badge color="aero">Escrow</Badge> — Funds frozen during downgrade protection.</LI>
        </UL>
        <H3>Banking Tab</H3>
        <UL>
          <LI>View your current credit standing and loan history.</LI>
          <LI>Apply for a loan — interest rates vary based on your airline's financial health.</LI>
          <LI>Active loans show remaining balance, next payment date, and a repay button.</LI>
        </UL>
        <Warn>Downgrading from Enterprise to Startup freezes funds above $5M + earned income in escrow until you re-upgrade.</Warn>
      </>
    ),
  },
  {
    id: 'insurance',
    title: 'Insurance',
    icon: '🛡️',
    role: 'manager',
    content: (
      <>
        <H2>Insurance</H2>
        <P>Protect your airline's assets and flights with policies from AeroNexus's fictional insurance providers.</P>
        <H3>Insurers</H3>
        <UL>
          <LI><strong className="text-white">Vantage Aero Underwriters</strong> — <Badge color="aero">Enterprise</Badge> Hull coverage. 90% coverage, 5% deductible. Best for widebody fleets.</LI>
          <LI><strong className="text-white">RotorGuard Mutual</strong> — Helicopter specialist. 85% coverage, 10% deductible. Requires active helicopter hull.</LI>
          <LI><strong className="text-white">Sentinel Civil Assurance</strong> — Civil liability. $50,000 flat deductible. Covers flight nullification and PAX liability.</LI>
          <LI><strong className="text-white">Civitas Global Indemnity</strong> — <Badge color="aero">Alliance</Badge> Codeshare liability. 88% coverage, 8% deductible. Requires active alliance membership.</LI>
        </UL>
        <H3>Policy Tiers</H3>
        <P>Each insurer offers Basic, Standard, and Premium tiers with different premiums and coverage levels.</P>
        <H3>Flight Nullification Claims</H3>
        <P>If your simulator crashes or disconnects mid-flight, file a nullification claim with Sentinel Civil within 24 hours:</P>
        <UL>
          <LI>Pilots with reputation ≥ 4.0 receive automatic approval.</LI>
          <LI>Maximum 2 claims per 30-day period.</LI>
          <LI>7-day cooldown between claims.</LI>
          <LI>Disconnects after landing are flagged for manual admin review.</LI>
        </UL>
        <Tip>Keep your reputation above 4.0 to get instant nullification claim approvals without waiting for admin review.</Tip>
      </>
    ),
  },
  {
    id: 'alliances',
    title: 'Alliances',
    icon: '🤝',
    role: 'manager',
    content: (
      <>
        <H2>Alliances</H2>
        <P>Form alliances with other virtual airlines to unlock codeshare agreements, lounge bonuses, and access to Civitas Global insurance.</P>
        <H3>Active Tab</H3>
        <UL>
          <LI>View all your current alliance partners.</LI>
          <LI>Toggle <strong className="text-white">Codeshare</strong> — enables revenue sharing on shared routes.</LI>
          <LI>Toggle <strong className="text-white">Lounge Bonus</strong> — PAX happiness bonus on shared hub airports.</LI>
          <LI>Leave an alliance at any time.</LI>
        </UL>
        <H3>Requests Tab</H3>
        <UL>
          <LI>View incoming alliance requests and accept or decline them.</LI>
          <LI>View sent requests and cancel if needed.</LI>
        </UL>
        <H3>Find Airlines Tab</H3>
        <UL>
          <LI>Search for other airlines by name or ICAO code.</LI>
          <LI>Send an alliance request with an optional message.</LI>
        </UL>
        <Tip>Alliance membership is required to purchase Civitas Global Indemnity insurance, which covers inter-airline codeshare liability.</Tip>
      </>
    ),
  },
  {
    id: 'market',
    title: 'Aircraft Market',
    icon: '🏪',
    content: (
      <>
        <H2>Aircraft Market</H2>
        <P>The aircraft market is where airlines buy and sell used aircraft player-to-player, and where you can lease aircraft from other VAs.</P>
        <H3>Buying</H3>
        <UL>
          <LI>Browse listings from other airlines. Each listing shows the aircraft type, registration, hours, engine wear, maintenance grade, and asking price.</LI>
          <LI>The system shows a fair market value estimate for comparison.</LI>
          <LI>Purchase immediately — funds transfer between airlines instantly.</LI>
        </UL>
        <H3>Selling</H3>
        <UL>
          <LI>List any aircraft from your Fleet page with a custom asking price.</LI>
          <LI>Aircraft remain in your fleet and available for flights until sold.</LI>
          <LI>Cancel a listing at any time.</LI>
        </UL>
        <H3>Leasing</H3>
        <UL>
          <LI>Lease aircraft from other airlines with a weekly payment schedule.</LI>
          <LI>Missed payments trigger repossession — the hull is locked at its current airport.</LI>
        </UL>
        <Tip>Maintenance grade significantly affects market value. A grade-A aircraft can command a premium over fair market value.</Tip>
      </>
    ),
  },
  {
    id: 'founders',
    title: "Founder's Pass",
    icon: '🎖️',
    content: (
      <>
        <H2>Founder's Pass</H2>
        <P>The Founder's Pass is a limited lifetime membership — only 100 passes will ever be sold. It grants permanent Enterprise access with no monthly fees and an exclusive Founder badge.</P>
        <H3>What You Get</H3>
        <UL>
          <LI>Lifetime Enterprise tier — 500 pilots, 200 hulls, full branding, alliance management, Public API</LI>
          <LI>No monthly fees, ever</LI>
          <LI>Exclusive Founder badge shown on your profile and in the Discord server</LI>
          <LI>Early access to new features</LI>
          <LI>Direct developer feedback channel</LI>
        </UL>
        <H3>Purchasing</H3>
        <UL>
          <LI>Click the <strong className="text-white">Buy Pass — $199</strong> tab and complete the Stripe checkout.</LI>
          <LI>A gift code is emailed to you after payment.</LI>
          <LI>Redeem the code on the <strong className="text-white">Redeem Code</strong> tab.</LI>
        </UL>
        <H3>Gifting</H3>
        <P>Founder codes are gift codes — you can purchase one and give the code to another pilot to redeem. Codes expire 30 days after purchase.</P>
        <H3>Transferring</H3>
        <P>Founder status transfers with your airline if you use the Transfer VA Ownership feature. The new owner inherits the Founder tier and badge.</P>
        <Warn>Once all 100 passes are claimed, the Founder's Pass will never be available again.</Warn>
      </>
    ),
  },
];

export default function HelpPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'VA_MANAGER' || user?.role === 'PLATFORM_ADMIN';
  const [activeId, setActiveId] = useState('overview');
  const [search, setSearch] = useState('');

  const filtered = SECTIONS.filter(s => {
    if (s.role === 'manager' && !isManager) return false;
    if (search) {
      return s.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const active = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0">
        <div className="glass-card rounded-2xl p-3 sticky top-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-aero focus:outline-none mb-2"
          />
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider px-2 py-1">Help Topics</p>
          <nav className="flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
            {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveId(s.id); setSearch(''); }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition text-left',
                  activeId === s.id
                    ? 'bg-aero/10 text-aero font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <span>{s.icon}</span>
                <span className="truncate">{s.title}</span>
                {s.role === 'manager' && (
                  <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0">MGR</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="glass-card rounded-2xl p-8">
          {active.content}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Need more help? Join the{' '}
              <a href="https://discord.gg/aeronexus" target="_blank" rel="noopener noreferrer" className="text-aero hover:underline">
                AeroNexus Discord
              </a>
            </p>
            <a
              href="https://github.com/rking2981/AeroNexus/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white transition"
            >
              Full documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
