import { EventBus } from "../client/src/chango/core/eventBus.js";
test("event bus on/emit/off", () => {
  const bus = new EventBus(); let called = 0;
  const off = bus.on("x", (p) => { called += p; });
  bus.emit("x", 2); expect(called).toBe(2);
  off(); bus.emit("x", 3); expect(called).toBe(2);
});