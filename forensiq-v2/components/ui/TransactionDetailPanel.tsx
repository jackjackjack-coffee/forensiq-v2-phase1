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
  detectorResults?: { name: string; description: string; status: 'PASS' | 'FAIL' | 'N/A' | 'INFO' }[]
}

const STATUS_STYLE: Record<'PASS' | 'FAIL' | 'N/A' | 'INFO', string> = {
  PASS:   'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  FAIL:   'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  'N/A':  'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-500',
  INFO:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

interface TransactionDetailPanelProps {
  transaction: Transaction
  onClose: () => void
}

export function TransactionDetailPanel({ transaction, onClose }: TransactionDetailPanelProps) {
  return (
    <div className="mt-2 rounded-xl border bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">{transaction.vendor}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {transaction.id} · {transaction.date}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white text-xl leading-none px-1 mt-0.5 transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* 3-card row */}
      <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-800">
        <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-gray-500 dark:text-slate-400 mb-1.5">Amount</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{transaction.amount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-gray-500 dark:text-slate-400 mb-1.5">Risk Tier</p>
          <RiskBadge level={transaction.risk} />
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:border-slate-700 p-3">
          <p className="uppercase text-xs tracking-wider text-gray-500 dark:text-slate-400 mb-1.5">Score</p>
          <div className="flex items-center gap-2">
            <ScoreRing score={transaction.score} size={36} />
            <span className="text-lg font-bold text-gray-900 dark:text-white">{transaction.score}/100</span>
          </div>
        </div>
      </div>

      {/* Detector results */}
      {transaction.detectorResults && transaction.detectorResults.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          {transaction.detectorResults.map((r, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 rounded-lg px-4 py-3 border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{r.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{r.description}</p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${STATUS_STYLE[r.status]}`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
