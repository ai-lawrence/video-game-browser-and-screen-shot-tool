import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import HotkeyRecorder from '../components/HotkeyRecorder'

describe('HotkeyRecorder', () => {
  it('renders correctly with initial value', () => {
    render(<HotkeyRecorder label="Test Hotkey" value="Alt+S" onChange={() => {}} />)
    expect(screen.getByText('Test Hotkey')).toBeInTheDocument()
    expect(screen.getByText('Alt+S')).toBeInTheDocument()
  })

  it('enters recording mode when clicked', () => {
    render(<HotkeyRecorder label="Test Hotkey" value="Alt+S" onChange={() => {}} />)
    fireEvent.click(screen.getByText('Alt+S'))
    expect(screen.getByText('Press keys...')).toBeInTheDocument()
  })

  it('captures keys and converts to Electron accelerator', () => {
    const onChange = vi.fn()
    render(<HotkeyRecorder label="Test Hotkey" value="Alt+S" onChange={onChange} />)

    const input = screen.getByText('Alt+S')
    fireEvent.click(input)

    // Simulate Ctrl+Shift+Z
    fireEvent.keyDown(input, {
      key: 'z',
      ctrlKey: true,
      shiftKey: true
    })

    expect(onChange).toHaveBeenCalledWith('CommandOrControl+Shift+Z')
    expect(screen.queryByText('Press keys...')).not.toBeInTheDocument()
  })

  it('ignores modifier keys as primary keys', () => {
    const onChange = vi.fn()
    render(<HotkeyRecorder label="Test Hotkey" value="Alt+S" onChange={onChange} />)

    const input = screen.getByText('Alt+S')
    fireEvent.click(input)

    // Press only Ctrl
    fireEvent.keyDown(input, { key: 'Control', ctrlKey: true })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Press keys...')).toBeInTheDocument()
  })
})
