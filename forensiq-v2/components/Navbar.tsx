'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Upload' },
  { href: '/overview', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/benford', label: 'Benford' },
  { href: '/detectors', label: 'Detectors' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b bg-[#050505] border-[#1c1c1c]">
      <div className="flex items-center h-12 px-6 gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-amber-500 font-mono text-base select-none">◈</span>
          <span className="font-mono font-bold text-white text-sm tracking-widest uppercase">ForensiQ</span>
          <span className="text-[9px] font-mono text-amber-500/50 ml-0.5 tracking-wider">v2</span>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1 text-[11px] font-mono uppercase tracking-widest transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-[#6b6b6b] hover:text-[#d4d4d4]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-[-12px] left-0 right-0 h-px bg-amber-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live status indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">LIVE</span>
        </div>
      </div>
    </header>
  );
}
