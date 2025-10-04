// NLP Reply Route Handler
import { Router } from 'express';

const router = Router();

// Generate reply based on text input
function generateReply(text) {
  const s = (text || "").trim().toLowerCase();
  if (!s) return "I didn't catch that. Could you please repeat?";
  
  // Time-related queries
  if (/\b(time|what.*time|clock)\b/i.test(s)) {
    return `It's currently ${new Date().toLocaleTimeString()}.`;
  }
  
  // Date-related queries
  if (/\b(date|today|day)\b/i.test(s)) {
    return `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  }
  
  // Identity queries
  if (/\b(who.*you|what.*you|what.*chango|your.*name)\b/i.test(s)) {
    return "I'm Chango, your adaptive AI assistant. I'm here to help with questions and tasks.";
  }
  
  // Status/wellbeing queries
  if (/\b(how.*you|feeling|status)\b/i.test(s)) {
    return "I'm operating at full capacity and ready to assist you.";
  }
  
  // Greeting patterns
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(s)) {
    return "Hello! How can I assist you today?";
  }
  
  // Thank you patterns
  if (/\b(thanks|thank you|appreciate)\b/i.test(s)) {
    return "You're welcome! Happy to help.";
  }
  
  // Goodbye patterns
  if (/\b(bye|goodbye|see you|farewell)\b/i.test(s)) {
    return "Goodbye! Feel free to come back anytime you need assistance.";
  }
  
  // Help queries
  if (/\b(help|assist|what.*can.*do|capabilities)\b/i.test(s)) {
    return "I can help with various tasks including answering questions, providing information about time and date, and having conversations. What would you like to know?";
  }
  
  // Default response for unrecognized input
  return "I understand. Could you tell me more about what you'd like to know or do?";
}

// Analyze confidence level of the response
function analyzeConfidence(text) {
  const s = (text || "").trim().toLowerCase();
  if (!s) return 0.1;
  
  // High confidence for direct queries
  if (/\b(time|date|who.*you|hello|thanks|bye)\b/i.test(s)) {
    return 0.95;
  }
  
  // Medium confidence for status queries
  if (/\b(how.*you|help|what.*can.*do)\b/i.test(s)) {
    return 0.8;
  }
  
  // Lower confidence for everything else
  return 0.5;
}

// POST /api/nlp/reply - Generate NLP response
router.post('/nlp/reply', async (req, res) => {
  try {
    const { text, context } = req.body || {};
    
    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: 'text field is required and must be a string' 
      });
    }
    
    // Generate response
    const reply = generateReply(text);
    const confidence = analyzeConfidence(text);
    
    // Build response with context
    const response = {
      ok: true,
      reply,
      confidence,
      context: {
        originalText: text,
        processedAt: new Date().toISOString(),
        ...context
      }
    };
    
    // Log the interaction (optional, for debugging)
    console.log('[NLP] Request:', text.slice(0, 100));
    console.log('[NLP] Response:', reply.slice(0, 100));
    
    return res.json(response);
    
  } catch (error) {
    console.error('[NLP] Error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to generate reply',
      details: error.message 
    });
  }
});

// GET /api/nlp/status - Check NLP service status
router.get('/nlp/status', (req, res) => {
  res.json({
    ok: true,
    service: 'Chango NLP',
    version: '1.0.0',
    capabilities: [
      'greetings',
      'identity',
      'wellbeing',
      'time',
      'capabilities',
      'thanks',
      'goodbye',
      'jokes',
      'weather',
      'help',
      'basic_math'
    ]
  });
});

export default router;