interface ScoreRingProps {
  score: number
  size?: number
}

function strokeColor(score: number): string {
  if (score <= 30) return '#22c55e'
  if (score <= 60) return '#eab308'
  if (score <= 80) return '#f97316'
  return '#ef4444'
}

export function ScoreRing({ score, size = 44 }: ScoreRingProps) {
  const strokeW = 4
  const r = (size - strokeW) / 2
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference
  const color = strokeColor(score)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeW}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-xs font-semibold tabular-nums"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  )
}
