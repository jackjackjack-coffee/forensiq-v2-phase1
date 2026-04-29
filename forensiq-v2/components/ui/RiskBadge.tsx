interface RiskBadgeProps {
  level: 'Critical' | 'High' | 'Medium' | 'Low'
}

const CONFIG = {
  Critical: {
    dot: 'bg-red-500',
    badge: 'bg-red-950 text-red-400 border border-red-800',
  },
  High: {
    dot: 'bg-red-500',
    badge: 'bg-red-900/70 text-red-300 border border-red-700',
  },
  Medium: {
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-950 text-yellow-400 border border-yellow-800',
  },
  Low: {
    dot: 'bg-green-500',
    badge: 'bg-green-950 text-green-400 border border-green-800',
  },
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const c = CONFIG[level]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {level}
    </span>
  )
}
