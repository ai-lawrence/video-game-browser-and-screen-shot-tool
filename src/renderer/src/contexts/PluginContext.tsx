import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface PluginPrompt {
  id: string
  title: string
  icon?: string
  text: string
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  game?: string
  tags?: string[]
  prompts?: PluginPrompt[]
  theme?: {
    primary?: string
    surface?: string
    accent?: string
  }
}

export interface RegistryPlugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  game?: string
  tags?: string[]
  downloadUrl: string
}

interface PluginContextValue {
  installed: PluginManifest[]
  activePlugin: PluginManifest | null
  activePluginId: string | null
  activePrompts: PluginPrompt[]
  registryPlugins: RegistryPlugin[]
  registryLoading: boolean
  setActive: (id: string | null) => Promise<void>
  installFromManifest: (manifest: PluginManifest) => Promise<void>
  uninstall: (id: string) => Promise<void>
  refreshRegistry: () => Promise<void>
  reload: () => Promise<void>
}

const PluginContext = createContext<PluginContextValue | null>(null)

export function PluginProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [installed, setInstalled] = useState<PluginManifest[]>([])
  const [activePluginId, setActivePluginId] = useState<string | null>(null)
  const [activePrompts, setActivePrompts] = useState<PluginPrompt[]>([])
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([])
  const [registryLoading, setRegistryLoading] = useState(false)

  const reload = useCallback(async () => {
    const plugins = await window.api.getInstalledPlugins()
    setInstalled(plugins)
    const activeId = await window.api.getActivePlugin()
    setActivePluginId(activeId)
    if (activeId) {
      const prompts = await window.api.getPluginPrompts(activeId)
      setActivePrompts(prompts)
    } else {
      setActivePrompts([])
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Apply theme CSS variables when active plugin changes
  const activePlugin = installed.find((p) => p.id === activePluginId) ?? null
  useEffect(() => {
    const root = document.documentElement
    if (activePlugin?.theme) {
      if (activePlugin.theme.primary)
        root.style.setProperty('--plugin-primary', activePlugin.theme.primary)
      if (activePlugin.theme.surface)
        root.style.setProperty('--plugin-surface', activePlugin.theme.surface)
      if (activePlugin.theme.accent)
        root.style.setProperty('--plugin-accent', activePlugin.theme.accent)
    } else {
      root.style.removeProperty('--plugin-primary')
      root.style.removeProperty('--plugin-surface')
      root.style.removeProperty('--plugin-accent')
    }
  }, [activePlugin])

  const setActive = useCallback(
    async (id: string | null) => {
      await window.api.setActivePlugin(id)
      setActivePluginId(id)
      if (id) {
        const prompts = await window.api.getPluginPrompts(id)
        setActivePrompts(prompts)
      } else {
        setActivePrompts([])
      }
    },
    []
  )

  const installFromManifest = useCallback(
    async (manifest: PluginManifest) => {
      await window.api.installPluginFromManifest(manifest)
      await reload()
    },
    [reload]
  )

  const uninstall = useCallback(
    async (id: string) => {
      await window.api.uninstallPlugin(id)
      await reload()
    },
    [reload]
  )

  const refreshRegistry = useCallback(async () => {
    setRegistryLoading(true)
    try {
      const plugins = await window.api.fetchPluginRegistry()
      setRegistryPlugins(plugins)
    } catch {
      setRegistryPlugins([])
    } finally {
      setRegistryLoading(false)
    }
  }, [])

  return (
    <PluginContext.Provider
      value={{
        installed,
        activePlugin,
        activePluginId,
        activePrompts,
        registryPlugins,
        registryLoading,
        setActive,
        installFromManifest,
        uninstall,
        refreshRegistry,
        reload
      }}
    >
      {children}
    </PluginContext.Provider>
  )
}

export function usePlugin(): PluginContextValue {
  const ctx = useContext(PluginContext)
  if (!ctx) throw new Error('usePlugin must be used inside PluginProvider')
  return ctx
}
