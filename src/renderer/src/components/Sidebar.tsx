import {
  MessageSquare,
  Cpu,
  Search,
  Settings as SettingsIcon,
  FolderOpen,
  Trash2,
  Scissors
} from 'lucide-react'

interface SidebarProps {
  activeAI: 'chatgpt' | 'gemini' | 'perplexity'
  setActiveAI: (ai: 'chatgpt' | 'gemini' | 'perplexity') => void
  onSettingsClick: () => void
}

/**
 * Sidebar Component
 * Provides navigation between different AI providers and access to management tools.
 */
const Sidebar: React.FC<SidebarProps> = ({ activeAI, setActiveAI, onSettingsClick }) => {
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
    <div className="sidebar">
      <div className="sidebar-top">
        <button
          className={`sidebar-item ${activeAI === 'chatgpt' ? 'active' : ''}`}
          onClick={() => setActiveAI('chatgpt')}
          title="ChatGPT"
        >
          <MessageSquare size={24} />
        </button>
        <button
          className={`sidebar-item ${activeAI === 'gemini' ? 'active' : ''}`}
          onClick={() => setActiveAI('gemini')}
          title="Gemini"
        >
          <Cpu size={24} />
        </button>
        <button
          className={`sidebar-item ${activeAI === 'perplexity' ? 'active' : ''}`}
          onClick={() => setActiveAI('perplexity')}
          title="Perplexity"
        >
          <Search size={24} />
        </button>
        <div className="sidebar-separator" />
        <button
          className="sidebar-item"
          onClick={() => window.api.openScreenshotFolder()}
          title="Open Screenshots Folder"
        >
          <FolderOpen size={24} />
        </button>
        <button
          className="sidebar-item delete-item"
          onClick={handleClearScreenshots}
          title="Clear Full Screenshots"
        >
          <Trash2 size={24} />
        </button>
        <button
          className="sidebar-item delete-item"
          onClick={handleClearSnips}
          title="Clear Snips Only"
        >
          <Scissors size={24} />
        </button>
      </div>
      <div className="sidebar-bottom">
        <button className="sidebar-item" onClick={onSettingsClick} title="Settings">
          <SettingsIcon size={24} />
        </button>
      </div>
    </div>
  )
}

export default Sidebar
