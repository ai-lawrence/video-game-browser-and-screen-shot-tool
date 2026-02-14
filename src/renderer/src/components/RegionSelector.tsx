import React, { useState, useEffect, useRef, useCallback } from 'react'

/** Available aspect ratio presets shown on the region box toolbar */
const RATIO_PRESETS = ['Free', '16:9', '9:16', '4:3', '1:1'] as const

interface RegionSelectorProps {
  /** Aspect ratio string, e.g. '9:16', '16:9', '1:1' — only used when lockAspectRatio is true */
  aspectRatio: string
  /** Whether the selector is visible */
  visible: boolean
  /** Whether to lock resize to the aspect ratio */
  lockAspectRatio: boolean
  /** Initial / saved position and size (CSS pixels). When provided, the box opens here. */
  initialBounds?: { x: number; y: number; w: number; h: number } | null
  /** Callback reporting the current region bounds in CSS pixels */
  onChange: (bounds: { x: number; y: number; w: number; h: number }) => void
  /** Callback when the user changes aspect ratio from the on-box toolbar */
  onAspectRatioChange?: (ratio: string, locked: boolean) => void
}

/**
 * Parse a ratio string like '16:9' into a numeric ratio (width / height).
 * Returns null for 'Free'.
 */
function parseRatio(ratioStr: string): number | null {
  if (ratioStr === 'Free') return null
  const [aw, ah] = ratioStr.split(':').map(Number)
  if (!aw || !ah) return null
  return aw / ah
}

/**
 * On-screen draggable/resizable region selector for custom recording.
 *
 * - Displays a box that can be freely moved and resized.
 * - Border strip is a drag-to-move handle; corner circles resize.
 * - When lockAspectRatio is true, resizing maintains the selected aspect ratio.
 * - Area outside the box is dimmed with box-shadow; interior is pointer-events: none
 *   so clicks pass through to the underlying game/desktop.
 * - Accepts optional initialBounds to restore the last saved position.
 * - Includes a quick-select toolbar for fast aspect ratio switching.
 */
