// Chango AI Hologram Visualization - 3D Wire Sphere with Particles
(function(global){
  const state = {
    visible: false,
    mode: 'awakened', // 'awakened' or 'sentinel'
    size: 320,
    speed: 0.8,
    wander: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isDragging: false,
    frame: 0,
    particles: []
  };

  // Initialize particles
  function initParticles() {
    state.particles = [];
    const count = 50;
    for(let i = 0; i < count; i++) {
      state.particles.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.random() * Math.PI,
        radius: 0.8 + Math.random() * 0.4,
        speed: 0.5 + Math.random() * 0.5,
        opacity: 0.3 + Math.random() * 0.7,
        size: 2 + Math.random() * 3
      });
    }
  }

  // Show hologram
  function show() {
    const root = document.getElementById('holoRoot');
    if(!root) return;
    root.classList.remove('hidden');
    state.visible = true;
    if(state.particles.length === 0) initParticles();
    animate();
  }

  // Hide hologram
  function hide() {
    const root = document.getElementById('holoRoot');
    if(!root) return;
    root.classList.add('hidden');
    state.visible = false;
  }

  // Set size
  function setSize(size) {
    state.size = parseInt(size) || 320;
    const canvas = document.getElementById('holoCanvas');
    if(canvas) {
      canvas.width = state.size * 2;
      canvas.height = state.size * 2;
      canvas.style.width = state.size + 'px';
      canvas.style.height = state.size + 'px';
    }
  }

  // Set speed
  function setSpeed(speed) {
    state.speed = parseFloat(speed) || 0.8;
  }

  // Set mode
  function setMode(mode) {
    state.mode = mode || 'awakened';
    const root = document.getElementById('holoRoot');
    if(root) {
      root.classList.remove('holo-mode-sentinel', 'holo-mode-awakened');
      root.classList.add('holo-mode-' + state.mode);
    }
  }

  // Draw sphere wireframe
  function drawSphere(ctx, cx, cy, radius, rotation) {
    ctx.save();
    
    // Rotate perspective
    const latLines = 12;
    const lonLines = 16;
    
    // Latitude lines (horizontal circles)
    for(let lat = 0; lat < latLines; lat++) {
      ctx.beginPath();
      const theta = (lat / latLines) * Math.PI;
      const circleRadius = Math.sin(theta) * radius;
      const y = Math.cos(theta) * radius;
      
      for(let lon = 0; lon <= 32; lon++) {
        const phi = (lon / 32) * Math.PI * 2 + rotation;
        const x = Math.cos(phi) * circleRadius;
        const z = Math.sin(phi) * circleRadius;
        
        // Simple 3D projection
        const scale = 1 / (1 + z / (radius * 2));
        const px = cx + x * scale;
        const py = cy + y * scale;
        
        if(lon === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      
      ctx.strokeStyle = state.mode === 'sentinel' ? 
        `rgba(255, 100, 50, ${0.3 + lat * 0.02})` : 
        `rgba(100, 255, 200, ${0.3 + lat * 0.02})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    
    // Longitude lines (vertical circles)
    for(let lon = 0; lon < lonLines; lon++) {
      ctx.beginPath();
      const basePhi = (lon / lonLines) * Math.PI * 2;
      
      for(let lat = 0; lat <= 32; lat++) {
        const theta = (lat / 32) * Math.PI;
        const y = Math.cos(theta) * radius;
        const circleRadius = Math.sin(theta) * radius;
        const phi = basePhi + rotation;
        const x = Math.cos(phi) * circleRadius;
        const z = Math.sin(phi) * circleRadius;
        
        const scale = 1 / (1 + z / (radius * 2));
        const px = cx + x * scale;
        const py = cy + y * scale;
        
        if(lat === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      
      ctx.strokeStyle = state.mode === 'sentinel' ? 
        `rgba(255, 180, 50, ${0.25 + lon * 0.015})` : 
        `rgba(255, 220, 100, ${0.25 + lon * 0.015})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Draw particles
  function drawParticles(ctx, cx, cy, radius, rotation) {
    state.particles.forEach((p, i) => {
      // Update particle position
      p.theta += p.speed * 0.01;
      p.phi += p.speed * 0.005;
      
      // Calculate 3D position
      const x = Math.sin(p.phi) * Math.cos(p.theta) * radius * p.radius;
      const y = Math.cos(p.phi) * radius * p.radius;
      const z = Math.sin(p.phi) * Math.sin(p.theta) * radius * p.radius;
      
      // Apply rotation
      const rotX = x * Math.cos(rotation) - z * Math.sin(rotation);
      const rotZ = x * Math.sin(rotation) + z * Math.cos(rotation);
      
      // Simple 3D projection
      const scale = 1 / (1 + rotZ / (radius * 2));
      const px = cx + rotX * scale;
      const py = cy + y * scale;
      
      // Draw particle
      ctx.beginPath();
      ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
      
      const color = state.mode === 'sentinel' ? 
        `rgba(255, 150, 50, ${p.opacity * scale})` : 
        `rgba(150, 255, 200, ${p.opacity * scale})`;
      ctx.fillStyle = color;
      ctx.fill();
      
      // Add glow
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // Animation loop
  function animate() {
    if(!state.visible) return;
    
    const canvas = document.getElementById('holoCanvas');
    const ctx = canvas?.getContext('2d');
    if(!canvas || !ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate center position with wander
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;
    
    if(state.wander && !state.isDragging) {
      cx += Math.sin(state.frame * 0.002) * 30;
      cy += Math.cos(state.frame * 0.003) * 20;
    }
    
    // Add drag offset
    cx += state.dragOffsetX;
    cy += state.dragOffsetY;
    
    // Calculate rotation
    const rotation = state.frame * state.speed * 0.01;
    
    // Draw sphere and particles
    const radius = state.size * 0.8;
    drawSphere(ctx, cx, cy, radius, rotation);
    drawParticles(ctx, cx, cy, radius, rotation);
    
    // Update frame counter
    state.frame++;
    
    // Continue animation
    requestAnimationFrame(animate);
  }

  // Setup drag handling
  function setupDrag() {
    const wrap = document.getElementById('holoWrap');
    if(!wrap) return;
    
    let startX = 0, startY = 0;
    let initialOffsetX = 0, initialOffsetY = 0;
    
    wrap.addEventListener('mousedown', (e) => {
      state.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialOffsetX = state.dragOffsetX;
      initialOffsetY = state.dragOffsetY;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if(!state.isDragging) return;
      state.dragOffsetX = initialOffsetX + (e.clientX - startX);
      state.dragOffsetY = initialOffsetY + (e.clientY - startY);
    });
    
    document.addEventListener('mouseup', () => {
      state.isDragging = false;
    });
    
    // Touch support
    wrap.addEventListener('touchstart', (e) => {
      if(e.touches.length === 1) {
        state.isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialOffsetX = state.dragOffsetX;
        initialOffsetY = state.dragOffsetY;
        e.preventDefault();
      }
    });
    
    document.addEventListener('touchmove', (e) => {
      if(!state.isDragging || e.touches.length !== 1) return;
      state.dragOffsetX = initialOffsetX + (e.touches[0].clientX - startX);
      state.dragOffsetY = initialOffsetY + (e.touches[0].clientY - startY);
    });
    
    document.addEventListener('touchend', () => {
      state.isDragging = false;
    });
  }

  // Initialize on DOM ready
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDrag);
  } else {
    setupDrag();
  }

  // Export API
  global.ChangoHolo = {
    show,
    hide,
    setSize,
    setSpeed,
    setMode,
    state
  };
})(window);