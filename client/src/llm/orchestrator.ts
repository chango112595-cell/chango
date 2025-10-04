import { DebugBus } from '../debug/DebugBus';

export async function sendToLLM(text: string): Promise<string> {
  try {
    const response = await fetch('/api/nlp/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await response.json();
    return data.reply || 'I understand. How can I help you?';
  } catch (error) {
    DebugBus.emit({ tag: 'LLM', level: 'error', msg: 'Failed to get reply', data: error });
    return 'I had trouble processing that. Could you try again?';
  }
}