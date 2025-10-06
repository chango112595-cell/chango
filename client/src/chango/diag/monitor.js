import { bus } from "../core/eventBus.js";
export class Monitor {
  constructor({ level="warn" }={}){ this.level=level; this.buffer=[]; this.limit=400; this._wire(); }
  _wire(){
    bus.on("diag:error", e=>this._push("error",e));
    bus.on("diag:warn",  e=>this._push("warn",e));
    bus.on("diag:info",  e=>this._push("info",e));
    bus.on("diag:state", e=>this._push("info",e));
  }
  _push(level, data){ this.buffer.push({t:Date.now(),level,data}); if(this.buffer.length>this.limit) this.buffer.shift(); }
  latest(n=50){ return this.buffer.slice(-n); }
}
export const monitor = new Monitor();