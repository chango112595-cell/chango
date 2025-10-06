import { wordsToPhones, toTimeline } from "../client/src/chango/tts/g2p.js";
test("wordsToPhones inserts pauses for boundaries", () => {
  const plan = [{ word:"hello", boundary:"none" }, { word:"world", boundary:"L%" }];
  const seq = wordsToPhones(plan);
  const last = seq.at(-1);
  expect(last.ph).toBe("pau");
  const phs = seq.filter(p => p.ph !== "pau").map(p => p.ph);
  expect(phs.join(" ")).toMatch(/h eh l ow/);
});
test("toTimeline scales durations", () => {
  const tl = toTimeline([{ ph:"eh", dur:2 }, { ph:"pau", dur:0.5 }]);
  expect(tl[0].dur).toBeCloseTo(0.16, 3);
  expect(tl[1].ph).toBe("pau");
});