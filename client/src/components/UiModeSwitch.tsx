import { useUIMode } from "../hooks/useUIMode";

export function UiModeSwitch() {
  const { mode, setMode } = useUIMode();

  return (
    <div className="fixed right-4 top-4 flex items-center gap-1 rounded-lg bg-gray-900/80 backdrop-blur-sm p-1 z-50">
      <span className="text-xs text-gray-400 px-2">UI</span>
      <button
        data-testid="button-mode-header"
        onClick={() => setMode("header")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          mode === "header"
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500"
            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
        }`}
      >
        Header
      </button>
      <button
        data-testid="button-mode-sphere"
        onClick={() => setMode("sphere")}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          mode === "sphere"
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500"
            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
        }`}
      >
        Sphere
      </button>
    </div>
  );
}