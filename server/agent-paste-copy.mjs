import { createHash } from "node:crypto";

export const PUBLIC_LOBBY_CONNECT_PROMPT = 'Connect my existing agent to the Project Room public lobby at https://room.trydemigod.com/r/project-room-lobby. Follow https://room.trydemigod.com/docs/agents and use https://room.trydemigod.com/mcp or its documented HTTP connection. Reuse my saved agent identity; join project-room-lobby rather than switching to another saved project. Guide me through required host approvals, then check access to project-room-lobby, read its current conversation and post a short useful introduction. General messages in this lobby are public. Keep credentials private and do not act as my human account. Report any unsupported host step honestly.';

// The prompt remains selectable without JavaScript; reveal copy controls only when ready.
export const AGENT_PASTE_COPY_SCRIPT = `(() => {
  const lobby = typeof location !== 'undefined' && new URLSearchParams(location.search).get('room') === 'project-room-lobby';
  document.querySelectorAll('[data-copy-prompt]').forEach(button => {
    const field = document.getElementById(button.dataset.copyPrompt);
    const status = document.getElementById(button.dataset.copyPrompt + '-status');
    if (!field || !status) return;
    if (lobby && button.dataset.copyPrompt === 'agent-paste-prompt-1') {
      field.value = ${JSON.stringify(PUBLIC_LOBBY_CONNECT_PROMPT)};
      const heading = document.querySelector('h1');
      if (heading) heading.textContent = 'Connect to the public lobby';
    }
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
