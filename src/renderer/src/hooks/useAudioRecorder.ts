import { useState, useRef, useCallback } from 'react'

/**
 * Audio recording modes:
 * - 'system': Desktop/system audio only
 * - 'system+mic': Desktop audio mixed with microphone
 * - 'mic': Microphone only
 */
export type AudioRecordingMode = 'system' | 'system+mic' | 'mic'

/** Maximum audio recording duration in seconds (30 minutes) */
const MAX_AUDIO_RECORDING_SECONDS = 1800

interface UseAudioRecorderOptions {
  audioRecordingMode: AudioRecordingMode
  selectedMicDeviceId: string
  onSaved?: (filePath: string) => void
  onError?: (error: string) => void
}

/**
 * Custom hook for audio-only recording.
 *
 * Supports three modes:
 *   - 'system': captures desktop audio via desktopCapturer
 *   - 'system+mic': captures desktop audio + microphone, mixed via Web Audio API
 *   - 'mic': captures microphone only via getUserMedia
 *
 * Audio is recorded as WebM/Opus and sent to the main process for
 * FFmpeg conversion to MP3.
 */
export function useAudioRecorder(options: UseAudioRecorderOptions): {
  isRecording: boolean
  elapsed: number
  startRecording: () => Promise<void>
  stopRecording: () => void
} {
  const { audioRecordingMode, selectedMicDeviceId, onSaved, onError } = options

  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const desktopStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const isRecordingRef = useRef(false)

  /** Acquire system audio stream via desktopCapturer */
  const acquireSystemAudio = useCallback(async (): Promise<MediaStream> => {
    // Get the first screen source for system audio loopback
    const sources = await window.api.getDesktopSources()
    if (!sources || sources.length === 0) {
      throw new Error('No desktop sources available for system audio')
    }
    const srcId = sources[0].id

    // Request audio-only stream using Electron's chromeMediaSource
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-ignore — Electron-specific mandatory constraints for system audio loopback
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: srcId
        }
      },
      video: {
        // @ts-ignore — must request video with chromeMediaSource but we discard it
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: srcId,
          maxWidth: 1,
          maxHeight: 1,
          maxFrameRate: 1
        }
      }
    })

    // Remove the video tracks — we only want audio
    stream.getVideoTracks().forEach((track) => track.stop())

    return new MediaStream(stream.getAudioTracks())
  }, [])

  /** Acquire microphone audio stream */
  const acquireMicStream = useCallback(async (): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      audio: selectedMicDeviceId ? { deviceId: { exact: selectedMicDeviceId } } : true,
      video: false
    }
    return navigator.mediaDevices.getUserMedia(constraints)
  }, [selectedMicDeviceId])

  /** Release all active streams and clean up resources */
  const releaseStreams = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (desktopStreamRef.current) {
      desktopStreamRef.current.getTracks().forEach((t) => t.stop())
      desktopStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  /** Clear the elapsed timer */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Start audio-only recording */
  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecordingRef.current) return

    try {
      let recordingStream: MediaStream

      if (audioRecordingMode === 'mic') {
        // Mic only
        const micStream = await acquireMicStream()
        micStreamRef.current = micStream
        recordingStream = micStream
      } else if (audioRecordingMode === 'system+mic') {
        // System audio + mic — mix via Web Audio API
        const systemStream = await acquireSystemAudio()
        desktopStreamRef.current = systemStream
        const micStream = await acquireMicStream()
        micStreamRef.current = micStream

        const ctx = new AudioContext()
        audioContextRef.current = ctx
        const dest = ctx.createMediaStreamDestination()
        ctx.createMediaStreamSource(systemStream).connect(dest)
        ctx.createMediaStreamSource(micStream).connect(dest)
        recordingStream = dest.stream
      } else {
        // System audio only (default)
        const systemStream = await acquireSystemAudio()
        desktopStreamRef.current = systemStream
        recordingStream = systemStream
      }

      streamRef.current = recordingStream

      // Determine best audio MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(recordingStream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async (): Promise<void> => {
        const chunks = [...chunksRef.current]
        chunksRef.current = []
        releaseStreams()
        clearTimer()
        setIsRecording(false)
        isRecordingRef.current = false
        setElapsed(0)
        elapsedRef.current = 0

        if (chunks.length === 0) {
          onError?.('No audio data recorded')
          return
        }

        try {
          const blob = new Blob(chunks, { type: mimeType })
          const arrayBuffer = await blob.arrayBuffer()
          const uint8 = new Uint8Array(arrayBuffer)
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const filename = `audio-${timestamp}.mp3`
          const filePath = await window.api.saveAudioRecording(uint8, filename)
          onSaved?.(filePath)
        } catch (err) {
          onError?.(`Failed to save audio: ${err}`)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000) // 1-second timeslice

      setIsRecording(true)
      isRecordingRef.current = true
      elapsedRef.current = 0
      setElapsed(0)

      // Elapsed timer with 30-minute auto-stop
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
        if (elapsedRef.current >= MAX_AUDIO_RECORDING_SECONDS) {
          mediaRecorderRef.current?.stop()
        }
      }, 1000)
    } catch (err) {
      onError?.(`Failed to start audio recording: ${err}`)
      releaseStreams()
    }
  }, [
    audioRecordingMode,
    acquireSystemAudio,
    acquireMicStream,
    releaseStreams,
    clearTimer,
    onSaved,
    onError
  ])

  /** Stop audio recording */
  const stopRecording = useCallback((): void => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
  }, [])

  return { isRecording, elapsed, startRecording, stopRecording }
}
