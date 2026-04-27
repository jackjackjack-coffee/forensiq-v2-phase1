import type { AnalysisResult, AnalyzedTransaction, RiskTier } from '@/lib/types/transaction'

// Generate mock transactions for demo
function generateMockTransactions(count: number): AnalyzedTransaction[] {
  const vendors = [
    'Acme Corp', 'GlobalTech Solutions', 'Smith & Associates', 'Premier Services Inc',
    'Quantum Dynamics', 'Atlas Holdings', 'Nexus Industries', 'Pinnacle Group',
    'Vertex Partners', 'Meridian Consulting', 'Eclipse Ventures', 'Horizon Systems'
  ]
  
  const categories = ['Consulting', 'Equipment', 'Software', 'Marketing', 'Travel', 'Supplies', 'Services']
  const approvers = ['J. Smith', 'M. Johnson', 'R. Williams', 'S. Brown', 'L. Davis']

  const transactions: AnalyzedTransaction[] = []
  
  for (let i = 0; i < count; i++) {
    const amount = Math.random() > 0.85 
      ? Math.round(Math.random() * 5000) * 10  // Round numbers for some
      : Math.round(Math.random() * 50000 * 100) / 100
    
    const compositeRisk = Math.random() * 100
    const riskTier: RiskTier = 
      compositeRisk > 80 ? 'CRITICAL' :
      compositeRisk > 60 ? 'HIGH' :
      compositeRisk > 35 ? 'MEDIUM' : 'LOW'

    const triggeredDetectors: AnalyzedTransaction['triggered_detectors'] = []
    if (Math.random() > 0.7) triggeredDetectors.push('BENFORD_1ST')
    if (Math.random() > 0.8) triggeredDetectors.push('RSF')
    if (Math.random() > 0.9) triggeredDetectors.push('EXACT_DUPLICATE')
    if (Math.random() > 0.85) triggeredDetectors.push('ROUND_NUMBER')
    if (Math.random() > 0.95) triggeredDetectors.push('SPLIT_INVOICE')

    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)

    transactions.push({
      invoice_id: `INV-${String(i + 1).padStart(5, '0')}`,
      date: date.toISOString().split('T')[0],
      vendor: vendors[Math.floor(Math.random() * vendors.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      amount,
      description: `Transaction ${i + 1} for business services`,
      approved_by: approvers[Math.floor(Math.random() * approvers.length)],
      benford_first_digit: Math.floor(Math.random() * 9) + 1,
      benford_second_digit: Math.floor(Math.random() * 10),
      is_round_number: amount % 1000 === 0,
      isolation_score: Math.random() * 100,
      is_outlier: Math.random() > 0.9,
      rsf: 1 + Math.random() * 4,
      rsf_flag: Math.random() > 0.85,
      rsf_zscore: (Math.random() - 0.5) * 6,
      is_exact_duplicate: Math.random() > 0.95,
      dup_count: Math.random() > 0.95 ? Math.floor(Math.random() * 3) + 2 : 1,
      fuzzy_dup_group: null,
      is_split_invoice: Math.random() > 0.92,
      description_risk: Math.random() * 30,
      edgar_verified: Math.random() > 0.3 ? true : Math.random() > 0.5 ? false : null,
      ofac_hit: Math.random() > 0.98 ? true : false,
      address_valid: Math.random() > 0.2 ? true : Math.random() > 0.5 ? false : null,
      composite_risk: compositeRisk,
      risk_tier: riskTier,
      triggered_detectors: triggeredDetectors,
    })
  }

  return transactions.sort((a, b) => b.composite_risk - a.composite_risk)
}

// Benford's Law expected distribution
const benfordExpected: Record<number, number> = {
  1: 30.1, 2: 17.6, 3: 12.5, 4: 9.7, 5: 7.9,
  6: 6.7, 7: 5.8, 8: 5.1, 9: 4.6
}

export function getMockAnalysisResult(): AnalysisResult {
  const transactions = generateMockTransactions(250)
  
  const flaggedTransactions = transactions.filter(t => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL')
  const estimatedExposure = flaggedTransactions.reduce((sum, t) => sum + t.amount, 0)

  // Generate slightly deviated observed distribution
  const observed: Record<number, number> = {}
  for (let d = 1; d <= 9; d++) {
    observed[d] = benfordExpected[d] + (Math.random() - 0.5) * 8
  }
  // Normalize
  const total = Object.values(observed).reduce((a, b) => a + b, 0)
  for (let d = 1; d <= 9; d++) {
    observed[d] = (observed[d] / total) * 100
  }

  const mad = Object.keys(observed).reduce((sum, d) => {
    return sum + Math.abs(observed[Number(d)] - benfordExpected[Number(d)])
  }, 0) / 9

  return {
    transactions,
    benford_1st: {
      digit_position: 1,
      observed,
      expected: benfordExpected,
      chi_square: 12.5 + Math.random() * 10,
      mad,
      conformity: mad < 0.006 ? 'ACCEPTABLE' : mad < 0.012 ? 'MARGINAL' : 'NON_CONFORMING',
      total_records: transactions.length,
    },
    benford_2nd: {
      digit_position: 2,
      observed: { 0: 12, 1: 11.4, 2: 10.9, 3: 10.4, 4: 10.0, 5: 9.7, 6: 9.3, 7: 9.0, 8: 8.8, 9: 8.5 },
      expected: { 0: 11.97, 1: 11.39, 2: 10.88, 3: 10.43, 4: 10.03, 5: 9.67, 6: 9.34, 7: 9.04, 8: 8.76, 9: 8.50 },
      chi_square: 5.2,
      mad: 0.003,
      conformity: 'ACCEPTABLE',
      total_records: transactions.length,
    },
    round_number: {
      round_count: transactions.filter(t => t.is_round_number).length,
      round_rate: transactions.filter(t => t.is_round_number).length / transactions.length,
      flagged: transactions.filter(t => t.is_round_number).length / transactions.length > 0.15,
      threshold_distribution: { 1000: 12, 5000: 8, 10000: 5, 25000: 3, 50000: 2 },
    },
    portfolio: {
      score: 42 + Math.random() * 20,
      tier: 'MEDIUM',
      outlier_rate: transactions.filter(t => t.is_outlier).length / transactions.length,
      rsf_flag_rate: transactions.filter(t => t.rsf_flag).length / transactions.length,
      duplicate_rate: transactions.filter(t => t.is_exact_duplicate).length / transactions.length,
      benford_mad: mad,
      round_number_rate: transactions.filter(t => t.is_round_number).length / transactions.length,
      total_transactions: transactions.length,
      flagged_transactions: flaggedTransactions.length,
      estimated_exposure: estimatedExposure,
    },
  }
}
