import { voiceGate } from './gate';
import { respond } from '../services/responder';

export async function handleUserInput(text: string) {
  const reply = await respond(text);
  return reply;
}

export async function handleTranscription(text: string) {
  if (!voiceGate.isOpen) return null;
  const reply = await respond(text);
  return reply;
}