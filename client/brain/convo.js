import { speakBrowser, VoiceBus } from "../voice/tts_browser.js";

const Convo = (() => {
  let busy=false, lastUser="", lastBot="";
  async function ask(text){
    if (!text?.trim()) return {ok:false, reason:"empty"};
    if (!VoiceBus.power || VoiceBus.mute) return {ok:false, reason:"muted_or_off"};
    if (busy) return {ok:false, reason:"busy"};
    busy = true; lastUser = text;
    try{
      const r = await fetch("/nlp/reply", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({text})
      }).then(r=>r.json()).catch(()=>null);
      const reply = r?.ok ? (r.reply||"Okay.") : "Okay.";
      lastBot = reply;
      await speakBrowser({
        text: reply,
        accent: document.getElementById("vcAccent")?.value || "en-US",
        rate: +document.getElementById("vcRate")?.value || 1,
        pitch:+document.getElementById("vcPitch")?.value|| 1,
        volume:+document.getElementById("vcVol")?.value  || 1
      });
      return {ok:true, reply};
    } finally {
      busy=false;
      const d=document.getElementById("diagConvo");
      if (d) d.textContent = JSON.stringify({lastUser,lastBot,busy},null,2);
    }
  }
  async function handleFinalTranscript(txt){
    if (!txt?.trim()) return;
    if (/\bchango\b/i.test(txt)) { await speakBrowser({text:"Yes?", accent:"en-US"}); return; }
    await ask(txt);
  }
  return { ask, handleFinalTranscript };
})();
export default Convo;