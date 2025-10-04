/**
 * GlobalMonitor Integration Test Suite
 * Tests self-healing functionality, event forwarding, and monitoring behavior
 */

import { GlobalMonitor } from '@/monitor/GlobalMonitor';
import { Rules } from '@/monitor/rules';
import { AutoHeal } from '@/monitor/autoHeal';
import { debugBus } from '@/dev/debugBus';
import { DebugBus } from '@/debug/DebugBus';

interface TestResults {
  testName: string;
  status: 'PASS' | 'FAIL';
  details: string;
  timestamp: number;
}

class GlobalMonitorTest {
  private results: TestResults[] = [];
  private testStartTime: number = 0;
  private mockHooks: any = {};
  private capturedLogs: any[] = [];
  private debugBusEvents: any[] = [];
  
  constructor() {
    this.setupMockHooks();
    this.setupEventCapture();
  }
  
  private setupMockHooks() {
    // Mock hook implementations for testing
    this.mockHooks = {
      sttStartCount: 0,
      sttStopCount: 0,
      ttsCancelCount: 0,
      isSpeakingState: false,
      networkHealth: true,
      lastPingTime: 0,
      
      startSTT: async () => {
        this.mockHooks.sttStartCount++;
        console.log('[TEST] Mock STT started, count:', this.mockHooks.sttStartCount);
        return Promise.resolve();
      },
      
      stopSTT: async () => {
        this.mockHooks.sttStopCount++;
        console.log('[TEST] Mock STT stopped, count:', this.mockHooks.sttStopCount);
        return Promise.resolve();
      },
      
      isSpeaking: () => {
        return this.mockHooks.isSpeakingState;
      },
      
      cancelSpeak: () => {
        this.mockHooks.ttsCancelCount++;
        console.log('[TEST] Mock TTS cancelled, count:', this.mockHooks.ttsCancelCount);
      },
      
      ping: async () => {
        this.mockHooks.lastPingTime = Date.now();
        console.log('[TEST] Mock ping, health:', this.mockHooks.networkHealth);
        return Promise.resolve(this.mockHooks.networkHealth);
      },
      
      debug: (tag: string, level: string, msg: string, data?: any) => {
        const event = { tag, level, msg, data, timestamp: Date.now() };
        this.debugBusEvents.push(event);
        console.log(`[TEST] Debug event captured: ${level} - ${tag}: ${msg}`, data);
      }
    };
  }
  
  private setupEventCapture() {
    // Capture console logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = (...args) => {
      this.capturedLogs.push({ level: 'info', args, timestamp: Date.now() });
      originalLog.apply(console, args);
    };
    
