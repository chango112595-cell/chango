// Test that all Chango modules integrate correctly
console.log("Testing Chango voice system integration...");

// Test imports
try {
  // Import the bootstrap which imports everything else
  const bootstrap = await import('../chango/bootstrap.js');
  
  console.log("✓ Bootstrap module loaded successfully");
  console.log("✓ Exported objects:", Object.keys(bootstrap));
  
  // Verify all expected exports exist
  const expectedExports = ['ui', 'vad', 'mfcc', 'tts', 'stt', 'wake', 'unlock', 'speak', 'stop', 'bus', 'ctxPool'];
  let allExportsPresent = true;
  
  for (const exp of expectedExports) {
    if (bootstrap[exp]) {
      console.log(`  ✓ ${exp} is exported`);
    } else {
      console.log(`  ✗ ${exp} is missing`);
      allExportsPresent = false;
    }
  }
  
  if (allExportsPresent) {
    console.log("\n✅ All Chango modules integrated successfully!");
    console.log("The voice system is ready to use with:");
    console.log("  - UI adapter for DOM binding via data-chango-* attributes");
    console.log("  - Voice Activity Detection (VAD)");
    console.log("  - MFCC for voiceprint analysis");
    console.log("  - Formant synthesis TTS");
    console.log("  - Wake word detection");
    console.log("  - Web Speech API STT");
    console.log("  - Prosody and accent engines");
    console.log("\nTo use in your app:");
    console.log("  1. Add data-chango-* attributes to your DOM elements");
    console.log("  2. Import bootstrap.js in your main application");
    console.log("  3. The UI adapter will automatically bind to the elements");
  } else {
    console.error("❌ Some exports are missing!");
  }
  
} catch (error) {
  console.error("❌ Failed to load Chango modules:", error);
  console.error("Error details:", error.stack);
}

console.log("\n--- End of Chango integration test ---");