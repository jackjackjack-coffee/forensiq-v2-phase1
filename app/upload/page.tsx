'use client'

import { useState, useCallback } from 'react'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataCard } from '@/components/ui/data-card'

type Step = 'upload' | 'mapping' | 'analyzing' | 'complete'

const requiredFields = [
  { key: 'amount', label: 'Amount', description: 'Transaction amount (required)', required: true },
  { key: 'date', label: 'Date', description: 'Transaction date (required)', required: true },
  { key: 'vendor', label: 'Vendor', description: 'Vendor/supplier name (required)', required: true },
]

const optionalFields = [
  { key: 'invoice_id', label: 'Invoice ID', description: 'Unique invoice identifier' },
  { key: 'description', label: 'Description', description: 'Transaction description' },
  { key: 'category', label: 'Category', description: 'Expense category' },
  { key: 'approved_by', label: 'Approved By', description: 'Approver name' },
]

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [previewData, setPreviewData] = useState<string[][]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'text/csv' || droppedFile?.name.endsWith('.csv')) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    
    // Parse CSV headers
    const text = await selectedFile.text()
    const lines = text.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    setCsvColumns(headers)
    
    // Get preview data (first 5 rows)
    const preview = lines.slice(0, 6).map(line => 
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    )
    setPreviewData(preview)
    
    // Auto-map columns based on common names
    const autoMapping: Record<string, string> = {}
    headers.forEach(header => {
      const lower = header.toLowerCase()
      if (lower.includes('amount') || lower.includes('total') || lower.includes('value')) {
        autoMapping['amount'] = header
      } else if (lower.includes('date') || lower.includes('time')) {
        autoMapping['date'] = header
      } else if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('payee')) {
        autoMapping['vendor'] = header
      } else if (lower.includes('invoice') || lower.includes('id') || lower.includes('number')) {
        autoMapping['invoice_id'] = header
      } else if (lower.includes('desc') || lower.includes('memo') || lower.includes('note')) {
        autoMapping['description'] = header
      } else if (lower.includes('category') || lower.includes('type')) {
        autoMapping['category'] = header
      } else if (lower.includes('approved') || lower.includes('approver')) {
        autoMapping['approved_by'] = header
      }
    })
    setColumnMapping(autoMapping)
    setStep('mapping')
  }

  const handleAnalyze = () => {
    setStep('analyzing')
    // Simulate analysis
    setTimeout(() => {
      setStep('complete')
    }, 3000)
  }

  const requiredMapped = requiredFields.every(f => columnMapping[f.key])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Upload Transaction Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV file to begin forensic analysis
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center gap-4">
        {(['upload', 'mapping', 'analyzing', 'complete'] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-4">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              step === s ? 'bg-success text-background' :
              idx < ['upload', 'mapping', 'analyzing', 'complete'].indexOf(step)
                ? 'bg-success/20 text-success'
                : 'bg-muted text-muted-foreground'
            )}>
              {idx < ['upload', 'mapping', 'analyzing', 'complete'].indexOf(step) ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                idx + 1
              )}
            </div>
            <span className={cn(
              'text-sm font-medium',
              step === s ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {s === 'upload' ? 'Upload File' :
               s === 'mapping' ? 'Map Columns' :
               s === 'analyzing' ? 'Analyzing' : 'Complete'}
            </span>
            {idx < 3 && (
              <div className={cn(
                'h-px w-12',
                idx < ['upload', 'mapping', 'analyzing', 'complete'].indexOf(step)
                  ? 'bg-success'
                  : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
            isDragging ? 'border-success bg-success/5' : 'border-border bg-card'
          )}
        >
          <Upload className={cn(
            'h-12 w-12',
            isDragging ? 'text-success' : 'text-muted-foreground'
          )} />
          <p className="mt-4 text-lg font-medium text-foreground">
            Drag and drop your CSV file here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <div className="relative mt-6">
            <label className="cursor-pointer rounded-md bg-success px-6 py-2.5 text-sm font-medium text-background hover:bg-success/90">
              Select File
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="sr-only"
              />
            </label>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Supported format: CSV (up to 100,000 rows)
          </p>
        </div>
      )}

      {step === 'mapping' && file && (
        <div className="grid grid-cols-3 gap-6">
          {/* Column Mapping */}
          <div className="col-span-2 space-y-6">
            <DataCard 
              title="Map Required Fields" 
              description="Select the CSV column that corresponds to each field"
            >
              <div className="space-y-4">
                {requiredFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-40">
                      <p className="text-sm font-medium text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                      className={cn(
                        'flex-1 rounded-md border bg-card px-3 py-2 text-sm text-foreground',
                        columnMapping[field.key] ? 'border-success' : 'border-border'
                      )}
                    >
                      <option value="">Select column...</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {columnMapping[field.key] && (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                  </div>
                ))}
              </div>
            </DataCard>

            <DataCard 
              title="Map Optional Fields" 
              description="These fields enhance analysis but are not required"
            >
              <div className="space-y-4">
                {optionalFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-40">
                      <p className="text-sm font-medium text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                      className={cn(
                        'flex-1 rounded-md border bg-card px-3 py-2 text-sm text-foreground',
                        columnMapping[field.key] ? 'border-success/50' : 'border-border'
                      )}
                    >
                      <option value="">Select column (optional)...</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {columnMapping[field.key] && (
                      <CheckCircle2 className="h-5 w-5 text-success/70" />
                    )}
                  </div>
                ))}
              </div>
            </DataCard>
          </div>

          {/* File Info & Preview */}
          <div className="space-y-6">
            <DataCard title="File Information">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-10 w-10 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {csvColumns.length} columns detected
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setFile(null)
                    setCsvColumns([])
                    setColumnMapping({})
                    setPreviewData([])
                    setStep('upload')
                  }}
                  className="rounded-md p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </DataCard>

            <DataCard title="Data Preview" description="First 5 rows">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {previewData[0]?.map((header, i) => (
                        <th key={i} className="whitespace-nowrap px-2 py-1 text-left text-muted-foreground">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(1).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((cell, j) => (
                          <td key={j} className="whitespace-nowrap px-2 py-1 text-foreground">
                            {cell.slice(0, 20)}{cell.length > 20 ? '...' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>

            <button
              onClick={handleAnalyze}
              disabled={!requiredMapped}
              className={cn(
                'w-full rounded-md py-3 text-sm font-medium transition-colors',
                requiredMapped
                  ? 'bg-success text-background hover:bg-success/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              )}
            >
              {requiredMapped ? 'Start Analysis' : 'Map Required Fields'}
            </button>
          </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
          <Loader2 className="h-12 w-12 animate-spin text-success" />
          <p className="mt-4 text-lg font-medium text-foreground">Analyzing transactions...</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Running 9 forensic detection algorithms
          </p>
          <div className="mt-6 w-64">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full animate-pulse rounded-full bg-success" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">{previewData.length - 1}+</p>
              <p className="text-xs text-muted-foreground">Records</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">9</p>
              <p className="text-xs text-muted-foreground">Detectors</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">3</p>
              <p className="text-xs text-muted-foreground">External APIs</p>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-success/30 bg-success/5 py-16">
          <CheckCircle2 className="h-16 w-16 text-success" />
          <p className="mt-4 text-xl font-semibold text-foreground">Analysis Complete</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your forensic analysis is ready to review
          </p>
          <div className="mt-8 flex gap-4">
            <a 
              href="/"
              className="rounded-md bg-success px-6 py-2.5 text-sm font-medium text-background hover:bg-success/90"
            >
              View Dashboard
            </a>
            <a 
              href="/transactions"
              className="rounded-md border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              View Transactions
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