const RegionSelector: React.FC<RegionSelectorProps> = ({
  aspectRatio,
  visible,
  lockAspectRatio,
  initialBounds,
  onChange,
  onAspectRatioChange
}) => {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 400, h: 300 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  // Refs for high-frequency event handling (avoid stale closures)
  const posRef = useRef(pos)
  const sizeRef = useRef(size)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 })
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0
  })
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const resizeCornerRef = useRef('')
  const ratioRef = useRef(16 / 9)
  const lockAspectRatioRef = useRef(lockAspectRatio)
  const hasInitialized = useRef(false)

  // Keep lockAspectRatio ref in sync
  useEffect(() => {
    lockAspectRatioRef.current = lockAspectRatio
  }, [lockAspectRatio])

  // Parse aspect ratio
  useEffect(() => {
    const [aw, ah] = aspectRatio.split(':').map(Number)
    if (aw && ah) ratioRef.current = aw / ah
  }, [aspectRatio])

  /**
   * Snap the box to a given aspect ratio, keeping its center position.
   * Uses the current width as the reference and adjusts height.
   */
  const snapToRatio = useCallback((ratio: number): void => {
    const currentW = sizeRef.current.w
    const currentCenterX = posRef.current.x + sizeRef.current.w / 2
    const currentCenterY = posRef.current.y + sizeRef.current.h / 2

    let newW = currentW
    let newH = currentW / ratio

    // Ensure it fits on screen
    if (newH > window.innerHeight * 0.9) {
      newH = window.innerHeight * 0.9
      newW = newH * ratio
    }
    if (newW > window.innerWidth * 0.9) {
      newW = window.innerWidth * 0.9
      newH = newW / ratio
    }

    // Re-center
    let newX = currentCenterX - newW / 2
    let newY = currentCenterY - newH / 2

    // Clamp to screen
    if (newX < 0) newX = 0
    if (newY < 0) newY = 0
    if (newX + newW > window.innerWidth) newX = window.innerWidth - newW
    if (newY + newH > window.innerHeight) newY = window.innerHeight - newH

    posRef.current = { x: newX, y: newY }
    sizeRef.current = { w: newW, h: newH }
    setPos({ x: newX, y: newY })
    setSize({ w: newW, h: newH })
  }, [])

  /** Handle clicking a ratio preset button on the toolbar */
  const handlePresetClick = useCallback(
    (preset: string): void => {
      const ratio = parseRatio(preset)
      if (ratio) {
        // Snap to this ratio and lock
        ratioRef.current = ratio
        snapToRatio(ratio)
        onAspectRatioChange?.(preset, true)
      } else {
        // Free mode — unlock
        onAspectRatioChange?.('16:9', false)
      }
    },
    [snapToRatio, onAspectRatioChange]
  )

  // Initialize position: use saved bounds if available, otherwise center on screen
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    if (initialBounds && initialBounds.w > 0 && initialBounds.h > 0) {
      // Restore saved position
      setPos({ x: initialBounds.x, y: initialBounds.y })
      setSize({ w: initialBounds.w, h: initialBounds.h })
      posRef.current = { x: initialBounds.x, y: initialBounds.y }
      sizeRef.current = { w: initialBounds.w, h: initialBounds.h }
    } else {
      // Default: center a box on screen using the selected aspect ratio
      const screenW = window.innerWidth
      const screenH = window.innerHeight
      const ratio = ratioRef.current
      const maxH = screenH * 0.5
      const maxW = screenW * 0.8
      let boxH = maxH
      let boxW = maxH * ratio

      if (boxW > maxW) {
        boxW = maxW
        boxH = maxW / ratio
      }

      const newX = (screenW - boxW) / 2
      const newY = (screenH - boxH) / 2
      setPos({ x: newX, y: newY })
      setSize({ w: boxW, h: boxH })
      posRef.current = { x: newX, y: newY }
      sizeRef.current = { w: boxW, h: boxH }
    }
  }, [initialBounds])

  // Report bounds whenever position or size changes
  useEffect(() => {
    onChange({ x: pos.x, y: pos.y, w: size.w, h: size.h })
  }, [pos, size, onChange])

  // --- Drag (move) ---
  const handleDragStart = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    isDraggingRef.current = true
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y
    }
  }, [])

  // --- Resize ---
  const handleResizeStart = useCallback((e: React.MouseEvent, corner: string): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    isResizingRef.current = true
    resizeCornerRef.current = corner
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
      startW: sizeRef.current.w,
      startH: sizeRef.current.h
    }
  }, [])

  // Global mouse move/up
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.mouseX
        const dy = e.clientY - dragStartRef.current.mouseY
        const newX = Math.max(
          0,
          Math.min(window.innerWidth - sizeRef.current.w, dragStartRef.current.startX + dx)
        )
        const newY = Math.max(
          0,
          Math.min(window.innerHeight - sizeRef.current.h, dragStartRef.current.startY + dy)
        )
        posRef.current = { x: newX, y: newY }
        setPos({ x: newX, y: newY })
      } else if (isResizingRef.current) {
        const dx = e.clientX - resizeStartRef.current.mouseX
        const dy = e.clientY - resizeStartRef.current.mouseY
        const corner = resizeCornerRef.current
        const { startX, startY, startW, startH } = resizeStartRef.current
        const minSize = 100
        const locked = lockAspectRatioRef.current
        const ratio = ratioRef.current

        let newW = startW
        let newH = startH
        let newX = startX
        let newY = startY

        if (locked) {
          // Aspect-ratio-locked resize (width drives height)
          if (corner === 'bottom-right') {
            newW = Math.max(minSize, startW + dx)
            newH = newW / ratio
          } else if (corner === 'bottom-left') {
            newW = Math.max(minSize, startW - dx)
            newH = newW / ratio
            newX = startX + (startW - newW)
          } else if (corner === 'top-right') {
            newW = Math.max(minSize, startW + dx)
            newH = newW / ratio
            newY = startY + (startH - newH)
          } else if (corner === 'top-left') {
            newW = Math.max(minSize, startW - dx)
            newH = newW / ratio
            newX = startX + (startW - newW)
            newY = startY + (startH - newH)
          }
        } else {
          // Free-form resize (width and height independent)
          if (corner === 'bottom-right') {
            newW = Math.max(minSize, startW + dx)
            newH = Math.max(minSize, startH + dy)
          } else if (corner === 'bottom-left') {
            newW = Math.max(minSize, startW - dx)
            newH = Math.max(minSize, startH + dy)
            newX = startX + (startW - newW)
          } else if (corner === 'top-right') {
            newW = Math.max(minSize, startW + dx)
            newH = Math.max(minSize, startH - dy)
            newY = startY + (startH - newH)
          } else if (corner === 'top-left') {
            newW = Math.max(minSize, startW - dx)
            newH = Math.max(minSize, startH - dy)
            newX = startX + (startW - newW)
            newY = startY + (startH - newH)
          }
        }

        // Clamp to screen
        if (newX < 0) {
          newX = 0
        }
        if (newY < 0) {
          newY = 0
        }
        if (newX + newW > window.innerWidth) {
          newW = window.innerWidth - newX
          if (locked) newH = newW / ratio
        }
        if (newY + newH > window.innerHeight) {
          newH = window.innerHeight - newY
          if (locked) newW = newH * ratio
        }

        posRef.current = { x: newX, y: newY }
        sizeRef.current = { w: newW, h: newH }
        setPos({ x: newX, y: newY })
        setSize({ w: newW, h: newH })
      }
    }

    const handleMouseUp = (): void => {
      if (isDraggingRef.current) {
        setIsDragging(false)
        isDraggingRef.current = false
      }
      if (isResizingRef.current) {
        setIsResizing(false)
        isResizingRef.current = false
        resizeCornerRef.current = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Mouse passthrough: enable events on hover over interactive border/handles
  const handleMouseEnter = useCallback((): void => {
    window.api.setIgnoreMouseEvents(false)
  }, [])

  const handleMouseLeave = useCallback((): void => {
    if (!isDraggingRef.current && !isResizingRef.current) {
      window.api.setIgnoreMouseEvents(true, { forward: true })
    }
  }, [])

  if (!visible) return null

  // Determine which preset is active for highlighting
  const activePreset = lockAspectRatio ? aspectRatio : 'Free'

  // Build a display label: show aspect ratio when locked, otherwise show WxH
  const label = lockAspectRatio ? aspectRatio : `${Math.round(size.w)}×${Math.round(size.h)}`

  return (
    <div className="region-selector-overlay">
      <div
        className={`region-box ${isDragging || isResizing ? 'active' : ''}`}
        style={{
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h
        }}
      >
        {/* Border drag zone — expanded hitbox for moving */}
        <div
          className="region-border"
          onMouseDown={handleDragStart}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />

        {/* Corner resize handles */}
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
          <div
            key={corner}
            className={`region-handle ${corner}`}
            onMouseDown={(e): void => handleResizeStart(e, corner)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ))}

        {/* Label */}
        <div className="region-label">{label}</div>

        {/* Aspect ratio quick-select toolbar */}
        <div
          className="region-toolbar"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {RATIO_PRESETS.map((preset) => (
            <button
              key={preset}
              className={`region-preset-btn ${activePreset === preset ? 'active' : ''}`}
              onMouseDown={(e): void => {
                e.preventDefault()
                e.stopPropagation()
                handlePresetClick(preset)
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RegionSelector
