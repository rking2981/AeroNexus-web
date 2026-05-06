'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface FoundersStatus {
  sold_out: boolean;
  count: number;
  cap: number;
  remaining: number;
}

export function PricingSection({ founders }: { founders: FoundersStatus }) {
  const [yearly, setYearly] = useState(false);

  const startup = {
    monthly: '$4.99',
    yearly: '$39.99',
    monthlySub: '/mo',
    yearlySub: '/yr',
    savings: 'Save $19.89/yr',
  };

  const enterprise = {
    monthly: '$14.99',
    yearly: '$139.99',
    monthlySub: '/mo',
    yearlySub: '/yr',
    savings: 'Save $39.89/yr',
  };

  return (
    <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 border-t border-white/10">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Simple, Scalable Pricing</h2>
        <p className="text-gray-400 mb-8">Built to turn your passion into a professional operation.</p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-4 glass-card rounded-full px-6 py-3">
          <span className={cn('text-sm font-medium transition', !yearly ? 'text-white' : 'text-gray-500')}>
            Monthly
          </span>
          <button
            onClick={() => setYearly(!yearly)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              yearly ? 'bg-aero' : 'bg-white/20'
            )}
          >
            <span className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
              yearly ? 'left-7' : 'left-1'
            )} />
          </button>
          <span className={cn('text-sm font-medium transition', yearly ? 'text-white' : 'text-gray-500')}>
            Yearly
            {yearly && <span className="ml-2 text-xs text-green-400 font-bold">Save up to 22%</span>}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Pilot Free */}
        <div className="glass-card p-8 rounded-3xl flex flex-col">
          <h4 className="text-lg font-bold mb-1">Pilot Free</h4>
          <div className="text-3xl font-extrabold mb-1">
            $0<span className="text-xs font-normal text-gray-500">/mo</span>
          </div>
          <p className="text-xs text-gray-600 mb-4">&nbsp;</p>
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
          <div className="text-3xl font-extrabold mb-1">
            {yearly ? startup.yearly : startup.monthly}
            <span className="text-xs font-normal text-gray-500">
              {yearly ? startup.yearlySub : startup.monthlySub}
            </span>
          </div>
          <p className="text-xs mb-4">
            {yearly
              ? <span className="text-green-400">{startup.savings}</span>
              : <span className="text-gray-600">or {startup.yearly}/yr</span>
            }
          </p>
          <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
            <li>✓ Custom Airline Logo</li>
            <li>✓ Up to 5 Active Pilots</li>
            <li>✓ 10 Persistent Hulls</li>
            <li>✓ Basic Fleet Management</li>
            <li className="text-gray-600 line-through">Custom Colors &amp; Branding</li>
          </ul>
          <Link href={`/register?plan=${yearly ? 'startup-yearly' : 'startup-monthly'}`} className="w-full border border-white/20 py-3 rounded-xl hover:bg-white/5 transition text-sm font-bold text-center block">
            Create Airline
          </Link>
        </div>

        {/* Enterprise */}
        <div className="glass-card border-aero p-8 rounded-3xl flex flex-col relative shadow-2xl shadow-[#00D1FF]/5">
          <div className="absolute top-4 right-4 text-[10px] text-aero font-bold tracking-widest uppercase">Most Popular</div>
          <h4 className="text-lg font-bold mb-1 text-aero">Enterprise</h4>
          <div className="text-3xl font-extrabold mb-1">
            {yearly ? enterprise.yearly : enterprise.monthly}
            <span className="text-xs font-normal text-gray-500">
              {yearly ? enterprise.yearlySub : enterprise.monthlySub}
            </span>
          </div>
          <p className="text-xs mb-4">
            {yearly
              ? <span className="text-green-400">{enterprise.savings}</span>
              : <span className="text-gray-600">or {enterprise.yearly}/yr</span>
            }
          </p>
          <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
            <li>✓ 500 Pilots &amp; 200 Hulls</li>
            <li>✓ Full Custom Branding</li>
            <li>✓ Alliance Management</li>
            <li>✓ Public API Access</li>
          </ul>
          <Link href={`/register?plan=${yearly ? 'enterprise-yearly' : 'enterprise-monthly'}`} className="w-full bg-aero text-black font-bold py-3 rounded-xl hover:brightness-110 transition text-sm text-center block">
            Get Enterprise
          </Link>
        </div>

        {/* Founder's Pass */}
        <div className="glass-card p-8 rounded-3xl flex flex-col border-purple-500/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 blur-3xl" />

          {founders.sold_out ? (
            <>
              <div className="flex justify-center mb-3">
                <Image src="/badges/founders-badge.png" alt="Founder's Pass" width={64} height={64} className="opacity-50 grayscale" />
              </div>
              <h4 className="text-lg font-bold mb-1 text-purple-400 text-center">Founder&apos;s Pass</h4>
              <div className="text-3xl font-extrabold mb-2 text-gray-500 line-through text-center">$199</div>
              <p className="text-[10px] text-purple-300 uppercase font-bold mb-6 tracking-wider text-center">
                Sold Out — All 100 Claimed
              </p>
              <div className="flex-grow flex flex-col justify-center text-center py-4">
                <p className="text-gray-400 text-sm leading-relaxed">
                  Thank you to all who purchased the Founder&apos;s Pass. We have reached our limit.
                </p>
                <p className="text-purple-400/70 text-xs mt-4">
                  {founders.count} Founders are part of history.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-3">
                <Image src="/badges/founders-badge.png" alt="Founder's Pass" width={64} height={64} />
              </div>
              <h4 className="text-lg font-bold mb-1 text-purple-400 text-center">Founder&apos;s Pass</h4>
              <div className="text-3xl font-extrabold mb-1 text-center">
                $199<span className="text-xs font-normal text-gray-500">/once</span>
              </div>
              <p className="text-[10px] text-purple-300 uppercase font-bold mb-4 tracking-wider text-center">
                {founders.remaining} of {founders.cap} remaining
              </p>
              <ul className="text-gray-400 space-y-3 mb-8 flex-grow text-xs">
                <li>✓ <strong>Lifetime Enterprise Access</strong></li>
                <li>✓ No Monthly Fees, Ever</li>
                <li>✓ Exclusive Founder&apos;s Badge</li>
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
  );
}
