import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use — AeroNexus',
  description: 'Terms of Use for the AeroNexus virtual airline management platform.',
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = 'May 7, 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-5xl mx-auto border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tighter italic">
          AERO<span className="text-[#00D1FF]">NEXUS</span>
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/terms" className="text-white font-medium">Terms of Use</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-extrabold mb-2">Terms of Use</h1>
        <p className="text-gray-500 text-sm mb-12">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="flex flex-col gap-10 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the AeroNexus platform, website, or any associated services (collectively, the
              &quot;Service&quot;), you agree to be bound by these Terms of Use (&quot;Terms&quot;). If you do not agree
              to these Terms, do not use the Service.
            </p>
            <p className="mt-3">
              AeroNexus reserves the right to modify these Terms at any time. Continued use of the Service after
              any modification constitutes your acceptance of the updated Terms. We will notify registered users
              of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Description of Service</h2>
            <p>
              AeroNexus is a virtual airline management simulation platform designed for use with Microsoft Flight
              Simulator 2024, X-Plane, and other compatible flight simulation software. The Service provides tools
              for creating and managing virtual airlines, tracking simulated flights, managing virtual fleets, and
              participating in a simulated aviation economy.
            </p>
            <p className="mt-3 font-medium text-amber-400 text-sm">
              AeroNexus is a simulation platform only. Nothing on this platform constitutes real aviation advice,
              instruction, certification, or operational guidance. All data, routes, economics, and flight
              information are fictional and for entertainment purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Account Registration</h2>
            <p>To access certain features, you must register for an account. You agree to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>Provide accurate, current, and complete registration information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
              <li>Notify us immediately at <a href="mailto:terms@aeronexus.app" className="text-[#00D1FF] hover:underline">terms@aeronexus.app</a> of any unauthorized use</li>
            </ul>
            <p className="mt-3">
              You must be at least 13 years of age to create an account. If you are under 18, you represent that
              you have parental or guardian consent to use the Service.
            </p>
            <p className="mt-3">
              AeroNexus reserves the right to refuse registration or cancel accounts at its sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Subscriptions and Billing</h2>
            <p>
              AeroNexus offers free and paid subscription tiers. Paid subscriptions are billed through Stripe,
              a third-party payment processor. By subscribing, you agree to Stripe&apos;s terms of service in
              addition to these Terms.
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>You may cancel your subscription at any time through your account settings</li>
              <li>Refunds are not provided for partial billing periods, except where required by applicable law</li>
              <li>The Founder&apos;s Pass is a one-time, lifetime purchase and is non-refundable once redeemed</li>
              <li>AeroNexus reserves the right to change subscription pricing with 30 days&apos; notice to existing subscribers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Virtual Currency and In-Game Economy</h2>
            <p>
              AeroNexus uses a virtual in-game currency and economy system for simulation purposes. All balances,
              assets, aircraft, routes, and financial data within the platform are virtual and have no real-world
              monetary value. Virtual assets:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>Cannot be exchanged for real currency</li>
              <li>Cannot be transferred between accounts</li>
              <li>May be modified, reset, or removed by AeroNexus at any time</li>
              <li>Are forfeited upon account termination</li>
            </ul>
            <p className="mt-3">
              The in-game economy is calibrated for simulated play at a casual pace of 1–5 flights per day.
              Pricing, revenue, and expenses are intentionally scaled to feel meaningful within this context
              and do not reflect real-world aviation economics.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5a. Simulated Banking and Loan System</h2>
            <p>
              AeroNexus provides a simulated in-game banking system that allows virtual airlines to apply for
              simulated loans. These are entirely fictional financial instruments with no real-world legal or
              financial standing. By using the loan system, you acknowledge:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>All loans, interest rates, and repayment terms are virtual and have no real-world monetary value</li>
              <li>Simulated loan disbursements are credited to your virtual airline balance only</li>
              <li>Monthly repayments are automatically deducted from your virtual airline balance</li>
              <li>Failure to maintain sufficient balance for repayment may result in a simulated loan default,
                  which affects your in-game reputation score but carries no real-world financial consequences</li>
              <li>AeroNexus is not a bank, lender, or financial institution and this system is purely a
                  gameplay mechanic within a flight simulation platform</li>
              <li>Loan parameters (amounts, rates, terms, eligibility) may be adjusted at any time to
                  maintain balanced gameplay</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2 text-gray-400">
              <li>Exploit bugs, glitches, or unintended mechanics to gain unfair advantages in the virtual economy</li>
              <li>Inject false or fabricated flight data into the platform</li>
              <li>Attempt to reverse-engineer, decompile, or modify the platform</li>
              <li>Use automated scripts, bots, or tools to manipulate the Service</li>
              <li>Harass, threaten, or harm other users</li>
              <li>Violate any applicable local, state, national, or international law or regulation</li>
              <li>Impersonate AeroNexus staff or other users</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
            </ul>
            <p className="mt-3">
              Violation of these rules may result in immediate account suspension or termination without refund.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. User Content and Airline Branding</h2>
            <p>
              Users may submit content to the platform including virtual airline names, ICAO codes, logos, and
              branding (&quot;User Content&quot;). You retain ownership of User Content you create. By submitting
              User Content, you grant AeroNexus a non-exclusive, worldwide, royalty-free license to display and
              use that content solely in connection with operating the Service.
            </p>
            <p className="mt-3">
              <strong className="text-white">You are solely responsible for your User Content.</strong> AeroNexus
              does not verify, endorse, or claim ownership of any airline names, logos, or identities created by
              users. If you choose to reference or replicate real-world airline trademarks, trade names, or logos,
              you do so at your own risk and must ensure you have the right to use them.
            </p>
            <p className="mt-3">
              AeroNexus owns and retains all rights to the AeroNexus name, logo, platform design, code, and
              branding. Nothing in these Terms grants you any right to use AeroNexus&apos;s intellectual property.
            </p>
            <p className="mt-3">
              We reserve the right to remove User Content that infringes third-party intellectual property rights,
              violates these Terms, or is otherwise objectionable, at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. ACARS Client and Third-Party Software</h2>
            <p>
              The AeroNexus ACARS client interacts with third-party flight simulation software including
              Microsoft Flight Simulator 2024 and X-Plane. Your use of those products is governed by their
              respective terms of service. AeroNexus is not affiliated with, endorsed by, or sponsored by
              Microsoft, Asobo Studio, Laminar Research, or any aircraft manufacturer referenced in the platform.
            </p>
            <p className="mt-3">
              ACARS telemetry data (flight position, speed, altitude, etc.) is collected solely for simulation
              purposes and to provide platform features. See our{' '}
              <Link href="/privacy" className="text-[#00D1FF] hover:underline">Privacy Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Termination</h2>
            <p>
              AeroNexus may suspend or terminate your account at any time, with or without notice, for conduct
              that we believe violates these Terms, is harmful to other users, the Service, or third parties, or
              for any other reason at our sole discretion.
            </p>
            <p className="mt-3">
              You may terminate your account at any time by contacting us at{' '}
              <a href="mailto:terms@aeronexus.app" className="text-[#00D1FF] hover:underline">terms@aeronexus.app</a>.
              Upon termination, your right to use the Service ceases immediately and all virtual assets are
              forfeited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
              KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-3">
              AeroNexus does not warrant that the Service will be uninterrupted, error-free, or free of viruses
              or other harmful components. We do not guarantee the accuracy of any simulated data, pricing,
              weather, or aviation information presented on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AERONEXUS SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE,
              EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL AERONEXUS&apos;S TOTAL
              LIABILITY EXCEED THE AMOUNT YOU PAID TO AERONEXUS IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of Washington,
              United States, without regard to its conflict of law provisions. Any disputes arising under these
              Terms shall be subject to the exclusive jurisdiction of the courts located in Thurston County,
              Washington.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">13. Contact</h2>
            <p>
              For questions about these Terms or to report a violation, please contact us at:
            </p>
            <div className="mt-3 glass-card rounded-xl p-4 text-sm">
              <p className="font-medium text-white">AeroNexus</p>
              <p className="text-gray-400">Legal Notices &amp; Terms</p>
              <a href="mailto:terms@aeronexus.app" className="text-[#00D1FF] hover:underline">
                terms@aeronexus.app
              </a>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-sm text-gray-600">
          <p>&copy; 2026 AeroNexus Ecosystem</p>
          <Link href="/privacy" className="text-[#00D1FF] hover:underline">Privacy Policy →</Link>
        </div>
      </div>
    </div>
  );
}
