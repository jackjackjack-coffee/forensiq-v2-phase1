import { cn } from '@/lib/utils'

type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

interface RiskBadgeProps {
  tier: RiskTier
  size?: 'sm' | 'md'
  className?: string
}

const tierStyles: Record<RiskTier, string> = {
  LOW: 'bg-success/10 text-success border-success/20',
  MEDIUM: 'bg-warning/10 text-warning border-warning/20',
  HIGH: 'bg-danger/10 text-danger border-danger/20',
  CRITICAL: 'bg-critical/10 text-critical border-critical/20 animate-pulse',
}

export function RiskBadge({ tier, size = 'md', className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-mono font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        tierStyles[tier],
        className
      )}
    >
      {tier}
    </span>
  )
}
