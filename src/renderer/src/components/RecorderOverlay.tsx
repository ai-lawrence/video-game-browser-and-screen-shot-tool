import React from 'react'
import type { RecorderStatus } from '../hooks/useScreenRecorder'

interface RecorderOverlayProps {
  status: RecorderStatus
  elapsed: number
  bufferSeconds: number
  bufferLength: number
  systemAudioEnabled: boolean
  micEnabled: boolean
}

/**
 * Compact overlay indicator for the screen recorder.
 * Shows recording/buffering status at the top-right of the main content area.
 * - Buffering: pulsing red dot + buffer capacity text
 * - Recording: red dot + elapsed timer with max duration
 * - Audio indicators: 🔊 for system audio, 🎤 for microphone
 */
const RecorderOverlay: React.FC<RecorderOverlayProps> = ({
  status,
  elapsed,
  bufferSeconds,
  bufferLength,
  systemAudioEnabled,
  micEnabled
}) => {
  if (status === 'idle') return null

  /** Format seconds as MM:SS */
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="recorder-overlay">
      <div className={`recorder-dot ${status === 'buffering' ? 'pulse' : ''}`} />
      {status === 'recording' && (
        <span className="recorder-timer">
          {formatTime(elapsed)} / {formatTime(60)}
        </span>
      )}
      {status === 'buffering' && (
        <span className="recorder-timer">
          {bufferSeconds}s / {bufferLength}s Buffer
        </span>
      )}
      {systemAudioEnabled && (
        <span className="recorder-audio-icon" title="System audio">
          🔊
        </span>
      )}
      {micEnabled && (
        <span className="recorder-audio-icon" title="Microphone">
          🎤
        </span>
      )}
    </div>
  )
}

export default RecorderOverlay
