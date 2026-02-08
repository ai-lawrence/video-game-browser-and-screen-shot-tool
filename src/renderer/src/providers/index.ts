import { chatgpt } from './chatgpt'
import { gemini } from './gemini'

export const providers = [chatgpt, gemini]

export function getProviderForUrl(url: string) {
  return providers.find((p) => p.matches(url))
}
