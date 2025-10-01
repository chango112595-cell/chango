import Convo from "../brain/convo.js";

// Simple $ helper if not exists
const $ = (id) => document.getElementById(id);

// Output helper
const out = (obj) => console.log('[VoiceControls]', obj);

// Wire up Ask button
document.addEventListener('DOMContentLoaded', () => {
  const askBtn = $('vcAsk');
  if (askBtn) {
    askBtn.onclick = async ()=>{
      const q = $('vcPhrase').value || 'what time is it?';
      const r = await Convo.ask(q);
      out(r?.ok ? {ok:true, asked:q, reply:r.reply} : r);
    };
  }
});