export interface SavedPrompt {
  id: string
  title: string
  icon?: string
  text: string
  createdAt: number
  updatedAt: number
}

export interface SavedPromptsAPI {
  getSavedPrompts: () => Promise<SavedPrompt[]>
  saveSavedPrompt: (prompt: SavedPrompt) => Promise<boolean>
  deleteSavedPrompt: (id: string) => Promise<boolean>
  getAutoSendSettings: () => Promise<boolean>
  setAutoSendSettings: (autoSend: boolean) => Promise<boolean>
}
