import {
  MessageSquare,
  Cpu,
  Search,
  Settings as SettingsIcon,
  FolderOpen,
  Trash2,
  Scissors,
  Video,
  Square,
  Film,
  Crop,
  Mic,
  AudioLines,
  Package
} from 'lucide-react'
import UpdateBanner from './UpdateBanner'
import { usePlugin } from '../contexts/PluginContext'

interface SidebarProps {
  activeAI: 'chatgpt' | 'gemini' | 'perplexity'
  setActiveAI: (ai: 'chatgpt' | 'gemini' | 'perplexity') => void
  onSettingsClick: () => void
  isRecording: boolean
  onToggleRecording: () => void
  regionBoxVisible: boolean
  onToggleRegionBox: () => void
  isAudioRecording: boolean
  onToggleAudioRecording: () => void
  onOpenTrimmer: () => void
  onPluginBrowserClick: () => void
}

/**
 * Sidebar Component
 * Provides navigation between different AI providers, recording controls,
 * and access to management tools.
 */
const Sidebar: React.FC<SidebarProps> = ({
  activeAI,
  setActiveAI,
  onSettingsClick,
  isRecording,
  onToggleRecording,
  regionBoxVisible,
  onToggleRegionBox,
  isAudioRecording,
  onToggleAudioRecording,
  onOpenTrimmer,
  onPluginBrowserClick
}) => {
  const { activePlugin } = usePlugin()
  // Delete all full screenshots from the portable data folder
  const handleClearScreenshots = (): void => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete ALL FULL screenshots? (Snips will be kept)'
      )
    ) {
      window.api.clearScreenshots()
    }
  }

  // Delete all snippets from the portable data folder
  const handleClearSnips = (): void => {
    if (window.confirm('Are you sure you want to permanently delete ALL SNIPS?')) {
      window.api.clearSnips()
    }
  }

  return (
    <div className="sidebar" onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}>
      <div className="sidebar-top">
        {/* Branding */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">AI</div>
          <div className="sidebar-brand-text">
            <strong>AI Overlay+</strong>
            <small>Gaming Suite</small>
          </div>
        </div>

        <UpdateBanner />

        {/* AI Engine Buttons */}
        <div className="sidebar-section-label">Engines</div>
        <button
          className={`sidebar-item ${activeAI === 'chatgpt' ? 'active' : ''}`}
          onClick={() => setActiveAI('chatgpt')}
          title="ChatGPT"
        >
          <MessageSquare size={18} />
          <span className="item-label">ChatGPT</span>
        </button>
        <button
          className={`sidebar-item ${activeAI === 'gemini' ? 'active' : ''}`}
          onClick={() => setActiveAI('gemini')}
          title="Gemini"
        >
          <Cpu size={18} />
          <span className="item-label">Gemini</span>
        </button>
        <button
          className={`sidebar-item ${activeAI === 'perplexity' ? 'active' : ''}`}
          onClick={() => setActiveAI('perplexity')}
          title="Perplexity"
        >
          <Search size={18} />
          <span className="item-label">Perplexity</span>
        </button>

        <div className="sidebar-separator" />

        {/* Screen Recording Controls */}
        <div className="sidebar-section-label">Capture</div>
        <button
          className={`sidebar-item recorder-btn ${isRecording ? 'active' : ''}`}
          onClick={onToggleRecording}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? <Square size={16} /> : <Video size={18} />}
          <span className="item-label">{isRecording ? 'Stop' : 'Record'}</span>
        </button>
        <button
          className={`sidebar-item region-toggle-btn ${regionBoxVisible ? 'active' : ''}`}
          onClick={onToggleRegionBox}
          title={regionBoxVisible ? 'Hide Capture Region' : 'Show Capture Region'}
        >
          <Crop size={18} />
          <span className="item-label">Region</span>
        </button>
        <button
          className="sidebar-item"
          onClick={() => window.api.openRecordingsFolder()}
          title="Open Recordings Folder"
        >
          <Film size={18} />
          <span className="item-label">Recordings</span>
        </button>

        <div className="sidebar-separator" />

        {/* Audio Recording Controls */}
        <div className="sidebar-section-label">Audio</div>
        <button
          className={`sidebar-item audio-rec-btn ${isAudioRecording ? 'active' : ''}`}
          onClick={onToggleAudioRecording}
          title={isAudioRecording ? 'Stop Audio Recording' : 'Start Audio Recording'}
        >
          <Mic size={18} />
          <span className="item-label">{isAudioRecording ? 'Stop Mic' : 'Mic Rec'}</span>
        </button>
        <button className="sidebar-item" onClick={onOpenTrimmer} title="Open Audio Trimmer">
          <AudioLines size={18} />
          <span className="item-label">Trimmer</span>
        </button>

        <div className="sidebar-separator" />

        {/* Data Management */}
        <div className="sidebar-section-label">Data</div>
        <button
          className="sidebar-item"
          onClick={() => window.api.openScreenshotFolder()}
          title="Open Screenshots Folder"
        >
          <FolderOpen size={18} />
          <span className="item-label">Screenshots</span>
        </button>
        <button
          className="sidebar-item delete-item"
          onClick={handleClearScreenshots}
          title="Clear Full Screenshots"
        >
          <Trash2 size={18} />
          <span className="item-label">Clear Shots</span>
        </button>
        <button
          className="sidebar-item delete-item"
          onClick={handleClearSnips}
          title="Clear Snips Only"
        >
          <Scissors size={18} />
          <span className="item-label">Clear Snips</span>
        </button>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-plugin-indicator">
          <button
            className={`sidebar-plugin-btn ${activePlugin ? 'active' : ''}`}
            onClick={onPluginBrowserClick}
            title={activePlugin ? `Plugin: ${activePlugin.name}` : 'No plugin active – browse plugins'}
          >
            <span className="sidebar-plugin-icon">
              {activePlugin?.icon ?? <Package size={15} />}
            </span>
            <span className="sidebar-plugin-label">
              {activePlugin ? activePlugin.name : 'No Plugin'}
            </span>
          </button>
        </div>
        <button className="sidebar-item" onClick={onSettingsClick} title="Settings">
          <SettingsIcon size={18} />
          <span className="item-label">Settings</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
