interface StatsCardProps {
  label: string
  value: string
  valueClassName?: string
  subtitle: string
}

export function StatsCard({ label, value, valueClassName, subtitle }: StatsCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 dark:bg-slate-800 dark:border-slate-700 rounded-xl p-4 light:bg-white light:border-gray-200">
      <p className="uppercase text-xs tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName ?? 'text-white'}`}>{value}</p>
      <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
    </div>
  )
}
