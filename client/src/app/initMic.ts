export async function ensureMicPermission(){
  try{
    const st = await (navigator as any).permissions?.query?.({name: 'microphone' as PermissionName});
    if(st && st.state !== 'granted'){
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }
      });
      s.getTracks().forEach(t=> t.stop());
    }
  }catch{/* safari/ios safe no-op */}
}