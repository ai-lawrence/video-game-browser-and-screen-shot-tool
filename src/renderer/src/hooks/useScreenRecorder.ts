import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Recorder status:
 * - 'idle': No active recording or buffering
 * - 'recording': Manual recording in progress (hard cap at 30 min)
 * - 'buffering': Background instant-replay buffer is running
 */
export type RecorderStatus = 'idle' | 'recording' | 'buffering'

export interface RecorderState {
  status: RecorderStatus
  elapsed: number
  bufferSeconds: number
  sourceId: string | null
}

/** Region bounds in CSS pixels */
export interface RegionBounds {
  x: number
  y: number
  w: number
  h: number
}

interface UseScreenRecorderOptions {
  bufferLength: number
  systemAudioEnabled: boolean
  micEnabled: boolean
  selectedMicDeviceId: string
  recordingResolution: string
  customAspectRatio: boolean
  aspectRatioPreset: string
  regionBoxEnabled: boolean
  regionBounds: RegionBounds | null
  onSaved?: (filePath: string) => void
  onError?: (error: string) => void
}

/** Maximum manual recording duration in seconds (30 minutes) */
const MAX_RECORDING_SECONDS = 1800

/** Resolution presets — maps name to max capture dimensions for full-screen mode */
const RESOLUTION_MAP: Record<string, { maxWidth: number; maxHeight: number }> = {
  '720p': { maxWidth: 1280, maxHeight: 720 },
  '1080p': { maxWidth: 1920, maxHeight: 1080 },
  '1440p': { maxWidth: 2560, maxHeight: 1440 }
}

/** Bitrate presets — scales with resolution for consistent quality */
const BITRATE_MAP: Record<string, number> = {
  '720p': 10_000_000,
  '1080p': 20_000_000,
  '1440p': 50_000_000
}

/**
 * Compute output pixel dimensions from a resolution setting and aspect ratio.
 * The resolution value controls the shorter side of the output.
 */
function getOutputDimensions(resolution: string, aspectRatio: string): { w: number; h: number } {
  const shortSide = { '720p': 720, '1080p': 1080, '1440p': 1440 }[resolution] || 1080
  const [aw, ah] = aspectRatio.split(':').map(Number)
  if (!aw || !ah) return { w: 1920, h: 1080 }

  if (aw >= ah) {
    // Landscape or square — short side is the height
    return { w: Math.round(shortSide * (aw / ah)), h: shortSide }
  }
  // Portrait — short side is the width
  return { w: shortSide, h: Math.round(shortSide * (ah / aw)) }
}

/**
 * Determine the best supported MIME type for MediaRecorder.
 * Prefers MP4 (H.264) for universal seekability, falls back to WebM (VP9/VP8).
 */