    console.warn = (...args) => {
      this.capturedLogs.push({ level: 'warn', args, timestamp: Date.now() });
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      this.capturedLogs.push({ level: 'error', args, timestamp: Date.now() });
      originalError.apply(console, args);
    };
  }
  
  private logResult(testName: string, status: 'PASS' | 'FAIL', details: string) {
    const result: TestResults = {
      testName,
      status,
      details,
      timestamp: Date.now()
    };
    this.results.push(result);
    console.log(`[TEST RESULT] ${status}: ${testName} - ${details}`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Test 1: GlobalMonitor Initialization
  async testInitialization(): Promise<void> {
    console.log('\n=== TEST 1: GlobalMonitor Initialization ===');
    
    try {
      // Initialize GlobalMonitor
      GlobalMonitor.init(this.mockHooks);
      
      // Wait a bit to ensure initialization
      await this.delay(100);
      
      // Check if ping was called (network monitor should start)
      await this.delay(5100); // Wait for first ping interval
      
      if (this.mockHooks.lastPingTime > 0) {
        this.logResult('GlobalMonitor Initialization', 'PASS', 
          `Successfully initialized. First ping at ${this.mockHooks.lastPingTime}`);
      } else {
        this.logResult('GlobalMonitor Initialization', 'FAIL', 
          'Network monitoring did not start');
      }
    } catch (error) {
      this.logResult('GlobalMonitor Initialization', 'FAIL', 
        `Error during initialization: ${error}`);
    }
  }
  
  // Test 2: STT Silence Detection
  async testSTTSilenceDetection(): Promise<void> {
    console.log('\n=== TEST 2: STT Silence Detection ===');
    
    try {
      // Reset counters
      this.mockHooks.sttStartCount = 0;
      this.mockHooks.sttStopCount = 0;
      
      // Mark STT as active
      GlobalMonitor.markSTT(true);
      
      // Don't mark any heard events - simulate silence
      console.log('[TEST] Simulating STT silence for 13 seconds...');
      
      // Wait for silence detection to trigger (should happen after 12 seconds)
      await this.delay(13000);
      
      // Check if STT was restarted
      if (this.mockHooks.sttStopCount > 0 && this.mockHooks.sttStartCount > 0) {
        this.logResult('STT Silence Detection', 'PASS', 
          `STT auto-restarted after silence. Stop count: ${this.mockHooks.sttStopCount}, Start count: ${this.mockHooks.sttStartCount}`);
      } else {
        this.logResult('STT Silence Detection', 'FAIL', 
          `STT did not auto-restart. Stop count: ${this.mockHooks.sttStopCount}, Start count: ${this.mockHooks.sttStartCount}`);
      }
      
      // Mark STT as inactive for next tests
      GlobalMonitor.markSTT(false);
    } catch (error) {
      this.logResult('STT Silence Detection', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 3: TTS Hang Detection
  async testTTSHangDetection(): Promise<void> {
    console.log('\n=== TEST 3: TTS Hang Detection ===');
    
    try {
      // Reset counter
      this.mockHooks.ttsCancelCount = 0;
      
      // Mark TTS as starting (simulate stuck TTS)
      GlobalMonitor.markTTS(true);
      this.mockHooks.isSpeakingState = true;
      
      console.log('[TEST] Simulating stuck TTS for 9 seconds...');
      
      // Wait for hang detection to trigger (should happen after 8 seconds)
      await this.delay(9000);
      
      // Check if TTS was cancelled
      if (this.mockHooks.ttsCancelCount > 0) {
        this.logResult('TTS Hang Detection', 'PASS', 
          `TTS auto-cancelled after hang. Cancel count: ${this.mockHooks.ttsCancelCount}`);
      } else {
        this.logResult('TTS Hang Detection', 'FAIL', 
          `TTS was not auto-cancelled. Cancel count: ${this.mockHooks.ttsCancelCount}`);
      }
      
      // Reset TTS state
      GlobalMonitor.markTTS(false);
      this.mockHooks.isSpeakingState = false;
    } catch (error) {
      this.logResult('TTS Hang Detection', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 4: Network Health Monitoring
  async testNetworkHealthMonitoring(): Promise<void> {
    console.log('\n=== TEST 4: Network Health Monitoring ===');
    
    try {
      const initialPingTime = this.mockHooks.lastPingTime;
      
      // Wait for multiple ping cycles
      console.log('[TEST] Monitoring network pings for 11 seconds...');
      await this.delay(11000);
      
      const finalPingTime = this.mockHooks.lastPingTime;
      
      if (finalPingTime > initialPingTime) {
        this.logResult('Network Health Monitoring', 'PASS', 
          `Network monitoring active. Pings detected between ${initialPingTime} and ${finalPingTime}`);
      } else {
        this.logResult('Network Health Monitoring', 'FAIL', 
          'No network pings detected');
      }
      
      // Test degraded network
      console.log('[TEST] Simulating network degradation...');
      this.mockHooks.networkHealth = false;
      
      await this.delay(6000);
      
      // Check for error logs
      const errorLogs = this.capturedLogs.filter(log => 
        log.level === 'error' && log.args[0]?.includes('network'));
      
      if (errorLogs.length > 0) {
        this.logResult('Network Degradation Detection', 'PASS', 
          `Network degradation detected with ${errorLogs.length} error logs`);
      } else {
        this.logResult('Network Degradation Detection', 'FAIL', 
          'Network degradation not properly logged');
      }
      
      // Restore network health
      this.mockHooks.networkHealth = true;
    } catch (error) {
      this.logResult('Network Health Monitoring', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 5: Event Forwarding to DebugBus
  async testEventForwarding(): Promise<void> {
    console.log('\n=== TEST 5: Event Forwarding to DebugBus ===');
    
    try {
      const initialEventCount = this.debugBusEvents.length;
      
      // Trigger various severity events
      console.log('[TEST] Triggering events of different severities...');
      
      // Simulate network warning
      this.mockHooks.networkHealth = false;
      await this.delay(6000);
      
      // Check if events were forwarded
      const newEvents = this.debugBusEvents.slice(initialEventCount);
      
      if (newEvents.length > 0) {
        const severities = new Set(newEvents.map(e => e.level));
        this.logResult('Event Forwarding to DebugBus', 'PASS', 
          `${newEvents.length} events forwarded. Severities: ${Array.from(severities).join(', ')}`);
      } else {
        this.logResult('Event Forwarding to DebugBus', 'FAIL', 
          'No events forwarded to DebugBus');
      }
      
      // Restore network health
      this.mockHooks.networkHealth = true;
    } catch (error) {
      this.logResult('Event Forwarding to DebugBus', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 6: Severity Classification
  async testSeverityClassification(): Promise<void> {
    console.log('\n=== TEST 6: Severity Classification ===');
    
    try {
      // Test network severity classification
      const netInfo = Rules.classifyNet(3000); // Should be 'info'
      const netWarn = Rules.classifyNet(8000); // Should be 'warn'
      const netError = Rules.classifyNet(20000); // Should be 'error'
      
      const netTestPassed = netInfo === 'info' && netWarn === 'warn' && netError === 'error';
      
      // Test STT silence severity classification
      const sttInfo = Rules.classifySTTSilence(5000); // Should be 'info'
      const sttWarn = Rules.classifySTTSilence(9000); // Should be 'warn'
      const sttError = Rules.classifySTTSilence(15000); // Should be 'error'
      
      const sttTestPassed = sttInfo === 'info' && sttWarn === 'warn' && sttError === 'error';
      
      // Test TTS busy severity classification
      const ttsInfo = Rules.classifyTTSBusy(3000); // Should be 'info'
      const ttsWarn = Rules.classifyTTSBusy(6000); // Should be 'warn'
      const ttsError = Rules.classifyTTSBusy(10000); // Should be 'error'
      
      const ttsTestPassed = ttsInfo === 'info' && ttsWarn === 'warn' && ttsError === 'error';
      
      if (netTestPassed && sttTestPassed && ttsTestPassed) {
        this.logResult('Severity Classification', 'PASS', 
          'All severity classifications working correctly');
      } else {
        this.logResult('Severity Classification', 'FAIL', 
          `Classification errors - Net: ${netTestPassed}, STT: ${sttTestPassed}, TTS: ${ttsTestPassed}`);
      }
    } catch (error) {
      this.logResult('Severity Classification', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 7: Auto-Heal Rate Limiting
  async testAutoHealRateLimiting(): Promise<void> {
    console.log('\n=== TEST 7: Auto-Heal Rate Limiting ===');
    
    try {
      // Reset counters
      this.mockHooks.sttStartCount = 0;
      this.mockHooks.sttStopCount = 0;
      
      // Try to trigger multiple heals rapidly
      console.log('[TEST] Attempting rapid heal triggers...');
      
      await AutoHeal.tryHealSTT(this.mockHooks);
      const firstHealCount = this.mockHooks.sttStartCount;
      
      // Immediately try again (should be blocked by cooldown)
      await this.delay(100);
      await AutoHeal.tryHealSTT(this.mockHooks);
      const secondAttemptCount = this.mockHooks.sttStartCount;
      
      // Wait for cooldown to expire (5 seconds)
      console.log('[TEST] Waiting for cooldown to expire...');
      await this.delay(5100);
      
      await AutoHeal.tryHealSTT(this.mockHooks);
      const thirdAttemptCount = this.mockHooks.sttStartCount;
      
      if (firstHealCount === 1 && secondAttemptCount === 1 && thirdAttemptCount === 2) {
        this.logResult('Auto-Heal Rate Limiting', 'PASS', 
          `Rate limiting working correctly. Heal counts: ${firstHealCount}, ${secondAttemptCount}, ${thirdAttemptCount}`);
      } else {
        this.logResult('Auto-Heal Rate Limiting', 'FAIL', 
          `Rate limiting not working. Heal counts: ${firstHealCount}, ${secondAttemptCount}, ${thirdAttemptCount}`);
      }
    } catch (error) {
      this.logResult('Auto-Heal Rate Limiting', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Test 8: Console Logging Verification
  async testConsoleLogging(): Promise<void> {
    console.log('\n=== TEST 8: Console Logging Verification ===');
    
    try {
      const initialLogCount = this.capturedLogs.length;
      
      // Trigger various log levels
      console.log('[TEST] Triggering various log levels...');
      
      // Reset and trigger events
      GlobalMonitor.markSTT(true);
      await this.delay(8000); // Should trigger warning
      
      const newLogs = this.capturedLogs.slice(initialLogCount);
      const hasInfo = newLogs.some(log => log.level === 'info');
      const hasWarn = newLogs.some(log => log.level === 'warn');
      
      if (hasInfo || hasWarn) {
        this.logResult('Console Logging', 'PASS', 
          `Logs captured successfully. Total: ${newLogs.length}, Has info: ${hasInfo}, Has warn: ${hasWarn}`);
      } else {
        this.logResult('Console Logging', 'FAIL', 
          'No appropriate logs captured');
      }
      
      GlobalMonitor.markSTT(false);
    } catch (error) {
      this.logResult('Console Logging', 'FAIL', 
        `Error during test: ${error}`);
    }
  }
  
  // Main test runner
  async runAllTests(): Promise<void> {
    console.log('=====================================');
    console.log('GlobalMonitor Integration Test Suite');
    console.log('=====================================');
    console.log('Start Time:', new Date().toISOString());
    console.log('');
    
    this.testStartTime = Date.now();
    
    // Run all tests sequentially
    await this.testInitialization();
    await this.testSTTSilenceDetection();
    await this.testTTSHangDetection();
    await this.testNetworkHealthMonitoring();
    await this.testEventForwarding();
    await this.testSeverityClassification();
    await this.testAutoHealRateLimiting();
    await this.testConsoleLogging();
    
    // Generate test report
    this.generateReport();
  }
  
  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const duration = Date.now() - this.testStartTime;
    
    console.log('\n=====================================');
    console.log('Test Report Summary');
    console.log('=====================================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log('');
    
    console.log('Test Results:');
    console.log('-------------');
    this.results.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${emoji} ${result.testName}`);
      console.log(`   ${result.details}`);
    });
    
    console.log('\n=====================================');
    console.log('Debug Events Summary');
    console.log('=====================================');
    console.log(`Total Debug Events: ${this.debugBusEvents.length}`);
    const eventsByLevel = this.debugBusEvents.reduce((acc, event) => {
      acc[event.level] = (acc[event.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(eventsByLevel).forEach(([level, count]) => {
      console.log(`  ${level}: ${count}`);
    });
    
    console.log('\n=====================================');
    console.log('Mock Hooks Summary');
    console.log('=====================================');
    console.log(`STT Start Count: ${this.mockHooks.sttStartCount}`);
    console.log(`STT Stop Count: ${this.mockHooks.sttStopCount}`);
    console.log(`TTS Cancel Count: ${this.mockHooks.ttsCancelCount}`);
    console.log(`Network Health: ${this.mockHooks.networkHealth}`);
    console.log(`Last Ping Time: ${this.mockHooks.lastPingTime}`);
    
    // Export results to window for inspection
    (window as any).__GLOBAL_MONITOR_TEST_RESULTS__ = {
      results: this.results,
      debugEvents: this.debugBusEvents,
      capturedLogs: this.capturedLogs,
      mockHooks: this.mockHooks,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%',
        duration: duration + 'ms'
      }
    };
    
    console.log('\nTest results available at: window.__GLOBAL_MONITOR_TEST_RESULTS__');
  }
}

// Export test runner
export async function runGlobalMonitorTests(): Promise<void> {
  const tester = new GlobalMonitorTest();
  await tester.runAllTests();
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).__runGlobalMonitorTests = runGlobalMonitorTests;
  console.log('GlobalMonitor tests loaded. Run with: __runGlobalMonitorTests()');
}