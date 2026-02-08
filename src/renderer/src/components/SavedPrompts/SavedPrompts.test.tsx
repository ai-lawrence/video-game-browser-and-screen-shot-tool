import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SavedPromptsPanel from './SavedPromptsPanel'
import { SavedPrompt } from '../../providers/types'

// Mock the window.api
const mockApi = {
  getSavedPrompts: vi.fn(),
  saveSavedPrompt: vi.fn(),
  deleteSavedPrompt: vi.fn(),
  getAutoSendSettings: vi.fn(),
  setAutoSendSettings: vi.fn()
}

// Assign to global window
global.window.api = mockApi as any

describe('SavedPromptsPanel', () => {
  const mockPrompts: SavedPrompt[] = [
    { id: '1', title: 'Test 1', text: 'Prompt 1', icon: '🧪', createdAt: 1000, updatedAt: 1000 },
    { id: '2', title: 'Test 2', text: 'Prompt 2', icon: '📝', createdAt: 2000, updatedAt: 2000 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getSavedPrompts.mockResolvedValue(mockPrompts)
    mockApi.getAutoSendSettings.mockResolvedValue(false)
  })

  it('renders prompts loaded from api', async () => {
    render(<SavedPromptsPanel onInject={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Test 1')).toBeDefined()
      expect(screen.getByText('Test 2')).toBeDefined()
    })
  })

  it('opens modal on add button click', async () => {
    render(<SavedPromptsPanel onInject={vi.fn()} />)

    const addBtn = screen.getByTitle('Add Prompt')
    fireEvent.click(addBtn)

    expect(screen.getByText('Add New Prompt')).toBeDefined()
  })

  it('renders emoji picker button in modal', async () => {
    render(<SavedPromptsPanel onInject={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Add Prompt'))

    const emojiBtn = screen.getByText('💬')
    expect(emojiBtn).toBeDefined()
    expect(emojiBtn.className).toContain('emoji-btn')
  })

  it('calls onInject when a chip is clicked', async () => {
    const onInject = vi.fn()
    render(<SavedPromptsPanel onInject={onInject} />)

    await waitFor(() => screen.getByText('Test 1'))

    fireEvent.click(screen.getByText('Test 1'))
    expect(onInject).toHaveBeenCalledWith(mockPrompts[0], false)
  })

  it('toggles auto-send setting', async () => {
    render(<SavedPromptsPanel onInject={vi.fn()} />)

    await waitFor(() => screen.getByTitle('Auto-send: OFF'))

    const toggleBtn = screen.getByTitle('Auto-send: OFF')
    fireEvent.click(toggleBtn)

    expect(mockApi.setAutoSendSettings).toHaveBeenCalledWith(true)
    // In real app, state updates locally too
  })
})
