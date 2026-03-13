import './pluginBrowser.css'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Package, RefreshCw, Check, Trash2, X, Loader2 } from 'lucide-react'
import { usePlugin } from '../../contexts/PluginContext'
import type { RegistryPlugin, PluginManifest } from '../../contexts/PluginContext'
import PluginCard from './PluginCard'

interface PluginBrowserProps {
  onClose: () => void
}

/**
 * PluginBrowser — Full-screen panel for managing installed/available plugins.
 * Tabs: Installed | Browse
 */
export default function PluginBrowser({ onClose }: PluginBrowserProps): React.JSX.Element {
  const {
    installed,
    activePluginId,
    registryPlugins,
    registryLoading,
    setActive,
    installFromManifest,
    uninstall,
    refreshRegistry
  } = usePlugin()

  const [tab, setTab] = useState<'installed' | 'browse'>('installed')

  // Use a ref (not state) to track whether we've triggered the registry load —
  // avoids the cascading-setState-in-effect lint warning.
  const hasLoadedRegistryRef = useRef(false)
  useEffect(() => {
    if (tab === 'browse' && !hasLoadedRegistryRef.current) {
      hasLoadedRegistryRef.current = true
      refreshRegistry()
    }
  }, [tab, refreshRegistry])

  // Loading / confirmation state
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null)

  // Dismiss the confirm prompt when clicking anywhere outside the danger button
  const dismissConfirm = useCallback(() => setConfirmUninstallId(null), [])
  useEffect(() => {
    if (!confirmUninstallId) return
    const handler = (): void => dismissConfirm()
    // Use a short timeout so the click that SET the confirmId doesn't also dismiss it
    const id = setTimeout(() => document.addEventListener('click', handler), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', handler)
    }
  }, [confirmUninstallId, dismissConfirm])

  const handleSetActive = async (id: string | null): Promise<void> => {
    await setActive(id)
  }

  const handleInstall = async (plugin: RegistryPlugin): Promise<void> => {
    setInstallingId(plugin.id)
    try {
      // For registry plugins from GitHub, download the zip and install it
      // For MVP, install a minimal manifest from registry metadata
      const manifest: PluginManifest = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        icon: plugin.icon,
        game: plugin.game,
        tags: plugin.tags,
        prompts: []
      }
      await installFromManifest(manifest)
    } finally {
      setInstallingId(null)
    }
  }

  /** Two-click uninstall: first click shows "Confirm?", second click executes. */
  const handleUninstallClick = (id: string): void => {
    if (confirmUninstallId === id) {
      // Second click — confirmed, do the uninstall
      handleUninstall(id)
    } else {
      // First click — show confirmation state
      setConfirmUninstallId(id)
    }
  }

  const handleUninstall = async (id: string): Promise<void> => {
    setUninstallingId(id)
    try {
      if (activePluginId === id) await setActive(null)
      await uninstall(id)
    } finally {
      setUninstallingId(null)
      setConfirmUninstallId(null)
    }
  }

  const installedIds = new Set(installed.map((p) => p.id))

  return (
    <div
      className="plugin-browser-overlay"
      onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}
    >
      <div className="plugin-browser-panel">
        {/* Header */}
        <div className="plugin-browser-header">
          <Package size={18} />
          <h2>Game Plugins</h2>
          <button className="pb-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="plugin-browser-tabs">
          <button
            className={`pb-tab ${tab === 'installed' ? 'active' : ''}`}
            onClick={() => setTab('installed')}
          >
            Installed ({installed.length})
          </button>
          <button
            className={`pb-tab ${tab === 'browse' ? 'active' : ''}`}
            onClick={() => setTab('browse')}
          >
            Browse
          </button>
          {tab === 'browse' && (
            <button
              className="pb-refresh-btn"
              onClick={refreshRegistry}
              disabled={registryLoading}
              title="Refresh plugin registry"
            >
              <RefreshCw size={14} className={registryLoading ? 'spinning' : ''} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="plugin-browser-content">
          {tab === 'installed' && (
            <>
              {installed.length === 0 ? (
                <div className="pb-empty">
                  <Package size={40} />
                  <p>No plugins installed yet.</p>
                  <p>Browse the plugin registry to add game-specific prompts and themes.</p>
                </div>
              ) : (
                <div className="pb-plugin-list">
                  {/* None option to deactivate */}
                  <div
                    className={`pb-none-card ${!activePluginId ? 'active' : ''}`}
                    onClick={() => handleSetActive(null)}
                  >
                    <span className="pb-none-icon">∅</span>
                    <div className="pb-none-text">
                      <strong>No Plugin</strong>
                      <small>Vanilla mode — no game theme</small>
                    </div>
                    {!activePluginId && <Check size={16} className="pb-active-check" />}
                  </div>

                  {installed.map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      isActive={activePluginId === plugin.id}
                      actions={
                        <>
                          <button
                            className={`pb-action-btn ${activePluginId === plugin.id ? 'primary' : ''}`}
                            onClick={() =>
                              handleSetActive(activePluginId === plugin.id ? null : plugin.id)
                            }
                          >
                            {activePluginId === plugin.id ? (
                              <>
                                <Check size={12} /> Active
                              </>
                            ) : (
                              'Activate'
                            )}
                          </button>
                          <button
                            className={`pb-action-btn danger ${confirmUninstallId === plugin.id ? 'confirm-danger' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUninstallClick(plugin.id)
                            }}
                            disabled={uninstallingId === plugin.id}
                            title={
                              confirmUninstallId === plugin.id
                                ? 'Click again to confirm'
                                : 'Uninstall plugin'
                            }
                          >
                            {uninstallingId === plugin.id ? (
                              <>
                                <Loader2 size={12} className="spinning" /> Removing…
                              </>
                            ) : confirmUninstallId === plugin.id ? (
                              'Confirm?'
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'browse' && (
            <>
              {registryLoading && registryPlugins.length === 0 ? (
                <div className="pb-loading">
                  <RefreshCw size={24} className="spinning" />
                  <p>Loading plugin registry…</p>
                </div>
              ) : registryPlugins.length === 0 ? (
                <div className="pb-empty">
                  <Package size={40} />
                  <p>No plugins in the registry yet.</p>
                  <p>Check back soon or contribute your own at GitHub.</p>
                </div>
              ) : (
                <div className="pb-plugin-list">
                  {registryPlugins.map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin as PluginManifest}
                      isActive={activePluginId === plugin.id}
                      actions={
                        installedIds.has(plugin.id) ? (
                          <button className="pb-action-btn installed" disabled>
                            <Check size={12} /> Installed
                          </button>
                        ) : (
                          <button
                            className="pb-action-btn primary"
                            onClick={() => handleInstall(plugin)}
                            disabled={installingId === plugin.id}
                          >
                            {installingId === plugin.id ? (
                              <>
                                <Loader2 size={12} className="spinning" /> Installing…
                              </>
                            ) : (
                              'Install'
                            )}
                          </button>
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
