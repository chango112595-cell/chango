export async function sendToLLM(q: string): Promise<string> {
  const t = q.toLowerCase().trim();
  if (/time/.test(t)) {
    const now = new Date();
    return `The current time is ${now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}.`;
  }
  if (/date/.test(t)) {
    const now = new Date();
    return `Today is ${now.toLocaleDateString()}.`;
  }
  if (/who\s*are\s*you/.test(t) || /your name/.test(t)) return "I'm Chango, your AI system — online and listening.";
  return "Got it. What else would you like to try?";
}