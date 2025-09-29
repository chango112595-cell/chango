// NLP Reply Route Handler
import { Router } from 'express';
import { generateReply, analyzeConfidence } from '../nlp/reply.js';

const router = Router();

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