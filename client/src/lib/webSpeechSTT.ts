// Simple STT using Web Speech API
export class WebSpeechSTT {
  private rec: any;
  supported: boolean;
  private _onfinal: ((text: string) => void) | null = null;
  private _onerror: ((error: any) => void) | null = null;
  
  constructor() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.supported = !!SR;
    if (!this.supported) return;
    
    this.rec = new SR();
    this.rec.continuous = false;
    this.rec.interimResults = false;
    this.rec.maxAlternatives = 1;
    
    this.rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      this._onfinal && this._onfinal(t);
    };
    
    this.rec.onerror = (e: any) => this._onerror && this._onerror(e);
  }
  
  setLangFromAccent(accent: string = 'en-US') { 
    if(this.supported) this.rec.lang = accent; 
  }
  
  onfinal(fn: (text: string) => void) { 
    this._onfinal = fn; 
  }
  
  onerror(fn: (error: any) => void) { 
    this._onerror = fn; 
  }
  
  start() { 
    try { 
      this.supported && this.rec.start(); 
    } catch {} 
  }
  
  stop() { 
    try { 
      this.supported && this.rec.stop(); 
    } catch {} 
  }
}