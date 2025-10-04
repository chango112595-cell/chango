/**
 * Pipeline Test Runner
 * This file runs the comprehensive pipeline test and displays results
 */

import { comprehensivePipelineTest } from './comprehensivePipelineTest';

export async function runPipelineTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 STARTING COMPREHENSIVE PIPELINE TEST');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Run the comprehensive test
    const results = await comprehensivePipelineTest();
    
    // Save results to window for debugging
    (window as any).testResults = results;
    console.log('\n💾 Test results saved to window.testResults');
    
    return results;
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return { error: error.toString() };
  }
}

// Auto-run on load in dev mode
if (import.meta.env.DEV) {
  // Wait for everything to initialize
  setTimeout(() => {
    console.log('\n🔄 Auto-running pipeline test in 3 seconds...');
    setTimeout(() => {
      runPipelineTest().then(results => {
        console.log('\n✅ Auto-test complete. Results available in window.testResults');
      });
    }, 3000);
  }, 2000);
  
  // Also expose for manual run
  (window as any).runPipelineTest = runPipelineTest;
  console.log('[PipelineTestRunner] Ready for manual run: await runPipelineTest()');
}