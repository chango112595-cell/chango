export async function respond(input: string): Promise<string> {
  const q = input.trim().toLowerCase();

  if (/^what(?:'s| is) the time|time is it/.test(q)) {
    return `The current time is ${new Date().toLocaleTimeString()}.`;
  }
  if (/^who are you|your name/.test(q)) return `I'm Chango, your AI companion.`;

  try {
    // const res = await fetch('/api/llm', { method:'POST', body: JSON.stringify({ q: input }) });
    // const { text } = await res.json();
    // return text;
    return `You said: ${input}`;
  } catch {
    return `I heard: "${input}", but my reasoning service is busy right now.`;
  }
}