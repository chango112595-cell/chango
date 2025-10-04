export async function sendToLLMSafe(q:string){
  const t=q.toLowerCase().trim();
  if(/\btime\b/.test(t)){ const n=new Date(); return `The current time is ${n.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`; }
  if(/\bdate\b/.test(t)){ const n=new Date(); return `Today is ${n.toLocaleDateString()}.`; }
  if(/who\s*are\s*you/.test(t)||/your name/.test(t)) return "I'm Chango, online and listening.";
  return "Got it. What else should I do?";
}