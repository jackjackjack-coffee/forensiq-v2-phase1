import { Settings, Shield, Bell, Database, Key, Users } from 'lucide-react'
import { DataCard } from '@/components/ui/data-card'

export default function SettingsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure ForensiQ analysis parameters and preferences
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Detection Parameters */}
        <DataCard title="Detection Parameters" description="Configure fraud detection thresholds">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground">Contamination Rate</label>
              <p className="text-xs text-muted-foreground">Expected fraud rate for Isolation Forest</p>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.01"
                defaultValue="0.05"
                className="mt-2 w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>5% (default)</span>
                <span>15%</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">RSF Threshold</label>
              <p className="text-xs text-muted-foreground">Flag transactions with RSF above this value</p>
              <input
                type="number"
                defaultValue="3.0"
                step="0.5"
                min="1"
                max="10"
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Round Number Rate Threshold</label>
              <p className="text-xs text-muted-foreground">Flag portfolio if round number rate exceeds</p>
              <input
                type="number"
                defaultValue="0.15"
                step="0.05"
                min="0.05"
                max="0.5"
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        </DataCard>

        {/* Approval Thresholds */}
        <DataCard title="Approval Thresholds" description="Used for split invoice detection">
          <div className="space-y-4">
            {[500, 1000, 2500, 5000, 10000, 25000, 50000].map((threshold) => (
              <label key={threshold} className="flex items-center justify-between">
                <span className="text-sm text-foreground">${threshold.toLocaleString()}</span>
                <input type="checkbox" defaultChecked className="rounded border-border" />
              </label>
            ))}
          </div>
        </DataCard>

        {/* External APIs */}
        <DataCard title="External API Configuration" description="Configure verification services">
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-success/10 p-2">
                  <Database className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">SEC EDGAR API</p>
                  <p className="text-xs text-muted-foreground">Verify vendor SEC registrations</p>
                </div>
              </div>
              <span className="rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-success/10 p-2">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">OFAC Sanctions List</p>
                  <p className="text-xs text-muted-foreground">Check against sanctions database</p>
                </div>
              </div>
              <span className="rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-warning/10 p-2">
                  <Key className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Nominatim (Address)</p>
                  <p className="text-xs text-muted-foreground">Validate vendor addresses</p>
                </div>
              </div>
              <button className="rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20">
                Configure
              </button>
            </div>
          </div>
        </DataCard>

        {/* Notifications */}
        <DataCard title="Notifications" description="Configure alert preferences">
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Critical risk alerts</p>
                <p className="text-xs text-muted-foreground">Notify when CRITICAL transactions detected</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded border-border" />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">OFAC hit alerts</p>
                <p className="text-xs text-muted-foreground">Notify when vendor matches sanctions list</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded border-border" />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Analysis complete</p>
                <p className="text-xs text-muted-foreground">Notify when batch analysis completes</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded border-border" />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Weekly summary</p>
                <p className="text-xs text-muted-foreground">Send weekly portfolio risk summary</p>
              </div>
              <input type="checkbox" className="rounded border-border" />
            </label>
          </div>
        </DataCard>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button className="rounded-md bg-success px-6 py-2.5 text-sm font-medium text-background hover:bg-success/90">
          Save Settings
        </button>
      </div>
    </div>
  )
}
