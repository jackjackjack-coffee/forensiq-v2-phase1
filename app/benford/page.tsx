'use client'

import { useState } from 'react'
import { DataCard } from '@/components/ui/data-card'
import { BenfordChart } from '@/components/charts/benford-chart'
import { getMockAnalysisResult } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Info, AlertTriangle, CheckCircle } from 'lucide-react'

type DigitPosition = 1 | 2

const conformityInfo = {
  ACCEPTABLE: {
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    icon: CheckCircle,
    description: 'The distribution closely follows Benford\'s Law, indicating no anomalies detected.',
  },
  MARGINAL: {
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    icon: AlertTriangle,
    description: 'The distribution shows some deviation from Benford\'s Law. Further investigation may be warranted.',
  },
  NON_CONFORMING: {
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    icon: AlertTriangle,
    description: 'Significant deviation from Benford\'s Law detected. This may indicate data manipulation or fraud.',
  },
}

export default function BenfordPage() {
  const analysis = getMockAnalysisResult()
  const [selectedDigit, setSelectedDigit] = useState<DigitPosition>(1)
  
  const benfordData = selectedDigit === 1 ? analysis.benford_1st : analysis.benford_2nd
  const conformity = conformityInfo[benfordData.conformity]
  const ConformityIcon = conformity.icon

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Benford&apos;s Law Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistical digit distribution analysis for fraud detection
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Info className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm text-foreground">
            Benford&apos;s Law states that in many naturally occurring datasets, the leading digit is likely to be small.
            The digit 1 appears as the first digit about 30% of the time, while 9 appears less than 5% of the time.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Fraudulent or manipulated data often fails to follow this distribution, making it a powerful tool for forensic accounting.
          </p>
        </div>
      </div>

      {/* Digit Selection */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Analyze:</span>
        <button
          onClick={() => setSelectedDigit(1)}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            selectedDigit === 1
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          First Digit
        </button>
        <button
          onClick={() => setSelectedDigit(2)}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            selectedDigit === 2
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          Second Digit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Chart */}
        <DataCard 
          title={`${selectedDigit === 1 ? 'First' : 'Second'} Digit Distribution`}
          description={`Comparing observed vs expected frequencies for ${benfordData.total_records.toLocaleString()} records`}
          className="col-span-2"
        >
          <BenfordChart data={benfordData} height={350} />
        </DataCard>

        {/* Stats Panel */}
        <div className="space-y-4">
          {/* Conformity Status */}
          <div className={cn(
            'rounded-lg border p-4',
            conformity.bg,
            conformity.border
          )}>
            <div className="flex items-center gap-2">
              <ConformityIcon className={cn('h-5 w-5', conformity.color)} />
              <span className={cn('font-semibold', conformity.color)}>
                {benfordData.conformity.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {conformity.description}
            </p>
          </div>

          {/* Statistics */}
          <DataCard title="Statistical Measures">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mean Absolute Deviation</span>
                  <span className={cn(
                    'font-mono text-lg font-semibold',
                    benfordData.mad < 0.006 ? 'text-success' :
                    benfordData.mad < 0.012 ? 'text-warning' : 'text-danger'
                  )}>
                    {(benfordData.mad * 100).toFixed(3)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {'< 0.6%: Acceptable | < 1.2%: Marginal | > 1.2%: Non-conforming'}
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Chi-Square Statistic</span>
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {benfordData.chi_square.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Critical value at p=0.05: 15.51 (df=8)
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Records Analyzed</span>
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {benfordData.total_records.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </DataCard>

          {/* Legend */}
          <DataCard title="Interpretation Guide">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="mt-1.5 h-3 w-3 rounded-sm bg-success/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">Expected</p>
                  <p className="text-xs text-muted-foreground">Benford&apos;s Law distribution</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={cn(
                  'mt-1.5 h-3 w-3 rounded-sm',
                  benfordData.conformity === 'ACCEPTABLE' ? 'bg-success' :
                  benfordData.conformity === 'MARGINAL' ? 'bg-warning' : 'bg-danger'
                )} />
                <div>
                  <p className="text-sm font-medium text-foreground">Observed</p>
                  <p className="text-xs text-muted-foreground">Actual data distribution</p>
                </div>
              </div>
            </div>
          </DataCard>
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <DataCard 
        title="Digit Frequency Breakdown" 
        description="Detailed comparison of expected vs observed frequencies"
        className="mt-6"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Digit</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Expected %</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Observed %</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Deviation</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Visual</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(benfordData.expected).map((digit) => {
              const expected = benfordData.expected[Number(digit)]
              const observed = benfordData.observed[Number(digit)] || 0
              const deviation = observed - expected
              const deviationPercent = Math.abs(deviation) / expected * 100

              return (
                <tr key={digit} className="border-b border-border">
                  <td className="px-4 py-3 font-mono text-lg font-semibold text-foreground">{digit}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {expected.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {observed.toFixed(2)}%
                  </td>
                  <td className={cn(
                    'px-4 py-3 text-right font-mono',
                    Math.abs(deviation) < 2 ? 'text-success' :
                    Math.abs(deviation) < 4 ? 'text-warning' : 'text-danger'
                  )}>
                    {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 rounded-full bg-muted">
                        <div 
                          className={cn(
                            'h-2 rounded-full',
                            deviationPercent < 10 ? 'bg-success' :
                            deviationPercent < 25 ? 'bg-warning' : 'bg-danger'
                          )}
                          style={{ width: `${Math.min(100, (observed / 35) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </DataCard>
    </div>
  )
}
