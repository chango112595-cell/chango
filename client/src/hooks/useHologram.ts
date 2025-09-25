import { useState, useCallback, useRef, useEffect } from "react";

interface HologramState {
  isRunning: boolean;
  mode: "awakened" | "sentinel";
  size: number;
  speed: number;
  wander: boolean;
}

export function useHologram(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [state, setState] = useState<HologramState>({
    isRunning: false,
    mode: "awakened",
    size: 200,
    speed: 50,
    wander: false,
  });

  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    z: number;
    angle: number;
    speed: number;
    radius: number;
  }>>([]);

  const initializeParticles = useCallback(() => {
    const particles = [];
    const particleCount = 100;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: 0,
        y: 0,
        z: 0,
        angle: (Math.PI * 2 * i) / particleCount,
        speed: 0.01 + Math.random() * 0.02,
        radius: 80 + Math.random() * 40,
      });
    }
    
    particlesRef.current = particles;
  }, []);

  const drawHologram = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const { size, mode, speed } = state;
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(0, 10, 20, 0.1)';
    ctx.fillRect(0, 0, size, size);
    
    // Draw wireframe sphere
    const sphereRadius = size * 0.3;
    const rotationSpeed = (speed / 100) * 0.02;
    
    // Meridians
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * rotationSpeed;
      
      ctx.strokeStyle = mode === "awakened" 
        ? `rgba(255, 220, 100, ${0.3 + Math.sin(time * 0.001) * 0.2})`
        : `rgba(255, 120, 60, ${0.3 + Math.sin(time * 0.001) * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let j = 0; j <= 20; j++) {
        const lat = (j / 20 - 0.5) * Math.PI;
        const x = centerX + Math.cos(lat) * Math.cos(angle) * sphereRadius;
        const y = centerY + Math.sin(lat) * sphereRadius;
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Parallels
    for (let i = 1; i < 6; i++) {
      const lat = (i / 6 - 0.5) * Math.PI;
      const radius = Math.cos(lat) * sphereRadius;
      
      ctx.strokeStyle = mode === "awakened"
        ? `rgba(60, 255, 170, ${0.2 + Math.sin(time * 0.001 + i) * 0.1})`
        : `rgba(255, 80, 40, ${0.2 + Math.sin(time * 0.001 + i) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY + Math.sin(lat) * sphereRadius, Math.abs(radius), 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw particles
    particlesRef.current.forEach((particle) => {
      particle.angle += particle.speed * (speed / 100);
      
      const x = centerX + Math.cos(particle.angle) * particle.radius;
      const y = centerY + Math.sin(particle.angle * 0.7) * particle.radius * 0.5;
      const depth = Math.sin(particle.angle * 0.5) * 0.5 + 0.5;
      
      const particleColor = mode === "awakened" 
        ? `rgba(255, 220, 100, ${depth * 0.8})`
        : `rgba(255, 120, 60, ${depth * 0.8})`;
      
      ctx.fillStyle = particleColor;
      ctx.beginPath();
      ctx.arc(x, y, 1 + depth * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Central core
    const coreRadius = 8 + Math.sin(time * 0.003) * 3;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
    
    if (mode === "awakened") {
      gradient.addColorStop(0, 'rgba(255, 220, 100, 1)');
      gradient.addColorStop(0.7, 'rgba(60, 255, 170, 0.8)');
      gradient.addColorStop(1, 'rgba(60, 255, 170, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 120, 60, 1)');
      gradient.addColorStop(0.7, 'rgba(255, 80, 40, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 80, 40, 0)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    
  }, [state]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.isRunning) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const time = Date.now();
    drawHologram(ctx, time);
    
    animationRef.current = requestAnimationFrame(animate);
  }, [state.isRunning, drawHologram, canvasRef]);

  const initializeHologram = useCallback(() => {
    initializeParticles();
  }, [initializeParticles]);

  const toggleVisibility = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const updateMode = useCallback((mode: "awakened" | "sentinel") => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const updateSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, size }));
    
    // Update canvas dimensions
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
    }
  }, [canvasRef]);

  const updateSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const updateWander = useCallback((wander: boolean) => {
    setState(prev => ({ ...prev, wander }));
  }, []);

  // Start/stop animation based on isRunning state
  useEffect(() => {
    if (state.isRunning) {
      animate();
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => cancelAnimationFrame(animationRef.current);
  }, [state.isRunning, animate]);

  return {
    ...state,
    initializeHologram,
    toggleVisibility,
    updateMode,
    updateSize,
    updateSpeed,
    updateWander,
  };
}
