export const gemini = {
  id: 'gemini',
  name: 'Gemini',
  matches: (url: string) => url.includes('gemini.google.com'),
  inject: async (
    webview: Electron.WebviewTag,
    text: string,
    autoSend: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      // 1. Focus input
      const focusScript = `
        (function() {
          try {
            const input = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
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

      // 2. Insert text
      await webview.insertText(text)

      // 3. Auto-send
      if (autoSend) {
        const sendScript = `
          (function() {
            setTimeout(() => {
              const sendBtn = document.querySelector('button[aria-label="Send message"]') || document.querySelector('.send-button');
              if (sendBtn) {
                sendBtn.click();
              } else {
                 const input = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
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
