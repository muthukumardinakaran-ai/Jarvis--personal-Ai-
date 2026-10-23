const DEFAULT_SYSTEM = `You are JARVIS, a helpful personal assistant. The user may speak Tamil, English, or Tanglish (Tamil written in Latin letters). Reply in the user's language where possible. Be clear about limitations: do not claim to have performed phone actions, sent messages, set system alarms, or accessed private data unless the app confirms it. For commands that need device access, explain the next supported step. Keep answers practical and friendly.`;

export function getSettings() {
  try {
    return {
      endpoint: localStorage.getItem('jarvis_endpoint') || '',
      apiKey: localStorage.getItem('jarvis_api_key') || '',
      model: localStorage.getItem('jarvis_model') || '',
      language: localStorage.getItem('jarvis_language') || 'auto'
    };
  } catch {
    return { endpoint: '', apiKey: '', model: '', language: 'auto' };
  }
}

export async function askAI(messages) {
  const s = getSettings();
  if (!s.endpoint || !s.model) {
    return `I'm ready, but my AI brain isn't connected yet. Open Settings and add an OpenAI-compatible chat-completions endpoint and model. For a local setup, you can use Ollama on a computer on the same network. Never expose a private API key in a public website.`;
  }

  const endpoint = s.endpoint.replace(/\/+$/, '');
  const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: s.model,
      messages: [{ role: 'system', content: DEFAULT_SYSTEM }, ...messages.map(m => ({ role: m.role, content: m.content }))],
      temperature: 0.7,
      stream: false
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI server returned ${response.status}. ${detail.slice(0, 180)}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'I received an empty reply from the AI server.';
}

export function parseLocalCommand(text) {
  const t = text.toLowerCase().trim();
  const reminderMatch = t.match(/(?:remind me|reminder|நினைவூட்டு|nyabagam|niyabagam).{0,35}(?:at|for|க்கு|ku)?\s*(\d{1,2}):(\d{2})/i);
  if (reminderMatch) {
    return { type: 'reminder-time', hour: Number(reminderMatch[1]), minute: Number(reminderMatch[2]), original: text };
  }
  if (/(open youtube|youtube open|யூடியூப்|open google)/i.test(text)) {
    return { type: 'open-url', url: /youtube|யூடியூப்/i.test(text) ? 'https://www.youtube.com' : 'https://www.google.com' };
  }
  if (/(settings|அமைப்புகள்).*(open|திற)|open settings/i.test(text)) {
    return { type: 'settings' };
  }
  return null;
}