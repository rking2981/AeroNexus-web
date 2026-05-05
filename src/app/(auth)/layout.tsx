import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal nav */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
        <Link href="/" className="text-2xl font-bold tracking-tighter italic">
          AERO<span className="text-aero">NEXUS</span>
        </Link>
      </nav>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      <footer className="py-6 text-center text-gray-600 text-xs">
        &copy; 2026 AeroNexus Ecosystem
      </footer>
    </div>
  );
}
