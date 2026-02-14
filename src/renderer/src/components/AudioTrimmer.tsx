import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Play,
  Pause,
  Scissors,
  Trash2,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  Save
} from 'lucide-react'

interface AudioFileInfo {
  name: string
  path: string
  sizeBytes: number
  createdAt: number
}

/**
 * AudioTrimmer – Full-window component for the trimmer BrowserWindow.
 * Provides a file list of recorded MP3s and a visual timeline trim editor.
 */
const AudioTrimmer: React.FC = () => {
  const [files, setFiles] = useState<AudioFileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<AudioFileInfo | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<'start' | 'end' | null>(null)
  const animFrameRef = useRef<number>(0)
  const blobUrlRef = useRef<string | null>(null)

  /** Load all MP3 files from the audio directory */
  const loadFiles = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.listAudioFiles()
      setFiles(result)
    } catch (err) {
      console.error('Failed to list audio files:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  /** Show a temporary toast message */
  const showToast = useCallback((msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  /** Format seconds to MM:SS.s */
  const formatTime = (sec: number): string => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`
  }

  /** Format file size */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /** Select a file for trimming — loads audio via IPC as blob URL */
  const handleSelectFile = useCallback(async (file: AudioFileInfo): Promise<void> => {
    setSelectedFile(file)
    setTrimStart(0)
    setCurrentTime(0)
    setIsPlaying(false)

    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    try {
      // Get duration from main process (FFmpeg)
      const dur = await window.api.getAudioDuration(file.path)
      setDuration(dur)
      setTrimEnd(dur)

      // Load file bytes via IPC and create blob URL
      const buffer = await window.api.readAudioFile(file.path)
      if (buffer) {
        const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url

        // Set audio element src
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.load()
        }
      }
    } catch {
      setDuration(0)
      setTrimEnd(0)
    }
  }, [])

  /** Delete a file with confirmation */
  const handleDelete = useCallback(
    async (file: AudioFileInfo): Promise<void> => {
      if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return
      try {
        await window.api.deleteAudioFile(file.path)
        showToast(`Deleted ${file.name}`)
        // If we were trimming this file, go back to list
        if (selectedFile?.path === file.path) {
          setSelectedFile(null)
        }
        loadFiles()
      } catch (err) {
        showToast(`Failed to delete: ${err}`)
      }
    },
    [selectedFile, showToast, loadFiles]
  )

  /** Play audio from the beginning or current position */
  const handlePlayPause = useCallback((): void => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  /** Play only the selected trim region */
  const handlePlaySelection = useCallback((): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = trimStart
    audio.play()
    setIsPlaying(true)
  }, [trimStart])

  /** Update current time during playback */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isPlaying) return

    const update = (): void => {
      setCurrentTime(audio.currentTime)

      // Stop at trim end when playing selection
      if (audio.currentTime >= trimEnd) {
        audio.pause()
        setIsPlaying(false)
        return
      }
      animFrameRef.current = requestAnimationFrame(update)
    }
    animFrameRef.current = requestAnimationFrame(update)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, trimEnd])

  /** Handle audio ended event */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = (): void => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [selectedFile])

  /** Trim and save */
  const handleTrim = useCallback(async (): Promise<void> => {
    if (!selectedFile || trimming) return
    if (trimStart >= trimEnd) {
      showToast('Invalid trim range')
      return
    }
    setTrimming(true)
    try {
      const newPath = await window.api.trimAudio(selectedFile.path, trimStart, trimEnd)
      showToast(`Saved: ${newPath.split(/[\\/]/).pop()}`)
      loadFiles()
    } catch (err) {
      showToast(`Trim failed: ${err}`)
    }
    setTrimming(false)
  }, [selectedFile, trimStart, trimEnd, trimming, showToast, loadFiles])

  /** Timeline click/drag for trim handles */
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = handle
  }, [])

  /** Track mouse movement for dragging trim handles */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!draggingRef.current || !timelineRef.current || duration <= 0) return
      const rect = timelineRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const time = ratio * duration

      if (draggingRef.current === 'start') {
        setTrimStart(Math.min(time, trimEnd - 0.1))
      } else {
        setTrimEnd(Math.max(time, trimStart + 0.1))
      }
    }

    const handleMouseUp = (): void => {
      draggingRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [duration, trimStart, trimEnd])

  /** Click on timeline to seek */
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent): void => {
      if (!timelineRef.current || duration <= 0) return
      const rect = timelineRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const time = ratio * duration
      if (audioRef.current) {
        audioRef.current.currentTime = time
        setCurrentTime(time)
      }
    },
    [duration]
  )

  /** Back to file list */
  const handleBack = useCallback((): void => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setSelectedFile(null)
    setIsPlaying(false)
    loadFiles()
  }, [loadFiles])

  // ── RENDER ──

  return (
    <div className="trimmer-container">
      {/* Title bar */}
      <div className="trimmer-header">
        <div className="trimmer-title-area">
          {selectedFile && (
            <button className="trimmer-back-btn" onClick={handleBack} title="Back to file list">
              <ArrowLeft size={18} />
            </button>
          )}
          <h1>{selectedFile ? selectedFile.name : 'Audio Trimmer'}</h1>
        </div>
        <button className="trimmer-close-btn" onClick={() => window.close()} title="Close">
          <X size={20} />
        </button>
      </div>

      {/* Toast notification */}
      {toast && <div className="trimmer-toast">{toast}</div>}

      {/* File List View */}
      {!selectedFile && (
        <div className="audio-file-list-container">
          <div className="audio-file-toolbar">
            <button className="audio-toolbar-btn" onClick={loadFiles} title="Refresh">
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              className="audio-toolbar-btn"
              onClick={() => window.api.openAudioFolder()}
              title="Open Folder"
            >
              <FolderOpen size={16} /> Open Folder
            </button>
          </div>

          {loading ? (
            <div className="audio-empty-state">Loading...</div>
          ) : files.length === 0 ? (
            <div className="audio-empty-state">
              No audio recordings found.
              <br />
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                Record audio using the microphone button in the main app.
              </span>
            </div>
          ) : (
            <div className="audio-file-list">
              {files.map((file) => (
                <div key={file.path} className="audio-file-item">
                  <div className="audio-file-info">
                    <span className="audio-file-name">{file.name}</span>
                    <span className="audio-file-meta">
                      {formatSize(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString()}{' '}
                      {new Date(file.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="audio-file-actions">
                    <button
                      className="audio-action-btn trim-btn"
                      onClick={() => handleSelectFile(file)}
                      title="Trim"
                    >
                      <Scissors size={16} />
                    </button>
                    <button
                      className="audio-action-btn delete-btn"
                      onClick={() => handleDelete(file)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trim Editor View */}
      {selectedFile && (
        <div className="trim-editor">
          <audio ref={audioRef} preload="metadata" />

          {/* Time readout */}
          <div className="trim-time-readout">
            <span>
              Start: <strong>{formatTime(trimStart)}</strong>
            </span>
            <span>
              End: <strong>{formatTime(trimEnd)}</strong>
            </span>
            <span>
              Selection: <strong>{formatTime(trimEnd - trimStart)}</strong>
            </span>
            <span>
              Total: <strong>{formatTime(duration)}</strong>
            </span>
          </div>

          {/* Timeline */}
          <div className="trim-timeline" ref={timelineRef} onClick={handleTimelineClick}>
            {/* Selection region */}
            <div
              className="trim-selection"
              style={{
                left: `${(trimStart / duration) * 100}%`,
                width: `${((trimEnd - trimStart) / duration) * 100}%`
              }}
            />

            {/* Playhead */}
            {duration > 0 && (
              <div
                className="trim-playhead"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            )}

            {/* Start handle */}
            <div
              className="trim-handle trim-handle-start"
              style={{ left: `${(trimStart / duration) * 100}%` }}
              onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
            />

            {/* End handle */}
            <div
              className="trim-handle trim-handle-end"
              style={{ left: `${(trimEnd / duration) * 100}%` }}
              onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
            />
          </div>

          {/* Controls */}
          <div className="trim-controls">
            <button
              className="trim-control-btn"
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              className="trim-control-btn play-selection-btn"
              onClick={handlePlaySelection}
              title="Play Selection"
            >
              <Play size={18} />
              Play Selection
            </button>

            <button
              className="trim-control-btn save-btn"
              onClick={handleTrim}
              disabled={trimming}
              title="Trim & Save"
            >
              <Save size={18} />
              {trimming ? 'Trimming...' : 'Trim & Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioTrimmer
