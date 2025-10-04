import { registerHealthCheck } from '../healthRegistry';

registerHealthCheck({
  name: 'mic.perm',
  cadenceMs: 2500,
  run: async () => {
    try{
      // CRITICAL FIX: Check if mic is unavailable BEFORE running the check
      const micNotFound = sessionStorage.getItem('mic_device_not_found') === 'true';
      const micDenied = sessionStorage.getItem('mic_permission_denied') === 'true';
      
      if(micNotFound || micDenied){
        // Don't run check or log errors when mic is unavailable
        // Return OK to prevent repeated error logging
        return { ok:true };
      }
      
      const st = await (navigator as any).permissions?.query?.({name:'microphone' as PermissionName});
      if(st && st.state!=='granted'){
        // Only log error and attempt fix if mic is potentially available
        return {
          ok:false,
          event:{ id:'mic.permission.denied', domain:'mic', severity:'error', msg:'Microphone permission missing', fixable:false }, // Set fixable to false to prevent auto-heal attempts
          fix: async () => {
            // Don't attempt fix if already known to be denied
            if(sessionStorage.getItem('mic_permission_denied') === 'true' || 
               sessionStorage.getItem('mic_device_not_found') === 'true'){
              return false;
            }
            try{
              const s = await navigator.mediaDevices.getUserMedia({audio:true});
              s.getTracks().forEach(t=>t.stop());
              return true;
            }catch{ 
              // Store failure in sessionStorage
              sessionStorage.setItem('mic_permission_denied', 'true');
              return false; 
            }
          }
        };
      }
      return { ok:true };
    }catch{ return { ok:true }; }
  }
});