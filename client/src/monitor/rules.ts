export type Severity = 'info' | 'warn' | 'error' | 'critical';

export const Rules = {
  windows: { net: 15000, sttSilence: 12000, ttsHang: 8000 },

  classifyNet(msSinceLastOk: number) {
    if (msSinceLastOk < 5000) return 'info';
    if (msSinceLastOk < 15000) return 'warn';
    return 'error';
  },

  classifySTTSilence(ms: number) {
    if (ms < 7000) return 'info';
    if (ms < 12000) return 'warn';
    return 'error';
  },

  classifyTTSBusy(ms: number) {
    if (ms < 4000) return 'info';
    if (ms < 8000) return 'warn';
    return 'error';
  }
} as const;