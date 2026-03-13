import './pluginBrowser.css'
import React, { useState, useEffect, useRef } from 'react'
import { Package, RefreshCw, Check, Trash2, X } from 'lucide-react'
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

  const handleSetActive = async (id: string | null): Promise<void> => {
    await setActive(id)
  }

  const handleInstall = async (plugin: RegistryPlugin): Promise<void> => {
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
  }

  const handleUninstall = async (id: string): Promise<void> => {
    if (
      window.confirm(
        `Are you sure you want to uninstall this plugin? This will remove all of its saved data.`
      )
    ) {
      if (activePluginId === id) await setActive(null)
      await uninstall(id)
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
                            className="pb-action-btn danger"
                            onClick={() => handleUninstall(plugin.id)}
                            title="Uninstall plugin"
                          >
                            <Trash2 size={12} />
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
                          >
                            Install
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
