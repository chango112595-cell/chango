// Simple event-loop lag sampler for performance monitoring
let last = Date.now();
let lagMs = 0;

// Sample event loop lag every 100ms
setInterval(() => {
  const now = Date.now();
  const drift = now - last - 100;
  lagMs = Math.max(0, drift);
  last = now;
}, 100);

export function getLag(): number {
  return lagMs;
}

// Session counters (reset on server restart)
export const sessionCounters = {
  start: Date.now(),
  ttsClientUtterances: 0,
  profilesLearned: 0,
  checkpointsMade: 0,
};

export function incrementCounter(key: keyof typeof sessionCounters): void {
  if (key !== 'start' && key in sessionCounters) {
    (sessionCounters[key] as number) += 1;
  }
}