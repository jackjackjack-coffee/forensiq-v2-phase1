interface DetectorTagProps {
  label: string
}

export function DetectorTag({ label }: DetectorTagProps) {
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300">
      {label}
    </span>
  )
}
