'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Upload' },
  { href: '/overview', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/benford', label: 'Benford Analysis' },
  { href: '/detectors', label: 'Detectors' },
];

export function Navbar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  function toggleDark() {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }
    setIsDark(!isDark);
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-white border-gray-200 dark:bg-slate-950 dark:border-slate-800">
      <div className="flex items-center h-14 px-6 gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-cyan-500 text-xl leading-none">⌕</span>
          <span className="font-bold text-gray-900 dark:text-white text-base">ForensiQ</span>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1 text-sm font-medium transition-colors rounded-md ${
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-[-14px] left-0 right-0 h-0.5 bg-cyan-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Light/dark toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-500 dark:text-slate-400">{isDark ? 'Dark' : 'Light'}</span>
          <button
            role="switch"
            aria-checked={!isDark}
            onClick={toggleDark}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              isDark ? 'bg-slate-600' : 'bg-cyan-500'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                isDark ? 'left-0.5' : 'left-5'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
