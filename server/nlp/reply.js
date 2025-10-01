import express from "express";

function routeIntent(q) {
  const s = (q||"").trim();
  if (!s) return "I didn't catch that.";
  if (/\b(time|what.*time)\b/i.test(s)) return "It is " + new Date().toLocaleTimeString() + ".";
  if (/\b(date|today)\b/i.test(s))      return "Today is " + new Date().toLocaleDateString() + ".";
  if (/\bwho.*you|what.*chango\b/i.test(s)) return "I'm Chango, your adaptive assistant.";
  if (/\bhow.*you\b/i.test(s))          return "Feeling sharp and online.";
  return "Noted. Want me to act on that?";
}

export default function registerReply(app){
  const r = express.Router();
  r.post("/reply", express.json({limit:"1mb"}), (req,res)=>{
    const reply = routeIntent(req.body?.text||"");
    res.json({ok:true, reply});
  });
  app.use("/nlp", r);
}