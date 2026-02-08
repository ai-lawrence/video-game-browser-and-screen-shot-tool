export const chatgpt = {
  id: 'chatgpt',
  name: 'ChatGPT',
  matches: (url: string) => url.includes('chatgpt.com') || url.includes('openai.com'),
  inject: async (
    webview: Electron.WebviewTag,
    text: string,
    autoSend: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      // 1. Focus the input
      const focusScript = `
        (function() {
          try {
            const input = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]');
            if (!input) return false;
            input.focus();
            return true;
          } catch (e) { return false; }
        })()
      `
      const focused = await webview.executeJavaScript(focusScript, true)
      if (!focused) {
        return { ok: false, error: 'Could not focus input' }
      }

      // 2. Insert text using native method
      await webview.insertText(text)

      // 3. Auto-send if enabled
      if (autoSend) {
        const sendScript = `
          (function() {
            setTimeout(() => {
              const sendBtn = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label="Send prompt"]');
              if (sendBtn) {
                sendBtn.click();
              } else {
                // Fallback Enter
                const input = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]');
                if (input) {
                  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                }
              }
            }, 100);
          })()
        `
        await webview.executeJavaScript(sendScript, true)
      }

      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Injection failed: ${err}` }
    }
  }
}
