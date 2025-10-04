import { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, AlertCircle } from 'lucide-react';
import { DebugBus } from '@/debug/DebugBus';

export function VoiceSecurityUI() {
  const [isSecure, setIsSecure] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Listen for gate events
    const unsubscribe = DebugBus.on((event) => {
      if (event.tag === 'Gate') {
        if (event.msg?.includes('pass')) {
          setIsSecure(true);
        } else if (event.msg?.includes('reject') || event.level === 'error') {
          setShowAlert(true);
          setTimeout(() => setShowAlert(false), 3000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      {/* Security status indicator */}
      <div className="fixed top-4 left-4 flex items-center gap-2 p-3 rounded-lg bg-black/50 backdrop-blur-sm border border-white/20 z-50">
        <Shield className={`w-5 h-5 ${isSecure ? 'text-green-400' : 'text-yellow-400'}`} />
        <span className="text-sm text-white/80">
          Wake word: <span className="font-mono text-blue-400">lolo</span>
        </span>
        {wakeWordEnabled ? (
          <Lock className="w-4 h-4 text-green-400" />
        ) : (
          <Unlock className="w-4 h-4 text-yellow-400" />
        )}
      </div>

      {/* Alert notification */}
      {showAlert && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/90 text-white">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">Wake word "lolo" required</span>
          </div>
        </div>
      )}

      {/* Add animation styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}