import { useState, useEffect } from 'react'
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react'
import './updateBanner.css'

/**
 * UpdateBanner Component
 *
 * Listens for 'update-available' events pushed from main process on startup.
 * Displays a dismissible banner at the top of the sidebar with version info,
 * a download button, and live progress feedback.
 */
const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string
    downloadUrl: string
    releaseNotes: string
  } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Listen for auto-check result pushed from main on startup
    window.api.onUpdateAvailable((info) => {
      setUpdateInfo({
        latestVersion: info.latestVersion,
        downloadUrl: info.downloadUrl,
        releaseNotes: info.releaseNotes
      })
    })

    // Listen for download progress
    window.api.onUpdateProgress((pct) => {
      setProgress(pct)
    })
  }, [])

  const handleDownload = async (): Promise<void> => {
    if (!updateInfo) return
    setDownloading(true)
    setProgress(0)
    try {
      await window.api.downloadUpdate(updateInfo.downloadUrl)
      // If we reach here the app is about to quit — the bat script takes over
    } catch (err) {
      console.error('Update failed:', err)
      setDownloading(false)
    }
  }

  // Don't render anything if dismissed or no update
  if (dismissed || !updateInfo) return null

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <CheckCircle size={16} className="update-icon" />
        <div className="update-text">
          <strong>v{updateInfo.latestVersion}</strong> available
        </div>
      </div>

      {downloading ? (
        <div className="update-progress">
          <RefreshCw size={14} className="update-spinner" />
          <span className="update-pct">{progress}%</span>
        </div>
      ) : (
        <div className="update-actions">
          <button
            className="update-download-btn"
            onClick={handleDownload}
            title="Download & Update"
          >
            <Download size={14} />
          </button>
          <button className="update-dismiss-btn" onClick={() => setDismissed(true)} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default UpdateBanner
