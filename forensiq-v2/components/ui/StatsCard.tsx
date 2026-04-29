interface StatsCardProps {
  label: string
  value: string
  valueClassName?: string
  subtitle: string
}

export function StatsCard({ label, value, valueClassName, subtitle }: StatsCardProps) {
  return (
    <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-4">
      <p className="uppercase text-xs tracking-wider text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{subtitle}</p>
    </div>
  )
}
