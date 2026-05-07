import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — AeroNexus',
  description: 'Privacy Policy for the AeroNexus virtual airline management platform.',
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = 'May 7, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-5xl mx-auto border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-[#00D1FF]">NEXUS</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-white transition">Terms of Use</Link>
          <Link href="/privacy" className="text-white font-medium">Privacy Policy</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="flex flex-col gap-10 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Introduction</h2>
            <p>
              AeroNexus (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your
              privacy. This Privacy Policy explains what information we collect, how we use it, and your rights
              regarding your data when you use the AeroNexus platform, website, and ACARS client (collectively,
              the &quot;Service&quot;).
            </p>
            <p className="mt-3">
              By using the Service, you agree to the collection and use of information as described in this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">2.1 Account Information</h3>
            <p>When you register, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Display name and email address</li>
              <li>Password (stored as a cryptographic hash — we never see your plain password)</li>
              <li>Home airport ICAO code (optional, set by you)</li>
              <li>Profile avatar URL (optional, provided by you)</li>
            </ul>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">2.2 Airline and Flight Data</h3>
            <p>If you create or join a virtual airline, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Airline name, ICAO/IATA codes, hub airports, and branding URLs you provide</li>
              <li>Route definitions, fleet records, and financial transactions (all simulated)</li>
              <li>Flight records including origin, destination, duration, and performance metrics</li>
            </ul>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">2.3 ACARS Telemetry</h3>
            <p>When using the AeroNexus ACARS client during a simulated flight, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Aircraft position (latitude, longitude, altitude) during flight</li>
              <li>Airspeed, heading, vertical speed, and G-force data</li>
              <li>Engine parameters, fuel consumption, and landing metrics</li>
              <li>Flight phase transitions (takeoff, cruise, landing)</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">
              This data is sourced from your flight simulator and used solely to power platform features such as
              the live map, logbook, performance scoring, and fleet maintenance tracking. We do not use this data
              for any purpose unrelated to the Service.
            </p>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">2.4 Payment Information</h3>
            <p>
              Payments are processed by Stripe. AeroNexus does not store your credit card number, CVV, or full
              payment details. We receive a Stripe customer ID and subscription status. Stripe&apos;s privacy
              practices are governed by{' '}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-[#00D1FF] hover:underline">Stripe&apos;s Privacy Policy</a>.
            </p>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">2.5 Usage Data</h3>
            <p>
              We may collect standard server log data including IP addresses, browser type, pages visited, and
              timestamps. This is used for security monitoring, debugging, and improving the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process your subscription and manage billing</li>
              <li>Send transactional emails (account verification, password reset, flight notifications)</li>
              <li>Calculate virtual economy metrics, fuel prices, and pilot statistics</li>
              <li>Display your flight data on the live map and leaderboards (within your airline)</li>
              <li>Detect and prevent fraud, abuse, and violations of our Terms of Use</li>
              <li>Respond to your support requests and legal notices</li>
              <li>Improve and develop new features for the Service</li>
            </ul>
            <p className="mt-3">
              We do not sell, rent, or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Data Sharing</h2>
            <p>We may share your information with:</p>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">4.1 Service Providers</h3>
            <p className="text-gray-400">
              We use the following third-party services to operate the platform:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><strong className="text-gray-300">Railway</strong> — cloud infrastructure hosting (PostgreSQL database, Redis, application servers)</li>
              <li><strong className="text-gray-300">Vercel</strong> — frontend web hosting</li>
              <li><strong className="text-gray-300">Stripe</strong> — payment processing</li>
              <li><strong className="text-gray-300">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-gray-300">NOAA / aviationweather.gov</strong> — weather data (no personal data is sent to this service)</li>
            </ul>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">4.2 Within Your Virtual Airline</h3>
            <p className="text-gray-400">
              Your display name, pilot rank, reputation score, and flight statistics may be visible to other
              members of any virtual airline you join, as well as on network-wide leaderboards. Your email
              address is never shared with other users.
            </p>

            <h3 className="text-sm font-bold text-gray-200 mb-2 mt-4">4.3 Legal Requirements</h3>
            <p className="text-gray-400">
              We may disclose your information if required by law, court order, or to protect the rights,
              property, or safety of AeroNexus, our users, or the public.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you request account deletion,
              we will delete your personal information within 30 days, except where we are required to retain it
              for legal or accounting purposes.
            </p>
            <p className="mt-3">
              Flight telemetry and logbook data are retained for the lifetime of your account and deleted upon
              account closure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1 text-gray-400">
              <li>Passwords stored as bcrypt hashes</li>
              <li>All data transmitted over HTTPS/TLS</li>
              <li>JWT tokens with short expiry and rotation</li>
              <li>Row-level security on the database</li>
              <li>API keys hashed before storage</li>
            </ul>
            <p className="mt-3">
              No method of transmission over the internet is 100% secure. While we strive to protect your data,
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li><strong className="text-gray-300">Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong className="text-gray-300">Correction</strong> — update or correct inaccurate data through your profile settings</li>
              <li><strong className="text-gray-300">Deletion</strong> — request deletion of your account and associated data</li>
              <li><strong className="text-gray-300">Portability</strong> — request an export of your flight logbook and account data</li>
              <li><strong className="text-gray-300">Objection</strong> — object to certain uses of your data</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{' '}
              <a href="mailto:terms@aeronexus.app" className="text-[#00D1FF] hover:underline">terms@aeronexus.app</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to children under 13. We do not knowingly collect personal information
              from children under 13. If you believe a child under 13 has provided us with personal information,
              please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by
              email and by posting the updated Policy on this page with a new effective date. Your continued use
              of the Service after changes are posted constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of the State of Washington, United States. Any disputes
              relating to this Policy are subject to the exclusive jurisdiction of the courts in Thurston County,
              Washington.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contact</h2>
            <p>
              For privacy-related questions, data requests, or concerns, contact us at:
            </p>
            <div className="mt-3 glass-card rounded-xl p-4 text-sm">
              <p className="font-medium text-white">AeroNexus</p>
              <p className="text-gray-400">Privacy &amp; Data Requests</p>
              <a href="mailto:terms@aeronexus.app" className="text-[#00D1FF] hover:underline">
                terms@aeronexus.app
              </a>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-sm text-gray-600">
          <p>&copy; 2026 AeroNexus Ecosystem</p>
          <Link href="/terms" className="text-[#00D1FF] hover:underline">← Terms of Use</Link>
        </div>
      </div>
    </div>
  );
}