function getSupportedMimeType(): string {
  const candidates = [
    'video/mp4; codecs=avc1,mp4a.40.2',
    'video/mp4; codecs=avc1',
    'video/mp4',
    'video/webm; codecs=vp9,opus',
    'video/webm; codecs=vp9',
    'video/webm; codecs=vp8',
    'video/webm'
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return 'video/webm'
}

/** Get the file extension for a given MIME type. */
function getExtensionForMime(mime: string): string {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm'
}

/**
 * Custom hook encapsulating all screen recording and instant-replay logic.
 *
 * **Buffer architecture (auto-rotating sessions):**
 * The MediaRecorder is automatically stopped and restarted every `bufferLength`
 * seconds. Each completed session's chunks are stored as the "clip-ready" data.
 * When the user saves a clip:
 *   - If a completed session exists → save it (exactly `bufferLength` seconds)
 *   - Otherwise → stop the in-progress session and save what we have
 *
 * This guarantees every clip:
 *   1. Has valid WebM headers (complete session from start to stop)
 *   2. Is capped at `bufferLength` seconds (one rotation = one clip)
 */
export function useScreenRecorder(options: UseScreenRecorderOptions) {
  const {
    bufferLength,
    systemAudioEnabled,
    micEnabled,
    selectedMicDeviceId,
    recordingResolution,
    customAspectRatio,
    aspectRatioPreset,
    regionBoxEnabled,
    regionBounds,
    onSaved,
    onError
  } = options

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [bufferSeconds, setBufferSeconds] = useState(0)
  const [sourceId, setSourceId] = useState<string | null>(null)

  // Internal refs to avoid stale closures in callbacks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([]) // current in-progress session chunks
  const completedChunksRef = useRef<Blob[]>([]) // last completed rotation's chunks
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const bufferElapsedRef = useRef(0) // seconds since last rotation
  const mimeTypeRef = useRef<string>('video/webm')
  const statusRef = useRef<RecorderStatus>('idle')
  const bufferLengthRef = useRef(bufferLength)
  const sourceIdRef = useRef<string | null>(null) // persists across rotations
  const recordingStartRef = useRef<number>(0) // timestamp when current recorder started
  const systemAudioEnabledRef = useRef(systemAudioEnabled)
  const micEnabledRef = useRef(micEnabled)
  const selectedMicDeviceIdRef = useRef(selectedMicDeviceId)
  const recordingResolutionRef = useRef(recordingResolution)
  const customAspectRatioRef = useRef(customAspectRatio)
  const aspectRatioPresetRef = useRef(aspectRatioPreset)
  const regionBoxEnabledRef = useRef(regionBoxEnabled)
  const regionBoundsRef = useRef(regionBounds)

  // Canvas cropping pipeline refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number>(0)
  // Keep a ref to the raw desktop stream (needed when canvas pipeline replaces streamRef)
  const rawDesktopStreamRef = useRef<MediaStream | null>(null)

  // Keep refs in sync with prop changes
  useEffect(() => {
    bufferLengthRef.current = bufferLength
  }, [bufferLength])
  useEffect(() => {
    systemAudioEnabledRef.current = systemAudioEnabled
  }, [systemAudioEnabled])
  useEffect(() => {
    micEnabledRef.current = micEnabled
  }, [micEnabled])
  useEffect(() => {
    selectedMicDeviceIdRef.current = selectedMicDeviceId
  }, [selectedMicDeviceId])
  useEffect(() => {
    recordingResolutionRef.current = recordingResolution
  }, [recordingResolution])
  useEffect(() => {
    customAspectRatioRef.current = customAspectRatio
  }, [customAspectRatio])
  useEffect(() => {
    aspectRatioPresetRef.current = aspectRatioPreset
  }, [aspectRatioPreset])
  useEffect(() => {
    regionBoxEnabledRef.current = regionBoxEnabled
  }, [regionBoxEnabled])
  useEffect(() => {
    regionBoundsRef.current = regionBounds
  }, [regionBounds])

  /**
   * Acquire a desktop capture stream using Electron's chromeMediaSource API.
   * Resolution is determined by the recording settings:
   * - Region box ON: always captures at max (2560×1440) for quality cropping
   * - Region box OFF: captures at the selected resolution preset
   * When system audio is enabled, captures the desktop audio loopback alongside video.
   */
  const acquireStream = useCallback(async (srcId: string): Promise<MediaStream> => {
    const res = regionBoxEnabledRef.current
      ? { maxWidth: 2560, maxHeight: 1440 }
      : RESOLUTION_MAP[recordingResolutionRef.current] || RESOLUTION_MAP['1080p']

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: systemAudioEnabledRef.current
        ? {
            // @ts-ignore — Electron-specific mandatory constraints for system audio loopback
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: srcId
            }
          }
        : false,
      video: {
        // @ts-ignore — Electron-specific mandatory constraints for desktopCapturer
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: srcId,
          maxWidth: res.maxWidth,
          maxHeight: res.maxHeight,
          maxFrameRate: 60
        }
      }
    })
    return stream
  }, [])

  /**
   * Acquire a microphone audio stream for the selected device.
   * Returns null if mic is disabled or acquisition fails.
   */
  const acquireMicStream = useCallback(async (): Promise<MediaStream | null> => {
    if (!micEnabledRef.current) return null
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedMicDeviceIdRef.current
          ? { deviceId: { exact: selectedMicDeviceIdRef.current } }
          : true,
        video: false
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      return stream
    } catch (err) {
      console.warn('Failed to acquire mic stream:', err)
      return null
    }
  }, [])

  /**
   * Merge desktop stream (video + optional system audio) with an optional mic stream
   * using the Web Audio API. Returns a single MediaStream ready for MediaRecorder.
   */
  const buildRecordingStream = useCallback(
    async (desktopStream: MediaStream): Promise<MediaStream> => {
      const micStream = await acquireMicStream()
      micStreamRef.current = micStream

      const hasDesktopAudio = desktopStream.getAudioTracks().length > 0
      const hasMic = micStream !== null && micStream.getAudioTracks().length > 0

      // If no audio at all, return the desktop stream as-is (video only)
      if (!hasDesktopAudio && !hasMic) return desktopStream

      // If only one audio source, combine directly without AudioContext overhead
      if (hasDesktopAudio && !hasMic) return desktopStream
      if (!hasDesktopAudio && hasMic) {
        return new MediaStream([...desktopStream.getVideoTracks(), ...micStream!.getAudioTracks()])
      }

      // Both sources present — mix via Web Audio API
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const dest = ctx.createMediaStreamDestination()

      ctx.createMediaStreamSource(desktopStream).connect(dest)
      ctx.createMediaStreamSource(micStream!).connect(dest)

      return new MediaStream([...desktopStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
    },
    [acquireMicStream]
  )

  /** Stop all active tracks on the current media stream and clean up audio/canvas resources */
  const releaseStream = useCallback(() => {
    // Clean up canvas cropping pipeline
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    if (offscreenVideoRef.current) {
      offscreenVideoRef.current.srcObject = null
      offscreenVideoRef.current = null
    }
    canvasRef.current = null
    if (rawDesktopStreamRef.current) {
      rawDesktopStreamRef.current.getTracks().forEach((track) => track.stop())
      rawDesktopStreamRef.current = null
    }
    // Clean up mic and audio context
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  /** Clear the elapsed timer interval */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Clear the rotation timer */
  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current)
      rotationTimerRef.current = null
    }
  }, [])

  /**
   * Concatenate chunks into a Uint8Array and save to disk via IPC.
   * Uses Uint8Array because ArrayBuffer loses data during Electron IPC.
   * The main process post-processes MP4 files with FFmpeg faststart to
   * relocate the moov atom for instant seekability.
   */
  const saveChunks = useCallback(
    async (chunks: Blob[], prefix: string, _durationMs: number): Promise<void> => {
      if (chunks.length === 0) {
        onError?.('No data to save')
        return
      }
      try {
        const blob = new Blob(chunks, { type: mimeTypeRef.current })
        const arrayBuffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)
        const ext = getExtensionForMime(mimeTypeRef.current)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `${prefix}-${timestamp}.${ext}`
        const filePath = await window.api.saveRecording(uint8, filename)
        onSaved?.(filePath)
      } catch (err) {
        onError?.(`Failed to save: ${err}`)
      }
    },
    [onSaved, onError]
  )

  /**
   * Build a canvas-based cropped recording stream.
   * Captures the selected region from the full-screen desktop stream and scales
   * it to the target output resolution using an offscreen canvas pipeline.
   * Audio tracks (desktop + mic) are merged onto the canvas stream.
   */
  const buildCroppedStream = useCallback(
    async (
      desktopStream: MediaStream,
      region: RegionBounds,
      outputW: number,
      outputH: number
    ): Promise<MediaStream> => {
      // Keep a ref to the raw desktop stream for cleanup
      rawDesktopStreamRef.current = desktopStream

      // Create offscreen video element to play the desktop stream
      const video = document.createElement('video')
      video.srcObject = desktopStream
      video.muted = true
      await video.play()

      // Wait for video dimensions to be available
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) {
          resolve()
        } else {
          video.onloadedmetadata = (): void => resolve()
        }
      })
      offscreenVideoRef.current = video

      // Create canvas at the target output resolution
      const canvas = document.createElement('canvas')
      canvas.width = outputW
      canvas.height = outputH
      canvasRef.current = canvas
      const ctx = canvas.getContext('2d')!

      // Compute scale from captured video dimensions to full screen dimensions.
      // We use screen.width/height (full display size) rather than window.innerWidth/Height
      // because the Electron window is sized to workAreaSize (excludes taskbar) but
      // desktopCapturer captures the entire screen including taskbar area.
      const scaleX = video.videoWidth / screen.width
      const scaleY = video.videoHeight / screen.height

      // Frame draw loop — reads from regionBoundsRef for live position updates
      const drawFrame = (): void => {
        const b = regionBoundsRef.current || region
        const sx = b.x * scaleX
        const sy = b.y * scaleY
        const sw = b.w * scaleX
        const sh = b.h * scaleY
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outputW, outputH)
        animFrameRef.current = requestAnimationFrame(drawFrame)
      }
      drawFrame()

      // Get the cropped video stream from the canvas
      const canvasStream = canvas.captureStream(60)

      // Merge audio (desktop + mic) onto the cropped video stream
      const micStream = await acquireMicStream()
      micStreamRef.current = micStream

      const audioTracks: MediaStreamTrack[] = []
      const hasDesktopAudio = desktopStream.getAudioTracks().length > 0
      const hasMic = micStream !== null && micStream.getAudioTracks().length > 0

      if (hasDesktopAudio && hasMic) {
        // Mix both via Web Audio API
        const audioCtx = new AudioContext()
        audioContextRef.current = audioCtx
        const dest = audioCtx.createMediaStreamDestination()
        audioCtx.createMediaStreamSource(desktopStream).connect(dest)
        audioCtx.createMediaStreamSource(micStream!).connect(dest)
        audioTracks.push(...dest.stream.getAudioTracks())
      } else if (hasDesktopAudio) {
        audioTracks.push(...desktopStream.getAudioTracks())
      } else if (hasMic) {
        audioTracks.push(...micStream!.getAudioTracks())
      }

      return new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    },
    [acquireMicStream]
  )

  /**
   * Decide whether to build a cropped (canvas-based) or full-screen recording stream.
   * Centralises the regionBoxEnabled + regionBounds decision so every call-site
   * (startManualRecording, startBuffering, restartBuffering, saveClip) behaves
   * identically.
   */
  const buildStream = useCallback(
    async (desktopStream: MediaStream): Promise<MediaStream> => {
      if (regionBoxEnabledRef.current && regionBoundsRef.current) {
        let outW: number
        let outH: number
        if (customAspectRatioRef.current) {
          const dims = getOutputDimensions(
            recordingResolutionRef.current,
            aspectRatioPresetRef.current
          )
          outW = dims.w
          outH = dims.h
        } else {
          outW = Math.round(regionBoundsRef.current.w / 2) * 2
          outH = Math.round(regionBoundsRef.current.h / 2) * 2
        }
        return buildCroppedStream(desktopStream, regionBoundsRef.current, outW, outH)
      }
      return buildRecordingStream(desktopStream)
    },
    [buildCroppedStream, buildRecordingStream]
  )

  /**
   * Internal: start a fresh MediaRecorder on an existing stream.
   * Does NOT acquire a new stream — used for both initial start and rotations.
   */
  const createAndStartRecorder = useCallback((stream: MediaStream): void => {
    const mimeType = getSupportedMimeType()
    mimeTypeRef.current = mimeType
    const bitrate = BITRATE_MAP[recordingResolutionRef.current] || 8_000_000
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate
    })

    chunksRef.current = []

    recorder.ondataavailable = (e: BlobEvent): void => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    mediaRecorderRef.current = recorder
    recordingStartRef.current = Date.now()
    recorder.start(1000) // 1-second timeslice
  }, [])

  /**
   * Rotate the buffer: stop the current MediaRecorder, store its chunks
   * as the "completed" clip-ready data, then start a fresh recorder.
   * The stream stays alive — only the MediaRecorder is cycled.
   */
  const rotateBuffer = useCallback(async (): Promise<void> => {
    const recorder = mediaRecorderRef.current
    const stream = streamRef.current
    if (!recorder || !stream || statusRef.current !== 'buffering') return

    // Stop the current recorder and wait for it to finalize
    await new Promise<void>((resolve) => {
      recorder.onstop = (): void => resolve()
      recorder.stop()
    })

    // Move current chunks to completed (these are the clip-ready data)
    completedChunksRef.current = [...chunksRef.current]
    chunksRef.current = []
    bufferElapsedRef.current = 0

    // Start a fresh recorder on the same stream
    createAndStartRecorder(stream)
  }, [createAndStartRecorder])

  /**
   * Start a manual recording session.
   * Auto-stops at MAX_RECORDING_SECONDS (30 min).
   * When custom aspect ratio is enabled, uses canvas-based region cropping.
   */
  const startManualRecording = useCallback(
    async (srcId: string): Promise<void> => {
      if (statusRef.current !== 'idle') return

      try {
        const desktopStream = await acquireStream(srcId)
        const stream = await buildStream(desktopStream)

        streamRef.current = stream
        setSourceId(srcId)
        sourceIdRef.current = srcId

        const mimeType = getSupportedMimeType()
        mimeTypeRef.current = mimeType
        const bitrate = BITRATE_MAP[recordingResolutionRef.current] || 8_000_000
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: bitrate
        })

        chunksRef.current = []

        recorder.ondataavailable = (e: BlobEvent): void => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data)
          }
        }

        recorder.onstop = (): void => {
          const chunks = [...chunksRef.current]
          chunksRef.current = []
          const durationMs = elapsedRef.current * 1000
          saveChunks(chunks, 'recording', durationMs)
          releaseStream()
          clearTimer()
          setStatus('idle')
          statusRef.current = 'idle'
          setElapsed(0)
          elapsedRef.current = 0
        }

        mediaRecorderRef.current = recorder
        recorder.start(1000)

        setStatus('recording')
        statusRef.current = 'recording'
        elapsedRef.current = 0
        setElapsed(0)

        // Elapsed timer — auto-stop at MAX_RECORDING_SECONDS (30 min)
        timerRef.current = setInterval(() => {
          elapsedRef.current += 1
          setElapsed(elapsedRef.current)
          if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
            mediaRecorderRef.current?.stop()
          }
        }, 1000)
      } catch (err) {
        onError?.(`Failed to start recording: ${err}`)
        releaseStream()
      }
    },
    [
      acquireStream,
      buildStream,
      releaseStream,
      clearTimer,
      saveChunks,
      onError
    ]
  )

  /** Stop a manual recording in progress */
  const stopManualRecording = useCallback((): void => {
    if (statusRef.current !== 'recording' || !mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
  }, [])

  /**
   * Start the background instant-replay buffer.
   * Acquires a stream, starts recording, and sets up auto-rotation every
   * `bufferLength` seconds to keep clips at the configured length.
   * Supports custom aspect ratio with canvas-based cropping.
   */
  const startBuffering = useCallback(
    async (srcId: string): Promise<void> => {
      if (statusRef.current !== 'idle') return

      try {
        const desktopStream = await acquireStream(srcId)
        const stream = await buildStream(desktopStream)

        streamRef.current = stream
        setSourceId(srcId)
        sourceIdRef.current = srcId
        completedChunksRef.current = []
        bufferElapsedRef.current = 0

        createAndStartRecorder(stream)

        setStatus('buffering')
        statusRef.current = 'buffering'
        setBufferSeconds(0)

        // Auto-rotation timer: rotate every bufferLength seconds
        // Also updates the buffer seconds display
        rotationTimerRef.current = setInterval(() => {
          bufferElapsedRef.current += 1
          setBufferSeconds(Math.min(bufferElapsedRef.current, bufferLengthRef.current))

          if (bufferElapsedRef.current >= bufferLengthRef.current) {
            rotateBuffer()
          }
        }, 1000)
      } catch (err) {
        onError?.(`Failed to start buffering: ${err}`)
        releaseStream()
      }
    },
    [
      acquireStream,
      buildStream,
      releaseStream,
      createAndStartRecorder,
      rotateBuffer,
      onError
    ]
  )

  /** Stop the background buffer and discard all chunks */
  const stopBuffering = useCallback((): void => {
    if (statusRef.current !== 'buffering' || !mediaRecorderRef.current) return

    clearRotationTimer()
    mediaRecorderRef.current.onstop = (): void => {
      chunksRef.current = []
      completedChunksRef.current = []
      releaseStream()
      setStatus('idle')
      statusRef.current = 'idle'
      setBufferSeconds(0)
    }
    mediaRecorderRef.current.stop()
  }, [releaseStream, clearRotationTimer])

  /**
   * Restart the buffer session — properly awaits the MediaRecorder stop
   * before re-acquiring the stream. Used when region box is toggled so
   * the canvas-cropping pipeline is rebuilt.
   */
  const restartBuffering = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'buffering' || !mediaRecorderRef.current) return

    const savedSourceId = sourceIdRef.current
    if (!savedSourceId) return

    clearRotationTimer()

    // Properly await the recorder onstop event
    const recorder = mediaRecorderRef.current
    await new Promise<void>((resolve) => {
      recorder.onstop = (): void => {
        chunksRef.current = []
        completedChunksRef.current = []
        releaseStream()
        resolve()
      }
      recorder.stop()
    })

    // Status is still 'buffering' from the caller's perspective — set to idle briefly
    statusRef.current = 'idle'
    setStatus('idle')
    setBufferSeconds(0)

    // Small delay to ensure stream resources are fully released
    await new Promise((r) => setTimeout(r, 200))

    // Re-start with the same source — this will re-evaluate regionBoxEnabledRef
    try {
      const desktopStream = await acquireStream(savedSourceId)
      const stream = await buildStream(desktopStream)

      streamRef.current = stream
      setSourceId(savedSourceId)
      sourceIdRef.current = savedSourceId
      completedChunksRef.current = []
      bufferElapsedRef.current = 0
      setBufferSeconds(0)

      createAndStartRecorder(stream)
      setStatus('buffering')
      statusRef.current = 'buffering'

      clearRotationTimer()
      rotationTimerRef.current = setInterval(() => {
        bufferElapsedRef.current += 1
        setBufferSeconds(Math.min(bufferElapsedRef.current, bufferLengthRef.current))
        if (bufferElapsedRef.current >= bufferLengthRef.current) {
          rotateBuffer()
        }
      }, 1000)
    } catch (err) {
      onError?.(`Failed to restart buffer: ${err}`)
      setStatus('idle')
      statusRef.current = 'idle'
    }
  }, [
    clearRotationTimer,
    releaseStream,
    acquireStream,
    buildStream,
    createAndStartRecorder,
    rotateBuffer,
    onError
  ])

  /**
   * Save the instant replay clip.
   *
   * If a completed rotation exists (bufferLength seconds of data),
   * save that. Otherwise, stop the current session and save what
   * we have so far. Either way, reset and restart a fresh buffer.
   */
  const saveClip = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'buffering' || !mediaRecorderRef.current) return

    const recorder = mediaRecorderRef.current
    const savedSourceId = sourceIdRef.current
    const stream = streamRef.current

    // Stop rotation timer while we save
    clearRotationTimer()

    // Determine which chunks to save:
    // Prefer the completed (rotated) session — it's exactly bufferLength seconds.
    // If no completed session yet, stop the in-progress one and save what we have.
    let clipChunks: Blob[]
    let usedCompletedChunks = false

    if (completedChunksRef.current.length > 0) {
      // Use the last completed rotation (exactly bufferLength seconds)
      clipChunks = [...completedChunksRef.current]
      completedChunksRef.current = []
      usedCompletedChunks = true
    } else {
      // No completed rotation yet — stop current recorder and use its chunks
      await new Promise<void>((resolve) => {
        recorder.onstop = (): void => resolve()
        recorder.stop()
      })
      clipChunks = [...chunksRef.current]
      chunksRef.current = []
    }

    if (clipChunks.length === 0) {
      onError?.('Buffer is empty, nothing to clip')
      // Restart
      if (stream && savedSourceId) {
        completedChunksRef.current = []
        bufferElapsedRef.current = 0
        createAndStartRecorder(stream)
        rotationTimerRef.current = setInterval(() => {
          bufferElapsedRef.current += 1
          setBufferSeconds(Math.min(bufferElapsedRef.current, bufferLengthRef.current))
          if (bufferElapsedRef.current >= bufferLengthRef.current) {
            rotateBuffer()
          }
        }, 1000)
      }
      return
    }

    // Save the clip — completed rotations are exactly bufferLength seconds;
    // partial clips use the elapsed time since the last rotation started.
    const clipDurationMs = usedCompletedChunks
      ? bufferLengthRef.current * 1000
      : bufferElapsedRef.current * 1000
    await saveChunks(clipChunks, 'clip', clipDurationMs)

    // Restart buffering — if we used the completed chunks, the current
    // recorder is still running (just reset the rotation). If we stopped
    // the recorder, start a fresh one.
    if (savedSourceId && stream) {
      try {
        // Check if recorder is still active (we used completed chunks)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          // Current session still running — just reset rotation timer
          completedChunksRef.current = []
          bufferElapsedRef.current = chunksRef.current.length
          setBufferSeconds(Math.min(bufferElapsedRef.current, bufferLengthRef.current))
        } else {
          // Need to start a fresh recorder — use buildStream so the cropped
          // pipeline is rebuilt when region box is enabled
          completedChunksRef.current = []
          bufferElapsedRef.current = 0
          releaseStream()
          const desktopStream = await acquireStream(savedSourceId)
          const newStream = await buildStream(desktopStream)
          streamRef.current = newStream
          createAndStartRecorder(newStream)
          setBufferSeconds(0)
        }

        // Restart the rotation timer
        rotationTimerRef.current = setInterval(() => {
          bufferElapsedRef.current += 1
          setBufferSeconds(Math.min(bufferElapsedRef.current, bufferLengthRef.current))
          if (bufferElapsedRef.current >= bufferLengthRef.current) {
            rotateBuffer()
          }
        }, 1000)
      } catch (err) {
        onError?.(`Failed to restart buffer: ${err}`)
        releaseStream()
        setStatus('idle')
        statusRef.current = 'idle'
        setBufferSeconds(0)
      }
    } else {
      releaseStream()
      setStatus('idle')
      statusRef.current = 'idle'
      setBufferSeconds(0)
    }
  }, [
    acquireStream,
    buildStream,
    releaseStream,
    clearRotationTimer,
    createAndStartRecorder,
    rotateBuffer,
    saveChunks,
    onError
  ])

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      clearTimer()
      clearRotationTimer()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.stop()
      }
      releaseStream()
    }
  }, [clearTimer, clearRotationTimer, releaseStream])

  return {
    status,
    elapsed,
    bufferSeconds,
    sourceId,
    startManualRecording,
    stopManualRecording,
    startBuffering,
    stopBuffering,
    restartBuffering,
    saveClip
  }
}
