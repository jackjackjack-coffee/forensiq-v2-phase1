'use client'

import { useState, useMemo } from 'react'
import { Search, Building2, CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react'
import { DataCard } from '@/components/ui/data-card'
import { RiskBadge } from '@/components/ui/risk-badge'
import { getMockAnalysisResult } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { RiskTier } from '@/forensiq/lib/types/transaction'

interface VendorSummary {
  name: string
  transactionCount: number
  totalAmount: number
  avgRisk: number
  riskTier: RiskTier
  rsfFlagRate: number
  edgarVerified: boolean | null
  ofacHit: boolean | null
  addressValid: boolean | null
}

function VerificationBadge({ label, status }: { label: string; status: boolean | null }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
      status === true ? 'bg-success/10 text-success' :
      status === false ? 'bg-danger/10 text-danger' :
      'bg-muted text-muted-foreground'
    )}>
      {status === true ? <CheckCircle2 className="h-3 w-3" /> :
       status === false ? <XCircle className="h-3 w-3" /> :
       <HelpCircle className="h-3 w-3" />}
      {label}
    </div>
  )
}

export default function VendorsPage() {
  const analysis = getMockAnalysisResult()
  const [searchQuery, setSearchQuery] = useState('')

  const vendors = useMemo(() => {
    const vendorMap = new Map<string, VendorSummary>()

    analysis.transactions.forEach((txn) => {
      const existing = vendorMap.get(txn.vendor)
      if (existing) {
        existing.transactionCount++
        existing.totalAmount += txn.amount
        existing.avgRisk = (existing.avgRisk * (existing.transactionCount - 1) + txn.composite_risk) / existing.transactionCount
        if (txn.rsf_flag) existing.rsfFlagRate++
      } else {
        vendorMap.set(txn.vendor, {
          name: txn.vendor,
          transactionCount: 1,
          totalAmount: txn.amount,
          avgRisk: txn.composite_risk,
          riskTier: txn.risk_tier,
          rsfFlagRate: txn.rsf_flag ? 1 : 0,
          edgarVerified: txn.edgar_verified,
          ofacHit: txn.ofac_hit,
          addressValid: txn.address_valid,
        })
      }
    })

    // Calculate final values
    vendorMap.forEach((vendor) => {
      vendor.rsfFlagRate = vendor.rsfFlagRate / vendor.transactionCount
      vendor.riskTier = 
        vendor.avgRisk > 70 ? 'CRITICAL' :
        vendor.avgRisk > 50 ? 'HIGH' :
        vendor.avgRisk > 30 ? 'MEDIUM' : 'LOW'
    })

    return Array.from(vendorMap.values()).sort((a, b) => b.avgRisk - a.avgRisk)
  }, [analysis.transactions])

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors
    const query = searchQuery.toLowerCase()
    return vendors.filter((v) => v.name.toLowerCase().includes(query))
  }, [vendors, searchQuery])

  const stats = useMemo(() => ({
    total: vendors.length,
    highRisk: vendors.filter(v => v.riskTier === 'HIGH' || v.riskTier === 'CRITICAL').length,
    unverified: vendors.filter(v => v.edgarVerified === false).length,
    ofacHits: vendors.filter(v => v.ofacHit === true).length,
  }), [vendors])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Vendor Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendor risk profiles with external verification status
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Vendors</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-muted-foreground">High Risk Vendors</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{stats.highRisk}</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-muted-foreground">EDGAR Unverified</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{stats.unverified}</p>
        </div>
        <div className="rounded-lg border border-critical/30 bg-critical/5 p-4">
          <p className="text-sm text-muted-foreground">OFAC Hits</p>
          <p className="mt-1 text-2xl font-semibold text-critical">{stats.ofacHits}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
        />
      </div>

      {/* Vendor List */}
      <div className="grid gap-4">
        {filteredVendors.map((vendor) => (
          <DataCard key={vendor.name} title="" className="p-0">
            <div className="flex items-center gap-6 p-5">
              {/* Vendor Icon */}
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                vendor.riskTier === 'CRITICAL' ? 'bg-critical/10' :
                vendor.riskTier === 'HIGH' ? 'bg-danger/10' :
                vendor.riskTier === 'MEDIUM' ? 'bg-warning/10' : 'bg-success/10'
              )}>
                <Building2 className={cn(
                  'h-6 w-6',
                  vendor.riskTier === 'CRITICAL' ? 'text-critical' :
                  vendor.riskTier === 'HIGH' ? 'text-danger' :
                  vendor.riskTier === 'MEDIUM' ? 'text-warning' : 'text-success'
                )} />
              </div>

              {/* Vendor Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{vendor.name}</h3>
                  <RiskBadge tier={vendor.riskTier} size="sm" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vendor.transactionCount} transactions | {formatCurrency(vendor.totalAmount)} total
                </p>
              </div>

              {/* Risk Score */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                <p className={cn(
                  'text-2xl font-bold',
                  vendor.avgRisk > 70 ? 'text-critical' :
                  vendor.avgRisk > 50 ? 'text-danger' :
                  vendor.avgRisk > 30 ? 'text-warning' : 'text-success'
                )}>
                  {vendor.avgRisk.toFixed(0)}
                </p>
              </div>

              {/* RSF Flag Rate */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">RSF Flag Rate</p>
                <p className={cn(
                  'text-2xl font-bold',
                  vendor.rsfFlagRate > 0.3 ? 'text-danger' :
                  vendor.rsfFlagRate > 0.1 ? 'text-warning' : 'text-success'
                )}>
                  {(vendor.rsfFlagRate * 100).toFixed(0)}%
                </p>
              </div>

              {/* Verification Status */}
              <div className="flex flex-col gap-1">
                <VerificationBadge label="EDGAR" status={vendor.edgarVerified} />
                <VerificationBadge label="OFAC Clear" status={vendor.ofacHit === null ? null : !vendor.ofacHit} />
                <VerificationBadge label="Address" status={vendor.addressValid} />
              </div>

              {/* Warning Icon */}
              {(vendor.riskTier === 'HIGH' || vendor.riskTier === 'CRITICAL') && (
                <AlertTriangle className="h-6 w-6 text-warning" />
              )}
            </div>
          </DataCard>
        ))}
      </div>
    </div>
  )
}
