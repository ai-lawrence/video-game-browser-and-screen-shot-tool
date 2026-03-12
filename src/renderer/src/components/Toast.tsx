import React, { useEffect } from 'react'

interface ToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
    return
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(12, 30, 30, 0.95)',
        color: '#e4e8e8',
        padding: '10px 20px',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 10px rgba(37,244,244,0.08)',
        zIndex: 10000,
        fontSize: '0.85rem',
        border: '1px solid rgba(37,244,244,0.15)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
        fontWeight: 500,
        letterSpacing: '0.02em'
      }}
    >
      {message}
    </div>
  )
}

export default Toast
