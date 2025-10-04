import { SystemDiagnostics } from './SystemDiagnostics';
import { X } from 'lucide-react';

interface DiagnosticsDashboardProps {
  onClose: () => void;
}

export function DiagnosticsDashboard({ onClose }: DiagnosticsDashboardProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative max-w-4xl w-full max-h-[80vh] overflow-auto bg-gray-900 rounded-xl border border-white/20">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors z-10"
          aria-label="Close diagnostics"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">System Diagnostics</h2>
          <SystemDiagnostics />
        </div>
      </div>
    </div>
  );
}