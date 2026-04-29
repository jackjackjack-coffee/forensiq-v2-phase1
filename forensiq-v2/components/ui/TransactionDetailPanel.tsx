import { RiskBadge } from './RiskBadge'
import { ScoreRing } from './ScoreRing'

interface Transaction {
  id: string
  date: string
  vendor: string
  amount: string
  risk: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
  detectors: string[]
  detectorResults?: { name: string; description: string; passed: boolean }[]
}

interface TransactionDetailPanelProps {
  transaction: Transaction
  onClose: () => void
}

export function TransactionDetailPanel({ transaction, onClose }: TransactionDetailPanelProps) {
  return (
    <div className="mt-2 rounded-xl border bg-slate-900 border-slate-700">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700">
        <div>
          <p className="text-base font-bold text-white">{transaction.vendor}</p>
          <p className="text-sm text-slate-400 mt-0.5">
            {transaction.id} · {transaction.date}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none px-1 mt-0.5 transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* 3-card row */}
      <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-slate-700">
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-slate-400 mb-1.5">Amount</p>
          <p className="text-lg font-bold text-white">{transaction.amount}</p>
        </div>
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-slate-400 mb-1.5">Risk Tier</p>
          <RiskBadge level={transaction.risk} />
        </div>
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-slate-400 mb-1.5">Score</p>
          <div className="flex items-center gap-2">
            <ScoreRing score={transaction.score} size={36} />
            <span className="text-lg font-bold text-white">{transaction.score}/100</span>
          </div>
        </div>
      </div>

      {/* Detector results */}
      {transaction.detectorResults && transaction.detectorResults.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          {transaction.detectorResults.map((r, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 rounded-lg px-4 py-3 border border-slate-700 bg-slate-800/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{r.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${
                  r.passed
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-red-900/50 text-red-400'
                }`}
              >
                {r.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
