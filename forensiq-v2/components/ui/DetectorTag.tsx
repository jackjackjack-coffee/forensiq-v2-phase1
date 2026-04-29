interface DetectorTagProps {
  label: string
}

export function DetectorTag({ label }: DetectorTagProps) {
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
      {label}
    </span>
  )
}
