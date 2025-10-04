// Chango AI Curiosity Engine - Adaptive triggers and suggestions
(function(global) {
  const curiosityState = {
    active: false,
    lastTrigger: null,
    triggerCount: 0,
    suggestions: [],
    profileChanges: [],
    idleTime: 0,
    lastActivity: Date.now()
  };

  // Curiosity triggers
  const TRIGGERS = {
    idle: { threshold: 30000, message: "I notice you've been quiet. Would you like me to suggest something?" },
    profileChange: { threshold: 3, message: "You've been experimenting with different accents. Want to hear a story in each?" },
    repeated: { threshold: 2, message: "You seem to enjoy that feature. Shall I show you more advanced options?" },
    exploration: { threshold: 5, message: "You're exploring many features! Would you like a guided tour?" }
  };

  // Generate contextual suggestions
  function generateSuggestions(context) {
    const suggestions = [];
    
    if(context.includes('accent')) {
      suggestions.push("Try combining accents for unique voices");
      suggestions.push("Record your own voice to create a custom profile");
      suggestions.push("Listen to how different accents handle the same phrase");
    }
    
    if(context.includes('hologram')) {
      suggestions.push("Try the wander mode for ambient visualization");
      suggestions.push("Adjust the speed to match your mood");
      suggestions.push("Switch between Sentinel and Awakened modes");
    }
    
    if(context.includes('voice')) {
      suggestions.push("Test different voice speeds for clarity");
      suggestions.push("Try speaking longer passages");
      suggestions.push("Experiment with emotional tones");
    }
    
    // Default suggestions
    if(suggestions.length === 0) {
      suggestions.push("Explore the accent emulator");
      suggestions.push("Try the hologram visualization");
      suggestions.push("Record your voice for analysis");
    }
    
    return suggestions;
  }

  // Track user activity
  function trackActivity(action, data = {}) {
    curiosityState.lastActivity = Date.now();
    curiosityState.idleTime = 0;
    
    // Track profile changes
    if(action === 'profileChange') {
      curiosityState.profileChanges.push({
        timestamp: Date.now(),
        profile: data.profile,
        intensity: data.intensity
      });
      
      // Trigger curiosity if multiple changes
      if(curiosityState.profileChanges.length >= TRIGGERS.profileChange.threshold) {
        triggerCuriosity('profileChange');
        curiosityState.profileChanges = [];
      }
    }
    
    // Track repeated actions
    if(action === 'repeat') {
      curiosityState.triggerCount++;
      if(curiosityState.triggerCount >= TRIGGERS.repeated.threshold) {
        triggerCuriosity('repeated');
        curiosityState.triggerCount = 0;
      }
    }
  }

  // Trigger curiosity response
  function triggerCuriosity(type) {
    if(!curiosityState.active) return;
    
    const trigger = TRIGGERS[type];
    if(!trigger) return;
    
    curiosityState.lastTrigger = type;
    
    // Update status
    const statusEl = document.getElementById('status');
    if(statusEl) {
      statusEl.textContent = 'curiosity: ' + trigger.message;
    }
    
    // Generate suggestions
    curiosityState.suggestions = generateSuggestions(type);
    
    // Speak the message if voice is enabled
    if(window.speak && type !== 'idle') {
      window.speak(trigger.message);
    }
    
    // Show suggestions in console (could be displayed in UI)
    console.log('Curiosity suggestions:', curiosityState.suggestions);
  }

  // Monitor idle time
  function monitorIdle() {
    const now = Date.now();
    curiosityState.idleTime = now - curiosityState.lastActivity;
    
    if(curiosityState.idleTime > TRIGGERS.idle.threshold && curiosityState.active) {
      triggerCuriosity('idle');
      curiosityState.lastActivity = now; // Reset to prevent spam
    }
  }

  // Profile change detection
  function detectProfileChange() {
    const profileSelect = document.getElementById('accentProfile');
    const intensitySlider = document.getElementById('accentIntensity');
    
    if(profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        trackActivity('profileChange', {
          profile: e.target.value,
          intensity: intensitySlider?.value || 0.5
        });
      });
    }
    
    if(intensitySlider) {
      intensitySlider.addEventListener('change', (e) => {
        trackActivity('profileChange', {
          profile: profileSelect?.value || 'neutral',
          intensity: e.target.value
        });
      });
    }
  }

  // Track button clicks for repeated actions
  function trackButtons() {
    const repeatBtn = document.getElementById('btnRepeatWithAccent');
    const testBtn = document.getElementById('btnTest');
    const speakBtn = document.getElementById('btnSpeak');
    
    [repeatBtn, testBtn, speakBtn].forEach(btn => {
      if(btn) {
        btn.addEventListener('click', () => {
          trackActivity('repeat');
        });
      }
    });
  }

  // Activate curiosity engine
  function activate() {
    curiosityState.active = true;
    curiosityState.lastActivity = Date.now();
    
    // Set up monitoring
    setInterval(monitorIdle, 5000);
    
    // Set up event tracking
    detectProfileChange();
    trackButtons();
    
    // Track general activity
    document.addEventListener('click', () => trackActivity('click'));
    document.addEventListener('keypress', () => trackActivity('keypress'));
    
    console.log('Curiosity Engine activated');
  }

  // Deactivate curiosity engine
  function deactivate() {
    curiosityState.active = false;
    console.log('Curiosity Engine deactivated');
  }

  // Get current state
  function getState() {
    return {
      ...curiosityState,
      suggestions: [...curiosityState.suggestions]
    };
  }

  // Manual trigger for testing
  function suggest(context = '') {
    const suggestions = generateSuggestions(context);
    console.log('Curiosity suggestions for', context || 'general', ':', suggestions);
    return suggestions;
  }

  // Initialize on DOM ready
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Auto-activate after a delay
      setTimeout(activate, 3000);
    });
  } else {
    setTimeout(activate, 3000);
  }

  // Export API
  global.ChangoCuriosity = {
    activate,
    deactivate,
    trackActivity,
    suggest,
    getState,
    triggerCuriosity
  };
})(window);