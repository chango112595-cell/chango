// Device auto-adapt: chooses sensible defaults per environment.
export const device = (() => {
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isCar = /Android Auto|CarPlay/i.test(ua) || (window.navigator?.userAgentData?.platform || "").includes("Automotive");
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const sampleRateHint = (isCar || isMobile) ? 44100 : 48000;
  const micConstraints = isCar
    ? { autoGainControl: true, echoCancellation: true, noiseSuppression: true }
    : isMobile
      ? { autoGainControl: false, echoCancellation: true, noiseSuppression: true, highpassFilter: true }
      : { autoGainControl: false, echoCancellation: true, noiseSuppression: true };
  return { isMobile, isCar, prefersReducedMotion, touch, sampleRateHint, micConstraints };
})();