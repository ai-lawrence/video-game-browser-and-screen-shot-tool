import React, { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Settings from './components/Settings'
import SnippingTool from './components/SnippingTool'

function App(): React.JSX.Element {
  const [activeAI, setActiveAI] = useState<'chatgpt' | 'gemini' | 'perplexity'>('chatgpt')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 })
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const screenshotRef = useRef<string | null>(null)

  // References for AI Webviews to programmatically focus/paste
  const chatgptRef = useRef<HTMLWebViewElement>(null)
  const geminiRef = useRef<HTMLWebViewElement>(null)
  const perplexityRef = useRef<HTMLWebViewElement>(null)

  // New refs for optimized event handling (useRef avoids re-renders during high-frequency events like drag/resize)
  const isResizingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 20, y: 20 }) // Initialize with initial position
  const requestRef = useRef<number | null>(null) // RAF ID for cancelling animations

  useEffect(() => {
    // Listen for global screenshot events triggered by main process/hotkeys
    window.api.onTriggerScreenshot((data) => {
      if (screenshotRef.current) return // deny if already processing a screenshot
      setScreenshot(data)
      screenshotRef.current = data
    })
    window.api.onTriggerSnip((data) => {
      if (screenshotRef.current) return // deny if already processing
      setScreenshot(data)
      screenshotRef.current = data
    })
  }, [])

  // Keep positionRef in sync with position state
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const handleResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    isResizingRef.current = true
  }

  const handleDragStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    setIsDragging(true)
    isDraggingRef.current = true
    const offset = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
    dragOffsetRef.current = offset
  }

  // Global Mouse Event Listeners for Dragging and Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isResizingRef.current && !isDraggingRef.current) return

      // Throttling with requestAnimationFrame for smooth 60fps performance
      if (requestRef.current) return

      requestRef.current = requestAnimationFrame(() => {
        requestRef.current = null // Clear the request ID once the frame starts
        if (isResizingRef.current) {
          // Resize: Update dimensions based on mouse delta
          // Enforce minimum width of 300px
          const newWidth = Math.max(300, e.clientX - positionRef.current.x - 60) // 60 is sidebar width
          const newHeight = newWidth * 1.5 // Enforce 2:3 Aspect Ratio
          setDimensions({ width: newWidth, height: newHeight })
        } else if (isDraggingRef.current) {
          // Drag: Update position based on offset
          setPosition({
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y
          })
        }
      })
    }

    // Logic to determine if mouse is hovering over the UI to enable/disable click-through (ignoreMouseEvents)
    const handleMouseMoveGlobal = (e: MouseEvent): void => {
      const appContainer = document.querySelector('.app-container')
      if (appContainer) {
        const rect = appContainer.getBoundingClientRect()
        // Check if mouse is strictly inside the visible application bounds
        const isInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom

        if (!isInside) {
          // If outside, allow clicks to pass through to the game/desktop
          // Check ref instead of state to avoid stale closure issues in event listener
          if (!screenshotRef.current) {
            window.api.setIgnoreMouseEvents(true, { forward: true })
          }
        }
      }
    }

    const handleMouseUp = (e: MouseEvent): void => {
      setIsResizing(false)
      setIsDragging(false)
      isResizingRef.current = false
      isDraggingRef.current = false
      // Cancel any pending animation frame when mouse is released
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
        requestRef.current = null
      }

      // Re-evaluate mouse position relative to UI to ensure correct pass-through state
      handleMouseMoveGlobal(e)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      // Clean up any pending animation frame on unmount
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, []) // Empty dependency array ensures listeners are only registered once

  /**
   * Handles the workflow when a user approves a snip/screenshot to be sent to AI.
   * 1. Copies image to clipboard.
   * 2. Focuses the active AI webview.
   * 3. Injects JS to focus the specific input field of that AI service.
   * 4. Pastes the image.
   */
  const handleSendToAI = async (imageToPaste: string): Promise<void> => {
    try {
      // 1. Write to clipboard and wait for it to finish
      await window.api.writeToClipboard(imageToPaste)

      const activeRef =
        activeAI === 'chatgpt' ? chatgptRef : activeAI === 'gemini' ? geminiRef : perplexityRef
      if (!activeRef.current) {
        setScreenshot(null)
        screenshotRef.current = null
        return
      }

      // 2. Focus the webview
      activeRef.current.focus()

      // 3. Try to focus the specific chat input field via JS and then paste
      // Note: These selectors are subject to change if the AI providers update their DOM
      const focusScript =
        activeAI === 'chatgpt'
          ? `
        (function() {
          const el = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]');
          if (el) { el.focus(); return true; }
          return false;
        })()
      `
          : activeAI === 'gemini'
            ? `
        (function() {
          const el = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
          if (el) { el.focus(); return true; }
          return false;
        })()
      `
            : `
        (function() {
          const el = document.querySelector('textarea');
          if (el) { el.focus(); return true; }
          return false;
        })()
      `

      await (activeRef.current as any).executeJavaScript(focusScript)

      // 4. Small delay to ensure focus settled before pasting
      setTimeout(() => {
        if (activeRef.current) {
          ;(activeRef.current as any).paste()
          // 5. Close the snipping tool after paste is triggered
          setScreenshot(null)
          screenshotRef.current = null
        }
      }, 150)
    } catch (error) {
      console.error('Failed to send to AI:', error)
      setScreenshot(null)
      screenshotRef.current = null
    }
  }

  const handleCancelScreenshot = (): void => {
    setScreenshot(null)
    screenshotRef.current = null
    // Immediately check if we should reset passthrough
    window.api.setIgnoreMouseEvents(true, { forward: true })
  }

  return (
    <>
      <div
        className={`app-container ${isResizing || isDragging ? 'interacting' : ''}`}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: dimensions.width + 60, // + sidebar width
          height: dimensions.height
        }}
        onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}
        onMouseLeave={() => {
          // Check ref instead of state to avoid stale closure
          if (!isResizingRef.current && !isDraggingRef.current && !screenshotRef.current) {
            window.api.setIgnoreMouseEvents(true, { forward: true })
          }
        }}
      >
        <Sidebar
          activeAI={activeAI}
          setActiveAI={setActiveAI}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />

        <main
          className="main-content resizable"
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Mouse Guard: Prevents webview from stealing events during drag/resize */}
          {(isResizing || isDragging) && <div className="mouse-guard"></div>}
          {/* Move Handle (Anchor Point) */}
          <div className="move-handle" onMouseDown={handleDragStart} title="Drag to move">
            <div className="move-dots"></div>
            <button
              className="exit-button"
              onClick={() => window.api.quitApp()}
              title="Close Application"
            >
              ×
            </button>
          </div>

          <div
            style={{ display: activeAI === 'chatgpt' ? 'block' : 'none', height: '100%', flex: 1 }}
          >
            <webview
              ref={chatgptRef}
              src="https://chatgpt.com"
              partition="persist:chatgpt"
              style={{ width: '100%', height: '100%' }}
            ></webview>
          </div>
          <div
            style={{ display: activeAI === 'gemini' ? 'block' : 'none', height: '100%', flex: 1 }}
          >
            <webview
              ref={geminiRef}
              src="https://gemini.google.com"
              partition="persist:gemini"
              style={{ width: '100%', height: '100%' }}
            ></webview>
          </div>
          <div
            style={{
              display: activeAI === 'perplexity' ? 'block' : 'none',
              height: '100%',
              flex: 1
            }}
          >
            <webview
              ref={perplexityRef}
              src="https://www.perplexity.ai"
              partition="persist:perplexity"
              style={{ width: '100%', height: '100%' }}
            ></webview>
          </div>

          {/* Resize Handle */}
          <div className="resize-handle" onMouseDown={handleResizeStart}></div>

          {isSettingsOpen && (
            <div onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}>
              <Settings onClose={() => setIsSettingsOpen(false)} />
            </div>
          )}
        </main>
      </div>

      {screenshot && (
        <SnippingTool
          screenshot={screenshot}
          onCancel={handleCancelScreenshot}
          onSend={handleSendToAI}
        />
      )}
    </>
  )
}

export default App
