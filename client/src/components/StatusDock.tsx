import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, Cpu, Radio, Power, Settings } from "lucide-react";
import { SettingsModal } from "./SettingsModal";

type Props = {
  systemOnline: boolean;
  speaking: boolean;
  muted: boolean;
  onToggleMute: () => void;
};

export default function StatusDock({ systemOnline, speaking, muted, onToggleMute }: Props) {
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // lightweight ping – replace with your real /health if you have one
  useEffect(() => {
    let cancel = false;
    const ping = async () => {
      const t0 = performance.now();
      try { await fetch("/api/diagnostics/ping", { cache: "no-store" }); }
      catch {}
      if (!cancel) setLatencyMs(Math.max(1, Math.round(performance.now() - t0)));
    };
    ping();
    const id = setInterval(ping, 6000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  const dot = useMemo(() => systemOnline ? "bg-emerald-400" : "bg-rose-500", [systemOnline]);

  return (
    <>
    <div className="fixed top-3 left-1/2 z-30 -translate-x-1/2">
      {/* holographic pill */}
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-full blur-md opacity-60 bg-gradient-to-r from-emerald-400/40 via-cyan-400/40 to-indigo-400/40 group-hover:opacity-90 transition" />
        <div className="relative flex items-center gap-4 rounded-full px-5 py-2.5
                        bg-black/40 backdrop-blur-md ring-1 ring-white/10 text-white">
          {/* ID / name */}
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full shadow ${dot}`} />
            <span className="font-semibold tracking-wide">Lolo AI</span>
            <span className="text-xs opacity-70">v-current</span>
          </div>

          {/* live stats */}
          <div className="hidden sm:flex items-center gap-4 text-xs opacity-90">
            <span className="flex items-center gap-1"><Radio className="h-3.5 w-3.5" />{systemOnline ? "Online" : "Offline"}</span>
            <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" />{speaking ? "Synthesizing" : "Idle"}</span>
            <span className="flex items-center gap-1">RTT {latencyMs ?? "—"}ms</span>
          </div>

          {/* actions */}
          <button
            onClick={onToggleMute}
            title={muted ? "Enable microphone" : "Mute microphone"}
            className={`ml-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs 
              ${muted ? "bg-rose-600/80 hover:bg-rose-600" : "bg-emerald-600/80 hover:bg-emerald-600"} transition`}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {muted ? "Muted" : "Listening"}
          </button>

          {/* settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Open settings"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs bg-cyan-600/20 hover:bg-cyan-600/40 transition"
            data-testid="button-open-settings-dock">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* power indicator (read-only) */}
          <div className="hidden sm:flex items-center gap-1 text-xs opacity-80">
            <Power className={`h-3.5 w-3.5 ${systemOnline ? "text-emerald-400" : "text-rose-500"}`} />
          </div>
        </div>
      </div>
    </div>
    
    {/* Settings Modal */}
    <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
  </>
  );
}