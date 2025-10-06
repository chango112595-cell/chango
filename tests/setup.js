// Why: stable Math.random in tests for reproducibility.
const origRandom = Math.random;
let seed = 42;
Math.random = () => {
  // xorshift32
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return ((seed >>> 0) % 1000) / 1000;
};