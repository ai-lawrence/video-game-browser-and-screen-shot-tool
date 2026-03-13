import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { app } from 'electron'
import type { PluginManifest, PluginPrompt } from '../shared/plugin-types'

// Minimal interface for the electron-store methods we need
interface IStore {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
}

/**
 * PluginManager — Main Process Service
 * Manages plugin lifecycle: scan, install, uninstall, activate, and prompt resolution.
 * All plugins live in `{userData}/plugins/<id>/manifest.json`.
 */
export class PluginManager {
  private store: IStore
  private pluginsDir: string
  private plugins: Map<string, PluginManifest> = new Map()

  constructor(store: IStore) {
    this.store = store
    this.pluginsDir = join(app.getPath('userData'), 'plugins')
    // Ensure the plugins directory exists
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true })
    }
    // Load plugins on construction
    this.loadPlugins()
  }

  /**
   * Scan the plugins directory and load all valid manifests.
   * Invalid manifests (missing id/name) are silently skipped.
   */
  loadPlugins(): PluginManifest[] {
    this.plugins.clear()
    if (!existsSync(this.pluginsDir)) return []

    const entries = readdirSync(this.pluginsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(this.pluginsDir, entry.name, 'manifest.json')
      if (!existsSync(manifestPath)) continue
      try {
        const raw = readFileSync(manifestPath, 'utf-8')
        const manifest = JSON.parse(raw) as PluginManifest
        // Validate minimum required fields
        if (!manifest.id || !manifest.name) continue
        this.plugins.set(manifest.id, manifest)
      } catch {
        console.warn(`[PluginManager] Failed to parse manifest: ${manifestPath}`)
      }
    }

    return Array.from(this.plugins.values())
  }

  /** Returns all installed plugin manifests */
  getInstalledPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values())
  }

  /** Returns the currently active plugin ID from the store */
  getActivePlugin(): string | null {
    return (this.store.get('activePluginId') as string | null) ?? null
  }

  /** Persists the active plugin ID to the store */
  setActivePlugin(id: string | null): void {
    this.store.set('activePluginId', id ?? '')
  }

  /**
   * Install a plugin from a zip buffer.
   * Extracts the zip into `{pluginsDir}/{id}/`.
   * Uses built-in Node.js zlib + manual zip parsing via the `adm-zip` package.
   */
  async installPlugin(zipBuffer: Buffer, id: string): Promise<void> {
    const pluginDir = join(this.pluginsDir, id)
    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true })
    }

    try {
      // Dynamic import to avoid circular dependency in tests
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(zipBuffer)
      zip.extractAllTo(pluginDir, true /* overwrite */)
    } catch (err) {
      console.error(`[PluginManager] Failed to extract plugin ${id}:`, err)
      throw new Error(`Failed to install plugin: ${err}`)
    }

    // Reload plugins to pick up the new manifest
    this.loadPlugins()
  }

  /**
   * Install a plugin directly from a manifest object (no zip needed).
   * Used for bundled/sample plugins.
   */
  installPluginFromManifest(manifest: PluginManifest): void {
    const pluginDir = join(this.pluginsDir, manifest.id)
    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true })
    }
    const manifestPath = join(pluginDir, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    this.plugins.set(manifest.id, manifest)
  }

  /** Uninstall a plugin by removing its directory */
  uninstallPlugin(id: string): void {
    const pluginDir = join(this.pluginsDir, id)
    if (existsSync(pluginDir)) {
      rmSync(pluginDir, { recursive: true, force: true })
    }
    this.plugins.delete(id)

    // Clear active plugin if it was the one just uninstalled
    if (this.getActivePlugin() === id) {
      this.setActivePlugin(null)
    }
  }

  /**
   * Returns prompts for a given plugin.
   * Merges the plugin's built-in prompts with any user-added prompts
   * stored under `pluginPrompts.<id>` in the electron-store.
   */
  getPluginPrompts(id: string): PluginPrompt[] {
    const manifest = this.plugins.get(id)
    const builtInPrompts: PluginPrompt[] = manifest?.prompts ?? []
    const userPrompts = (this.store.get(`pluginPrompts.${id}`) as PluginPrompt[]) ?? []
    return [...builtInPrompts, ...userPrompts]
  }

  /**
   * Get the installed manifest for a specific plugin.
   */
  getPlugin(id: string): PluginManifest | null {
    return this.plugins.get(id) ?? null
  }
}
