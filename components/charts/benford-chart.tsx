'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { BenfordResult } from '@/forensiq/lib/types/transaction'

interface BenfordChartProps {
  data: BenfordResult
  height?: number
}

export function BenfordChart({ data, height = 300 }: BenfordChartProps) {
  const chartData = Object.keys(data.expected).map((digit) => ({
    digit: digit,
    expected: Number(data.expected[Number(digit)].toFixed(1)),
    observed: Number(data.observed[Number(digit)]?.toFixed(1) || 0),
  }))

  const conformityColor = 
    data.conformity === 'ACCEPTABLE' ? 'hsl(160, 84%, 39%)' :
    data.conformity === 'MARGINAL' ? 'hsl(38, 92%, 50%)' :
    'hsl(350, 89%, 60%)'

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-success/80" />
          <span className="text-xs text-muted-foreground">Expected (Benford)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: conformityColor }} />
          <span className="text-xs text-muted-foreground">Observed</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">MAD:</span>
          <span 
            className="font-mono text-xs font-medium"
            style={{ color: conformityColor }}
          >
            {(data.mad * 100).toFixed(2)}%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(217, 33%, 15%)" 
            vertical={false}
          />
          <XAxis 
            dataKey="digit" 
            stroke="hsl(215, 20%, 55%)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'hsl(217, 33%, 15%)' }}
          />
          <YAxis 
            stroke="hsl(215, 20%, 55%)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'hsl(217, 33%, 15%)' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 47%, 7%)',
              border: '1px solid hsl(217, 33%, 15%)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
            formatter={(value: number) => [`${value}%`, '']}
          />
          <Bar 
            dataKey="expected" 
            fill="hsl(160, 84%, 39%)" 
            fillOpacity={0.3}
            radius={[2, 2, 0, 0]}
            name="Expected"
          />
          <Bar 
            dataKey="observed" 
            fill={conformityColor}
            radius={[2, 2, 0, 0]}
            name="Observed"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
