import { useEffect } from 'react';
export function useViewportVh() {
  useEffect(() => {
    const set = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--vhpx', `${vh}px`);
    };
    set();
    window.addEventListener('resize', set);
    window.visualViewport?.addEventListener('resize', set);
    return () => {
      window.removeEventListener('resize', set);
      window.visualViewport?.removeEventListener?.('resize', set);
    };
  }, []);
}