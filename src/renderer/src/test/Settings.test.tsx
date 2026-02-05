import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Settings from '../components/Settings'

// Mock window.api
const mockApi = {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
}

vi.stubGlobal('api', mockApi)

describe('Settings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockApi.getSettings.mockResolvedValue({
            screenshotHotkey: 'Alt+S',
            snipHotkey: 'Alt+Shift+S',
        })
    })

    it('loads settings on mount', async () => {
        render(<Settings onClose={() => { }} />)
        await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled())
        expect(screen.getByText('Alt+S')).toBeInTheDocument()
        expect(screen.getByText('Alt+Shift+S')).toBeInTheDocument()
    })

    it('shows error on hotkey conflict', async () => {
        render(<Settings onClose={() => { }} />)
        await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled())

        // Click to record new snip hotkey
        const snipHotkeyInput = screen.getByText('Alt+Shift+S')
        fireEvent.click(snipHotkeyInput)

        // Press Alt+S (conflict with screenshot)
        fireEvent.keyDown(snipHotkeyInput, {
            key: 'S',
            altKey: true,
        })

        expect(screen.getByText(/Cannot use the same hotkey for multiple actions/)).toBeInTheDocument()
        expect(mockApi.saveSettings).not.toHaveBeenCalled()
    })

    it('saves settings when hotkey is changed successfully', async () => {
        render(<Settings onClose={() => { }} />)
        await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled())

        const snipHotkeyInput = screen.getByText('Alt+Shift+S')
        fireEvent.click(snipHotkeyInput)

        // Press Ctrl+Shift+X
        fireEvent.keyDown(snipHotkeyInput, {
            key: 'X',
            ctrlKey: true,
            shiftKey: true,
        })

        expect(mockApi.saveSettings).toHaveBeenCalledWith({
            screenshotHotkey: 'Alt+S',
            snipHotkey: 'CommandOrControl+Shift+X',
        })
        expect(screen.queryByText(/Cannot use the same hotkey/)).not.toBeInTheDocument()
    })
})
