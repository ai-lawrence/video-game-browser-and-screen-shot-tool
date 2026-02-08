import React, { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Settings from './components/Settings'
import SnippingTool from './components/SnippingTool'
import SavedPromptsPanel from './components/SavedPrompts/SavedPromptsPanel'
import Toast from './components/Toast'
import { getProviderForUrl } from './providers'
import { SavedPrompt } from './providers/types'

// ... existing code ...

function App(): React.JSX.Element {
  // ... existing state ...
  const [activeAI, setActiveAI] = useState<'chatgpt' | 'gemini' | 'perplexity'>('chatgpt')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 })
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Toast state
  const [toastMsg, setToastMsg] = useState('')
  const [showToast, setShowToast] = useState(false)

  const screenshotRef = useRef<string | null>(null)

  // References for AI Webviews to programmatically focus/paste
  const chatgptRef = useRef<HTMLWebViewElement>(null)
  const geminiRef = useRef<HTMLWebViewElement>(null)
  const perplexityRef = useRef<HTMLWebViewElement>(null)

  // ... existing refs and effects ...
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

      if (requestRef.current) return

      requestRef.current = requestAnimationFrame(() => {
        requestRef.current = null
        if (isResizingRef.current) {
          const newWidth = Math.max(300, e.clientX - positionRef.current.x - 60)
          const newHeight = newWidth * 1.5
          setDimensions({ width: newWidth, height: newHeight })
        } else if (isDraggingRef.current) {
          setPosition({
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y
          })
        }
      })
    }

    const handleMouseMoveGlobal = (e: MouseEvent): void => {
      const appContainer = document.querySelector('.app-container')
      if (appContainer) {
        const rect = appContainer.getBoundingClientRect()
        const isInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom

        if (!isInside) {
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
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
        requestRef.current = null
      }
      handleMouseMoveGlobal(e)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [])

  // ... handleSendToAI ...
  const handleSendToAI = async (imageToPaste: string): Promise<void> => {
    try {
      await window.api.writeToClipboard(imageToPaste)

      const activeRef =
        activeAI === 'chatgpt' ? chatgptRef : activeAI === 'gemini' ? geminiRef : perplexityRef
      if (!activeRef.current) {
        setScreenshot(null)
        screenshotRef.current = null
        return
      }

      activeRef.current.focus()

      const focusScript =
        activeAI === 'chatgpt'
          ? `(function(){ try { const el = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]'); if(el){el.focus();return true;} return false; } catch(e){return false;} })()`
          : activeAI === 'gemini'
            ? `(function(){ try { const el = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea'); if(el){el.focus();return true;} return false; } catch(e){return false;} })()`
            : `(function(){ try { const el = document.querySelector('textarea'); if(el){el.focus();return true;} return false; } catch(e){return false;} })()`

      await (activeRef.current as any).executeJavaScript(focusScript)

      setTimeout(() => {
        try {
          if (activeRef.current) {
            ;(activeRef.current as any).paste()
            setScreenshot(null)
            screenshotRef.current = null
          }
        } catch (error) {
          console.error('Failed to paste:', error)
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
    window.api.setIgnoreMouseEvents(true, { forward: true })
  }

  // Inject Prompt Logic
  const handleInjectPrompt = async (prompt: SavedPrompt, autoSend: boolean) => {
    const activeRef =
      activeAI === 'chatgpt' ? chatgptRef : activeAI === 'gemini' ? geminiRef : perplexityRef
    if (!activeRef.current) return

    let url = ''
    if (activeAI === 'chatgpt') url = 'https://chatgpt.com'
    else if (activeAI === 'gemini') url = 'https://gemini.google.com'

    // Perplexity not yet supported with adapter, fallback
    const provider = getProviderForUrl(url)

    // Helper to fallback
    const fallback = async (msg: string) => {
      await window.api.writeToClipboard(prompt.text)
      setToastMsg(`From ${prompt.title}: ${msg}. Copied to clipboard.`)
      setShowToast(true)
    }

    if (!provider) {
      await fallback('Provider not supported')
      return
    }

    try {
      const result = await provider.inject(activeRef.current as any, prompt.text, autoSend)
      if (!result.ok) {
        await fallback(result.error || 'Injection failed')
      }
    } catch (err) {
      await fallback('Error during injection')
    }
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
          {(isResizing || isDragging) && <div className="mouse-guard"></div>}
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

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                display: activeAI === 'chatgpt' ? 'block' : 'none',
                height: '100%',
                width: '100%'
              }}
            >
              {/* @ts-ignore: partition is valid for webview but missing in React types */}
              <webview
                ref={chatgptRef}
                src="https://chatgpt.com"
                partition="persist:chatgpt"
                style={{ width: '100%', height: '100%' }}
              ></webview>
            </div>
            <div
              style={{
                display: activeAI === 'gemini' ? 'block' : 'none',
                height: '100%',
                width: '100%'
              }}
            >
              {/* @ts-ignore: partition is valid for webview but missing in React types */}
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
                width: '100%'
              }}
            >
              {/* @ts-ignore: partition is valid for webview but missing in React types */}
              <webview
                ref={perplexityRef}
                src="https://www.perplexity.ai"
                partition="persist:perplexity"
                style={{ width: '100%', height: '100%' }}
              ></webview>
            </div>
          </div>

          {/* Saved Prompts Panel */}
          {activeAI !== 'perplexity' && <SavedPromptsPanel onInject={handleInjectPrompt} />}
          {activeAI === 'perplexity' && (
            <div
              style={{
                padding: 10,
                fontSize: '0.8rem',
                color: '#666',
                borderTop: '1px solid #333'
              }}
            >
              Saved prompts are currently supported for ChatGPT and Gemini.
            </div>
          )}

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

      <Toast message={toastMsg} isVisible={showToast} onClose={() => setShowToast(false)} />
    </>
  )
}

export default App
