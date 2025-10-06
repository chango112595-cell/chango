import { prosodyPlan } from "../client/src/chango/tts/prosody.js";
test("prosodyPlan splits phrases and marks end boundary", () => {
  const out = prosodyPlan("Hello world?");
  expect(out.at(-1).boundary).toBe("H%");
});
test("prosodyPlan marks ip boundaries internally", () => {
  const out = prosodyPlan("a b c d e f");
  const ips = out.filter(x => x.boundary === "ip").length;
  expect(ips).toBeGreaterThan(0);
});