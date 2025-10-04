import { registerHealthCheck } from '../healthRegistry';

registerHealthCheck({
  name: 'mic.perm',
  cadenceMs: 2500,
  run: async () => {
    try{
      const st = await (navigator as any).permissions?.query?.({name:'microphone' as PermissionName});
      if(st && st.state!=='granted'){
        return {
          ok:false,
          event:{ id:'mic.permission.denied', domain:'mic', severity:'error', msg:'Microphone permission missing', fixable:true },
          fix: async () => {
            try{
              const s = await navigator.mediaDevices.getUserMedia({audio:true});
              s.getTracks().forEach(t=>t.stop());
              return true;
            }catch{ return false; }
          }
        };
      }
      return { ok:true };
    }catch{ return { ok:true }; }
  }
});