'use client'

import { useState } from 'react'
import { RiskBadge } from './RiskBadge'
import { ScoreRing } from './ScoreRing'
import { DetectorTag } from './DetectorTag'
import { TransactionDetailPanel } from './TransactionDetailPanel'

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

interface TransactionTableProps {
  transactions: Transaction[]
}

const BORDER_COLOR: Record<Transaction['risk'], string> = {
  Critical: 'border-l-red-500',
  High: 'border-l-amber-500',
  Medium: 'border-l-yellow-500',
  Low: 'border-l-green-500',
}

const TH = 'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500'
const TD = 'px-4 py-3'

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = transactions.find((t) => t.id === selectedId) ?? null

  return (
    <div>
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80">
              <tr>
                <th className={TH}>Invoice</th>
                <th className={TH}>Date</th>
                <th className={TH}>Vendor</th>
                <th className={TH}>Amount</th>
                <th className={TH}>Risk</th>
                <th className={TH}>Score</th>
                <th className={TH}>Detectors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  onClick={() => setSelectedId(selectedId === txn.id ? null : txn.id)}
                  className={`border-l-[3px] ${BORDER_COLOR[txn.risk]} cursor-pointer transition-colors hover:bg-slate-800/50 ${
                    selectedId === txn.id ? 'bg-slate-800/70' : ''
                  }`}
                >
                  <td className={`${TD} font-mono text-xs text-slate-500`}>{txn.id}</td>
                  <td className={`${TD} text-slate-400 whitespace-nowrap`}>{txn.date}</td>
                  <td className={`${TD} font-medium text-slate-200 max-w-[180px] truncate`}>{txn.vendor}</td>
                  <td className={`${TD} font-mono text-slate-200`}>{txn.amount}</td>
                  <td className={TD}>
                    <RiskBadge level={txn.risk} />
                  </td>
                  <td className={TD}>
                    <ScoreRing score={txn.score} size={40} />
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {txn.detectors.slice(0, 2).map((d) => (
                        <DetectorTag key={d} label={d} />
                      ))}
                      {txn.detectors.length > 2 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-500">
                          +{txn.detectors.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <TransactionDetailPanel
          transaction={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
