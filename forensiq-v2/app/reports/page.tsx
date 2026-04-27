import { FileText, Download, Clock, CheckCircle2 } from 'lucide-react'
import { DataCard } from '@/components/ui/data-card'

const reportTypes = [
  {
    name: 'Executive Summary',
    description: 'High-level overview of portfolio risk with key findings and recommendations',
    format: 'PDF',
    icon: FileText,
  },
  {
    name: 'Detailed Analysis Report',
    description: 'Comprehensive analysis including all detector results and statistical measures',
    format: 'PDF',
    icon: FileText,
  },
  {
    name: 'Transaction Export',
    description: 'Full transaction data with risk scores and triggered detectors',
    format: 'CSV',
    icon: FileText,
  },
  {
    name: 'Benford Analysis Report',
    description: 'Detailed Benford\'s Law conformity analysis with visualizations',
    format: 'PDF',
    icon: FileText,
  },
  {
    name: 'Vendor Risk Report',
    description: 'Vendor-level risk assessment with verification status',
    format: 'PDF',
    icon: FileText,
  },
]

const recentReports = [
  { name: 'Executive_Summary_2024-01.pdf', date: '2024-01-15', status: 'complete' },
  { name: 'Transaction_Export_2024-01.csv', date: '2024-01-14', status: 'complete' },
  { name: 'Benford_Analysis_2024-01.pdf', date: '2024-01-12', status: 'complete' },
]

export default function ReportsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and download forensic analysis reports
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Report Types */}
        <div className="col-span-2">
          <DataCard title="Generate Report" description="Select a report type to generate">
            <div className="grid gap-4">
              {reportTypes.map((report) => (
                <div
                  key={report.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-md bg-success/10 p-2">
                      <report.icon className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{report.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{report.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {report.format}
                    </span>
                    <button className="flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-background hover:bg-success/90">
                      <Download className="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>

        {/* Recent Reports */}
        <div>
          <DataCard title="Recent Reports" description="Previously generated reports">
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div
                  key={report.name}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{report.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {report.date}
                      </div>
                    </div>
                  </div>
                  <button className="rounded-md p-1.5 hover:bg-muted">
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </DataCard>

          {/* Report Settings */}
          <DataCard title="Report Settings" description="Configure default options" className="mt-6">
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Include charts</span>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Include raw data</span>
                <input type="checkbox" className="rounded border-border" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-foreground">Auto-email reports</span>
                <input type="checkbox" className="rounded border-border" />
              </label>
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  )
}
