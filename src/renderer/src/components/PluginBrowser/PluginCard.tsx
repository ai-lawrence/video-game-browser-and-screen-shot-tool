import type { PluginManifest } from '../../contexts/PluginContext'

interface PluginCardProps {
  plugin: PluginManifest
  isActive: boolean
  actions: React.ReactNode
}

/**
 * PluginCard — Display card for a single plugin in the PluginBrowser.
 */
export default function PluginCard({ plugin, isActive, actions }: PluginCardProps): React.JSX.Element {
  return (
    <div className={`plugin-card ${isActive ? 'active' : ''}`}>
      <div className="plugin-card-icon">
        {plugin.icon && plugin.icon.startsWith('/') ? (
          <img src={plugin.icon} alt={plugin.name} />
        ) : (
          <span>{plugin.icon ?? '🎮'}</span>
        )}
      </div>
      <div className="plugin-card-info">
        <div className="plugin-card-title">
          <strong>{plugin.name}</strong>
          <span className="plugin-card-version">v{plugin.version}</span>
        </div>
        {plugin.game && <div className="plugin-card-game">🎮 {plugin.game}</div>}
        <p className="plugin-card-desc">{plugin.description}</p>
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="plugin-card-tags">
            {plugin.tags.map((tag) => (
              <span key={tag} className="plugin-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="plugin-card-actions">{actions}</div>
    </div>
  )
}
