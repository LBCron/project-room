import { createHash } from "node:crypto";

// The prompt remains selectable without JavaScript; reveal copy controls only when ready.
export const AGENT_PASTE_COPY_SCRIPT = `(() => {
  document.querySelectorAll('[data-copy-prompt]').forEach(button => {
    const field = document.getElementById(button.dataset.copyPrompt);
    const status = document.getElementById(button.dataset.copyPrompt + '-status');
    if (!field || !status) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('unavailable');
        await Promise.race([navigator.clipboard.writeText(field.value), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))]);
        status.textContent = 'Copied. Paste into your agent.';
      } catch {
        field.focus(); field.select();
        status.textContent = 'Copy the selected prompt, then paste it into your agent.';
      } finally { button.disabled = false; }
    });
  });
})();`;
export const AGENT_PASTE_COPY_HASH = createHash("sha256").update(AGENT_PASTE_COPY_SCRIPT).digest("base64");
