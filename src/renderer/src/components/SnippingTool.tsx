import React, { useState, useRef, useEffect } from 'react'
import { Send, X, Save } from 'lucide-react'

interface SnippingToolProps {
  screenshot: string
  onCancel: () => void
  onSend: (croppedImage: string) => void
}

const SnippingTool: React.FC<SnippingToolProps> = ({ screenshot, onCancel, onSend }) => {
  // State to track selection coordinates
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Initial setup: Draw the full screenshot onto the canvas
  useEffect(() => {
    // When snipping tool opens, it must capture all mouse events (disable click-through)
    if (window.api && typeof window.api.setIgnoreMouseEvents === 'function') {
      window.api.setIgnoreMouseEvents(false)
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // Add a dark semi-transparent overlay to indicate "dimmed" state
      // The selected area will be cleared of this overlay later
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    img.src = screenshot

    return () => {
      // When unmounting (closing), we rely on App.tsx and its mouse event handlers
      // to correctly manage the window's passthrough state.
    }
  }, [screenshot])

  // Redraws the canvas: Base image + Dim Overlay - Selected Area (ClearRect)
  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Reset canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      // Re-apply dark overlay everywhere
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (isSelecting || selection) {
        // Calculate selection bounds
        const x = Math.min(startPos.x, currentPos.x)
        const y = Math.min(startPos.y, currentPos.y)
        const width = Math.abs(startPos.x - currentPos.x)
        const height = Math.abs(startPos.y - currentPos.y)

        // 'Cut out' the selection from the dark overlay to highlight it
        // We do this by clearing the rect and re-drawing the original bright image parts there
        ctx.clearRect(x, y, width, height)
        ctx.drawImage(img, x, y, width, height, x, y, width, height)

        // Draw blue border around selection
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)
      }
    }
    img.src = screenshot
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsSelecting(true)
    setStartPos({ x, y })
    setCurrentPos({ x, y })
    setSelection(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setCurrentPos({ x, y })
    redraw()
  }

  const handleMouseUp = () => {
    if (!isSelecting) return
    setIsSelecting(false)

    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(startPos.x - currentPos.x)
    const height = Math.abs(startPos.y - currentPos.y)

    if (width > 5 && height > 5) {
      setSelection({ x, y, width, height })
    } else {
      setSelection(null)
      redraw()
    }
  }

  /**
   * Crops the selected area from the original image and saves it to a file via IPC.
   */
  const handleSave = () => {
    if (!selection) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas to hold just the cropped region
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = selection.width
    tempCanvas.height = selection.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    const img = new Image()
    img.onload = () => {
      // Draw only the selected portion
      tempCtx.drawImage(
        img,
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        0,
        0,
        selection.width,
        selection.height
      )
      // Send base64 data to main process to save to disk
      window.api.saveSnip(tempCanvas.toDataURL())
      onCancel() // Close overlay after save
    }
    img.src = screenshot
  }

  const handleSend = () => {
    if (!selection) return
    const canvas = canvasRef.current
    if (!canvas) return

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = selection.width
    tempCanvas.height = selection.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    const img = new Image()
    img.onload = () => {
      tempCtx.drawImage(
        img,
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        0,
        0,
        selection.width,
        selection.height
      )
      onSend(tempCanvas.toDataURL())
    }
    img.src = screenshot
  }

  return (
    <div className="snipping-tool">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <div className="snipping-toolbar" onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}>
        <button className="toolbar-btn cancel" onClick={onCancel} title="Cancel">
          <X size={20} />
        </button>
        {selection ? (
          <>
            <button className="toolbar-btn save" onClick={handleSave} title="Save Snip to Gallery">
              <Save size={20} />
              <span>Save Snip</span>
            </button>
            <button className="toolbar-btn send" onClick={handleSend} title="Send Snippet to AI">
              <Send size={20} />
              <span>Send Snip to AI</span>
            </button>
          </>
        ) : (
          <button
            className="toolbar-btn send"
            onClick={() => onSend(screenshot)}
            title="Send Full Screenshot to AI"
          >
            <Send size={20} />
            <span>Send Full to AI</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default SnippingTool
