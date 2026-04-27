import { 
  AlertTriangle, 
  FileWarning, 
  DollarSign, 
  Activity,
  TrendingUp,
  Shield,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { MetricCard } from '@/components/ui/metric-card'
import { DataCard } from '@/components/ui/data-card'
import { RiskBadge } from '@/components/ui/risk-badge'
import { BenfordChart } from '@/components/charts/benford-chart'
import { RiskDistribution } from '@/components/charts/risk-distribution'
import { getMockAnalysisResult } from '@/lib/mock-data'
import { formatCurrency, formatPercent } from '@/lib/utils'

export default function DashboardPage() {
  const analysis = getMockAnalysisResult()
  const { portfolio, transactions, benford_1st } = analysis

  const topFlagged = transactions.slice(0, 5)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Portfolio Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Forensic accounting analysis dashboard with real-time fraud detection
        </p>
      </div>

      {/* Portfolio Score Banner */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Shield className="h-8 w-8 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Portfolio Risk Score</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-foreground">
                {portfolio.score.toFixed(0)}
              </span>
              <span className="text-lg text-muted-foreground">/ 100</span>
              <RiskBadge tier={portfolio.tier} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last Analysis</p>
          <p className="text-lg font-medium text-foreground">
            {new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Transactions"
          value={portfolio.total_transactions.toLocaleString()}
          subtitle="Analyzed records"
          icon={Activity}
        />
        <MetricCard
          title="Flagged Transactions"
          value={portfolio.flagged_transactions}
          subtitle={`${formatPercent(portfolio.flagged_transactions / portfolio.total_transactions)} of total`}
          icon={AlertTriangle}
          variant="warning"
        />
        <MetricCard
          title="Estimated Exposure"
          value={formatCurrency(portfolio.estimated_exposure)}
          subtitle="Flagged transaction value"
          icon={DollarSign}
          variant="danger"
        />
        <MetricCard
          title="Outlier Rate"
          value={formatPercent(portfolio.outlier_rate)}
          subtitle="Statistical anomalies"
          icon={TrendingUp}
          variant={portfolio.outlier_rate > 0.1 ? 'warning' : 'default'}
        />
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <DataCard 
          title="Benford's Law Analysis" 
          description="First digit distribution conformity"
          className="col-span-2"
          action={
            <Link 
              href="/benford"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View Details <ExternalLink className="h-3 w-3" />
            </Link>
          }
        >
          <BenfordChart data={benford_1st} />
        </DataCard>
        
        <DataCard 
          title="Risk Distribution" 
          description="Transaction risk tier breakdown"
        >
          <RiskDistribution transactions={transactions} />
        </DataCard>
      </div>

      {/* Detection Stats */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">RSF Flags</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatPercent(portfolio.rsf_flag_rate)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Duplicate Rate</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatPercent(portfolio.duplicate_rate)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Round Numbers</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatPercent(portfolio.round_number_rate)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Benford MAD</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {(portfolio.benford_mad * 100).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Conformity</p>
          <p className={`mt-1 text-2xl font-semibold ${
            benford_1st.conformity === 'ACCEPTABLE' ? 'text-success' :
            benford_1st.conformity === 'MARGINAL' ? 'text-warning' : 'text-danger'
          }`}>
            {benford_1st.conformity}
          </p>
        </div>
      </div>

      {/* Top Flagged Transactions */}
      <DataCard 
        title="Highest Risk Transactions" 
        description="Transactions requiring immediate review"
        action={
          <Link 
            href="/transactions"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View All <ExternalLink className="h-3 w-3" />
          </Link>
        }
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Risk Score</th>
              <th>Risk Tier</th>
              <th>Detectors Triggered</th>
            </tr>
          </thead>
          <tbody>
            {topFlagged.map((txn) => (
              <tr key={txn.invoice_id}>
                <td className="font-mono text-sm">{txn.invoice_id}</td>
                <td>{txn.vendor}</td>
                <td className="font-mono">{formatCurrency(txn.amount)}</td>
                <td className="font-mono">{txn.composite_risk.toFixed(1)}</td>
                <td><RiskBadge tier={txn.risk_tier} size="sm" /></td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {txn.triggered_detectors.slice(0, 3).map((det) => (
                      <span 
                        key={det}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {det.replace('_', ' ')}
                      </span>
                    ))}
                    {txn.triggered_detectors.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{txn.triggered_detectors.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCard>
    </div>
  )
}
