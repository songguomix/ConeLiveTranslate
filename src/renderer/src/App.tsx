import React, { useEffect, useState } from 'react'
import type { AppConfig } from './types/config'
import { FloatingView } from './views/FloatingView'
import { DashboardView } from './views/DashboardView'

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const isDashboard = window.location.hash.includes('dashboard')

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => {
      setConfig(cfg)
    })
  }, [])

  if (!config) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent text-white/50 text-xs">
        载入配置中…
      </div>
    )
  }

  return isDashboard ? (
    <DashboardView initialConfig={config} />
  ) : (
    <FloatingView initialConfig={config} />
  )
}
