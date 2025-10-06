import { accentize } from "../client/src/chango/accent/engine.js";
test("accentize scales duration/gain and maps vowels", () => {
  const seq = [{ ph:"ae", dur:1, gain:1 }];
  const out = accentize(seq, "uk_rp");
  expect(out[0].ph).not.toBe("ae"); // vowel mapped
  expect(out[0].dur).toBeCloseTo(1.05, 2);
});