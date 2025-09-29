import { useState, useCallback, useRef, useEffect } from "react";

interface HologramState {
  isRunning: boolean;
  mode: "awakened" | "sentinel";
  size: number;
  speed: number;
  wander: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export function useHologram(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [state, setState] = useState<HologramState>({
    isRunning: true,
    mode: "awakened",
    size: 200,
    speed: 50,
    wander: true,
    position: { x: 100, y: 100 }, // Fixed initial position to avoid window dimension issues
    velocity: { x: 0, y: 0 },
  });

  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());
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
        radius: 0.2 + Math.random() * 0.1,  // Store as percentage of size (0.2-0.3) for better scaling
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
    
    // Draw wireframe sphere (scale with min/max limits)
    const sphereRadius = Math.min(size * 0.35, Math.max(30, size * 0.25));
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
      
      // Scale particle radius based on current size
      const scaledRadius = particle.radius * size;
      const x = centerX + Math.cos(particle.angle) * scaledRadius;
      const y = centerY + Math.sin(particle.angle * 0.7) * scaledRadius * 0.5;
      const depth = Math.sin(particle.angle * 0.5) * 0.5 + 0.5;
      
      const particleColor = mode === "awakened" 
        ? `rgba(255, 220, 100, ${depth * 0.8})`
        : `rgba(255, 120, 60, ${depth * 0.8})`;
      
      ctx.fillStyle = particleColor;
      ctx.beginPath();
      ctx.arc(x, y, 1 + depth * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Central core (scale with minimum size for visibility)
    const baseCoreRadius = Math.max(8, size * 0.06);  // Minimum 8px, otherwise 6% of size
    const coreRadius = baseCoreRadius + Math.sin(time * 0.003) * 3;
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

  const updateWanderingMovement = useCallback(() => {
    if (!state.wander) return;

    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 0.03); // Convert to seconds, cap at 30ms for smoother updates
    lastUpdateRef.current = now;

    setState(prev => {
      const { position, velocity } = prev;
      
      // Add some randomness to velocity
      const maxSpeed = 80; // pixels per second (increased for faster movement)
      const acceleration = 40; // pixels per second squared (increased for smoother response)
      
      // Add random acceleration
      const newVelX = velocity.x + (Math.random() - 0.5) * acceleration * deltaTime;
      const newVelY = velocity.y + (Math.random() - 0.5) * acceleration * deltaTime;
      
      // Limit velocity
      const limitedVelX = Math.max(-maxSpeed, Math.min(maxSpeed, newVelX));
      const limitedVelY = Math.max(-maxSpeed, Math.min(maxSpeed, newVelY));
      
      // Update position
      let newX = position.x + limitedVelX * deltaTime;
      let newY = position.y + limitedVelY * deltaTime;
      
      // Bounce off screen edges
      const margin = 50;
      const maxX = window.innerWidth - prev.size - margin;
      const maxY = window.innerHeight - prev.size - margin;
      
      let bounceVelX = limitedVelX;
      let bounceVelY = limitedVelY;
      
      if (newX < margin) {
        newX = margin;
        bounceVelX = Math.abs(limitedVelX);
      } else if (newX > maxX) {
        newX = maxX;
        bounceVelX = -Math.abs(limitedVelX);
      }
      
      if (newY < margin) {
        newY = margin;
        bounceVelY = Math.abs(limitedVelY);
      } else if (newY > maxY) {
        newY = maxY;
        bounceVelY = -Math.abs(limitedVelY);
      }
      
      return {
        ...prev,
        position: { x: newX, y: newY },
        velocity: { x: bounceVelX, y: bounceVelY }
      };
    });
  }, [state.wander]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.isRunning) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    // Update wandering movement
    updateWanderingMovement();
    
    const time = Date.now();
    drawHologram(ctx, time);
    
    animationRef.current = requestAnimationFrame(animate);
  }, [state.isRunning, drawHologram, canvasRef, updateWanderingMovement]);

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
    if (wander) {
      // Reset deltaTime reference to prevent large initial jump
      lastUpdateRef.current = Date.now();
    }
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setState(prev => ({ 
      ...prev, 
      position: { x, y },
      velocity: { x: 0, y: 0 } // Reset velocity when manually positioning
    }));
  }, []);

  // Start/stop animation based on isRunning state
  useEffect(() => {
    if (state.isRunning) {
      // Delay to avoid immediate re-creation of animate function
      const timeoutId = setTimeout(() => {
        animate();
      }, 10);
      return () => {
        clearTimeout(timeoutId);
        cancelAnimationFrame(animationRef.current);
      };
    } else {
      cancelAnimationFrame(animationRef.current);
    }
  }, [state.isRunning]);

  return {
    ...state,
    initializeHologram,
    toggleVisibility,
    updateMode,
    updateSize,
    updateSpeed,
    updateWander,
    updatePosition,
  };
}
