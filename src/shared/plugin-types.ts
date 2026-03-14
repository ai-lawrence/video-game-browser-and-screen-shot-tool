/**
 * Plugin System Shared Types
 * Used by main process, preload bridge, and renderer.
 */

export interface PluginManifest {
  id: string // e.g. "diablo-4"
  name: string // e.g. "Diablo IV Companion"
  version: string // e.g. "1.0.0"
  description: string
  author: string
  icon?: string // emoji or path to icon file
  game?: string // game name for search/filter
  tags?: string[] // e.g. ["arpg", "loot"]

  // Feature flags
  prompts?: PluginPrompt[]
  sidebarButtons?: PluginSidebarButton[]
  theme?: PluginTheme
}

export interface PluginPrompt {
  id: string
  title: string
  icon?: string
  text: string
}

export interface PluginSidebarButton {
  id: string
  label: string
  icon?: string
  action: 'open-url' | 'inject-prompt' | 'toggle-panel'
  payload?: string // URL for open-url, prompt text for inject-prompt
}

export interface PluginTheme {
  primary?: string // CSS color
  surface?: string
  accent?: string
}

/** Registry entry fetched from the remote GitHub plugins.json */
export interface RegistryPlugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  icon?: string
  game?: string
  tags?: string[]
  downloadUrl: string // URL to the plugin zip release asset
}
