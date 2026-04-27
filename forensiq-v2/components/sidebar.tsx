'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  FileSearch, 
  BarChart3, 
  Upload, 
  Building2,
  FileText,
  Settings,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: FileSearch },
  { name: 'Benford Analysis', href: '/benford', icon: BarChart3 },
  { name: 'Vendor Intelligence', href: '/vendors', icon: Building2 },
  { name: 'Reports', href: '/reports', icon: FileText },
]

const secondaryNav = [
  { name: 'Upload Data', href: '/upload', icon: Upload },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <Shield className="h-8 w-8 text-success" />
          <div>
            <span className="text-lg font-semibold text-foreground">ForensiQ</span>
            <span className="ml-1 text-xs text-muted-foreground">v2</span>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analysis
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-success/10 text-success'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}

          <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tools
          </div>
          {secondaryNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-success/10 text-success'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Forensic Accounting Intelligence
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              AICPA AU-C 240 Compliant
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
