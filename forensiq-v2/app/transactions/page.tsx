'use client'

import { useState, useMemo } from 'react'
import { 
  Search, 
  Filter, 
  Download, 
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react'
import { RiskBadge } from '@/components/ui/risk-badge'
import { getMockAnalysisResult } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AnalyzedTransaction, RiskTier } from '@/forensiq/lib/types/transaction'

type SortField = 'composite_risk' | 'amount' | 'date' | 'vendor'
type SortOrder = 'asc' | 'desc'

const riskFilters: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function VerificationIcon({ status }: { status: boolean | null }) {
  if (status === true) return <CheckCircle2 className="h-4 w-4 text-success" />
  if (status === false) return <XCircle className="h-4 w-4 text-danger" />
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />
}

export default function TransactionsPage() {
  const analysis = getMockAnalysisResult()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRisks, setSelectedRisks] = useState<RiskTier[]>([])
  const [sortField, setSortField] = useState<SortField>('composite_risk')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filteredTransactions = useMemo(() => {
    let results = analysis.transactions

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      results = results.filter(
        (t) =>
          t.invoice_id.toLowerCase().includes(query) ||
          t.vendor.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query)
      )
    }

    // Filter by risk tier
    if (selectedRisks.length > 0) {
      results = results.filter((t) => selectedRisks.includes(t.risk_tier))
    }

    // Sort
    results = [...results].sort((a, b) => {
      let aVal: string | number = a[sortField]
      let bVal: string | number = b[sortField]
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })

    return results
  }, [analysis.transactions, searchQuery, selectedRisks, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const toggleRiskFilter = (risk: RiskTier) => {
    setSelectedRisks((prev) =>
      prev.includes(risk) ? prev.filter((r) => r !== risk) : [...prev, risk]
    )
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transaction Explorer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredTransactions.length} of {analysis.transactions.length} transactions
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by invoice, vendor, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
          />
        </div>

        {/* Risk Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {riskFilters.map((risk) => (
            <button
              key={risk}
              onClick={() => toggleRiskFilter(risk)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedRisks.includes(risk)
                  ? risk === 'CRITICAL' ? 'bg-critical/20 text-critical' :
                    risk === 'HIGH' ? 'bg-danger/20 text-danger' :
                    risk === 'MEDIUM' ? 'bg-warning/20 text-warning' :
                    'bg-success/20 text-success'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {risk}
            </button>
          ))}
          {selectedRisks.length > 0 && (
            <button
              onClick={() => setSelectedRisks([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Invoice ID
              </th>
              <th 
                className="cursor-pointer px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date <SortIcon field="date" />
                </div>
              </th>
              <th 
                className="cursor-pointer px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                onClick={() => toggleSort('vendor')}
              >
                <div className="flex items-center gap-1">
                  Vendor <SortIcon field="vendor" />
                </div>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th 
                className="cursor-pointer px-4 py-3 text-right font-medium text-muted-foreground hover:text-foreground"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount <SortIcon field="amount" />
                </div>
              </th>
              <th 
                className="cursor-pointer px-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground"
                onClick={() => toggleSort('composite_risk')}
              >
                <div className="flex items-center justify-center gap-1">
                  Risk <SortIcon field="composite_risk" />
                </div>
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                Verification
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Flags
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((txn) => (
              <>
                <tr 
                  key={txn.invoice_id}
                  className="cursor-pointer border-b border-border hover:bg-accent/50"
                  onClick={() => setExpandedRow(expandedRow === txn.invoice_id ? null : txn.invoice_id)}
                >
                  <td className="px-4 py-3 font-mono text-foreground">{txn.invoice_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{txn.date}</td>
                  <td className="px-4 py-3 text-foreground">{txn.vendor}</td>
                  <td className="px-4 py-3 text-muted-foreground">{txn.category || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RiskBadge tier={txn.risk_tier} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <VerificationIcon status={txn.edgar_verified} />
                      <VerificationIcon status={txn.ofac_hit === null ? null : !txn.ofac_hit} />
                      <VerificationIcon status={txn.address_valid} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {txn.triggered_detectors.length > 0 ? (
                        <span className="flex items-center gap-1 text-warning">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs">{txn.triggered_detectors.length}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedRow === txn.invoice_id && (
                  <tr key={`${txn.invoice_id}-details`}>
                    <td colSpan={8} className="bg-muted/30 px-4 py-4">
                      <TransactionDetails transaction={txn} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TransactionDetails({ transaction: txn }: { transaction: AnalyzedTransaction }) {
  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Risk Analysis */}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Risk Analysis
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Composite Score</span>
            <span className="font-mono text-sm text-foreground">{txn.composite_risk.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Isolation Score</span>
            <span className="font-mono text-sm text-foreground">{txn.isolation_score.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">RSF</span>
            <span className={cn(
              'font-mono text-sm',
              txn.rsf_flag ? 'text-warning' : 'text-foreground'
            )}>
              {txn.rsf.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Description Risk</span>
            <span className="font-mono text-sm text-foreground">{txn.description_risk.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Triggered Detectors */}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Triggered Detectors
        </h4>
        <div className="flex flex-wrap gap-2">
          {txn.triggered_detectors.length > 0 ? (
            txn.triggered_detectors.map((det) => (
              <span
                key={det}
                className="rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning"
              >
                {det.replace(/_/g, ' ')}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No detectors triggered</span>
          )}
        </div>
      </div>

      {/* Benford Analysis */}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Benford Analysis
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">First Digit</span>
            <span className="font-mono text-sm text-foreground">{txn.benford_first_digit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Second Digit</span>
            <span className="font-mono text-sm text-foreground">{txn.benford_second_digit ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Round Number</span>
            <span className={cn(
              'text-sm',
              txn.is_round_number ? 'text-warning' : 'text-muted-foreground'
            )}>
              {txn.is_round_number ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* External Verification */}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          External Verification
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">EDGAR Verified</span>
            <VerificationIcon status={txn.edgar_verified} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">OFAC Clear</span>
            <VerificationIcon status={txn.ofac_hit === null ? null : !txn.ofac_hit} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Address Valid</span>
            <VerificationIcon status={txn.address_valid} />
          </div>
        </div>
      </div>
    </div>
  )
}
