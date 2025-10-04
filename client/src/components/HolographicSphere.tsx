import { HologramSphere } from './HologramSphere';

interface HolographicSphereProps {
  state?: 'idle' | 'listening' | 'speaking' | 'error';
}

export function HolographicSphere({ state = 'idle' }: HolographicSphereProps = {}) {
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-10">
      <HologramSphere state={state} />
    </div>
  );
}