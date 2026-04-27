'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { AnalyzedTransaction, RiskTier } from '@/forensiq/lib/types/transaction'

interface RiskDistributionProps {
  transactions: AnalyzedTransaction[]
  height?: number
}

const COLORS: Record<RiskTier, string> = {
  LOW: 'hsl(160, 84%, 39%)',
  MEDIUM: 'hsl(38, 92%, 50%)',
  HIGH: 'hsl(350, 89%, 60%)',
  CRITICAL: 'hsl(0, 72%, 51%)',
}

export function RiskDistribution({ transactions, height = 200 }: RiskDistributionProps) {
  const distribution = transactions.reduce((acc, t) => {
    acc[t.risk_tier] = (acc[t.risk_tier] || 0) + 1
    return acc
  }, {} as Record<RiskTier, number>)

  const data = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RiskTier[]).map((tier) => ({
    name: tier,
    value: distribution[tier] || 0,
  }))

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name as RiskTier]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 47%, 7%)',
              border: '1px solid hsl(217, 33%, 15%)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: COLORS[item.name as RiskTier] }}
            />
            <span className="text-xs text-muted-foreground w-16">{item.name}</span>
            <span className="font-mono text-sm text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
