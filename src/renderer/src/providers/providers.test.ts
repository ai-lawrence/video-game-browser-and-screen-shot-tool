import { describe, it, expect } from 'vitest'
import { getProviderForUrl } from './index'

describe('Provider Selection', () => {
  it('should match ChatGPT URLs', () => {
    expect(getProviderForUrl('https://chatgpt.com/')).toBeDefined()
    expect(getProviderForUrl('https://chatgpt.com/c/123')).toBeDefined()
    expect(getProviderForUrl('https://openai.com/chatgpt')).toBeDefined()
    expect(getProviderForUrl('https://chatgpt.com')?.id).toBe('chatgpt')
  })

  it('should match Gemini URLs', () => {
    expect(getProviderForUrl('https://gemini.google.com/')).toBeDefined()
    expect(getProviderForUrl('https://gemini.google.com/app')).toBeDefined()
    expect(getProviderForUrl('https://gemini.google.com')?.id).toBe('gemini')
  })

  it('should return undefined for unknown URLs', () => {
    expect(getProviderForUrl('https://google.com')).toBeUndefined()
    expect(getProviderForUrl('https://example.com')).toBeUndefined()
    expect(getProviderForUrl('')).toBeUndefined()
  })
})
