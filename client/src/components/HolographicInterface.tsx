import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useHologram } from "@/hooks/useHologram";

type HologramMode = "awakened" | "sentinel";

export default function HolographicInterface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [mode, setMode] = useState<HologramMode>("awakened");
  const [size, setSize] = useState([200]);
  const [speed, setSpeed] = useState([50]);
  const [wander, setWander] = useState(true);

  const { 
    initializeHologram, 
    toggleVisibility, 
    updateMode, 
    updateSize, 
    updateSpeed, 
    updateWander,
    updatePosition,
    position,
    isRunning 
  } = useHologram(canvasRef);

  useEffect(() => {
    initializeHologram();
  }, [initializeHologram]);

  const handleToggle = () => {
    setIsVisible(!isVisible);
    toggleVisibility();
  };

  const handleModeChange = (newMode: HologramMode) => {
    setMode(newMode);
    updateMode(newMode);
  };

  const handleSizeChange = (value: number[]) => {
    setSize(value);
    updateSize(value[0]);
  };

  const handleSpeedChange = (value: number[]) => {
    setSpeed(value);
    updateSpeed(value[0]);
  };

  const handleWanderChange = (checked: boolean) => {
    setWander(checked);
    updateWander(checked);
  };

  return (
    <>
      {/* Floating Hologram - appears when wandering is enabled */}
      {isVisible && wander && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            left: `${position.x}px`, 
            top: `${position.y}px`,
            width: `${size[0]}px`,
            height: `${size[0]}px`
          }}
          data-testid="floating-hologram"
        >
          <div className={`hologram-canvas ${
            mode === "awakened" ? "hologram-awakened" : "hologram-sentinel"
          } flex items-center justify-center transition-all duration-500 relative`}
          style={{ 
            width: `${size[0]}px`, 
            height: `${size[0]}px`,
            backgroundSize: `${size[0] * 0.8}px ${size[0] * 0.8}px`,
            backgroundPosition: 'center'
          }}>
            
            {/* Floating Canvas */}
            <canvas 
              ref={canvasRef}
              width={size[0]} 
              height={size[0]}
              className="absolute inset-0"
              data-testid="canvas-hologram-floating"
            />
            
            {/* Floating Particles */}
            <div className="particle" style={{ top: '20%', left: '30%', animationDelay: '0s' }}></div>
            <div className="particle" style={{ top: '60%', left: '70%', animationDelay: '1s' }}></div>
            <div className="particle" style={{ top: '40%', left: '20%', animationDelay: '2s' }}></div>
            <div className="particle" style={{ top: '80%', left: '50%', animationDelay: '1.5s' }}></div>
            
            {/* Floating Central core */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-primary animate-hologram-pulse"></div>
            
            {/* Floating Status Chip */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-muted/80 rounded-full text-xs backdrop-blur-sm">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-green-400' : 'bg-red-400'}`}></span>
              {mode === "awakened" ? "CHANGO • ONLINE" : "SENTINEL • OFFLINE"}
            </div>
          </div>
        </div>
      )}

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Holographic Interface</CardTitle>
          <Button 
            onClick={handleToggle}
            variant="secondary"
            size="sm"
            data-testid="button-hologram-toggle"
          >
            {isVisible ? "Hide" : "Toggle"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hologram Display - Only show in dock when not wandering */}
        {!wander && (
          <div className="relative flex justify-center mb-6">
            <div className={`hologram-canvas ${
              mode === "awakened" ? "hologram-awakened" : "hologram-sentinel"
            } flex items-center justify-center transition-all duration-500`} 
            style={{ 
              width: `${size[0]}px`, 
              height: `${size[0]}px`,
              backgroundSize: `${size[0] * 0.8}px ${size[0] * 0.8}px`,
              backgroundPosition: 'center'
            }}>
              
              {/* Canvas for 3D rendering */}
              <canvas 
                ref={canvasRef}
                width={size[0]} 
                height={size[0]}
                className="absolute inset-0"
                style={{ display: isVisible ? 'block' : 'none' }}
                data-testid="canvas-hologram"
              />
              
              {/* Animated particles */}
              {isVisible && (
                <>
                  <div className="particle" style={{ top: '20%', left: '30%', animationDelay: '0s' }}></div>
                  <div className="particle" style={{ top: '60%', left: '70%', animationDelay: '1s' }}></div>
                  <div className="particle" style={{ top: '40%', left: '20%', animationDelay: '2s' }}></div>
                  <div className="particle" style={{ top: '80%', left: '50%', animationDelay: '1.5s' }}></div>
                </>
              )}
              
              {/* Central core */}
              {isVisible && (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent to-primary animate-hologram-pulse"></div>
              )}
            </div>
          </div>
        )}
        
        {/* Placeholder message when wandering */}
        {wander && (
          <div className="relative flex justify-center mb-6 items-center" style={{ height: `${size[0]}px` }}>
            <div className="text-center text-muted-foreground">
              <div className="mb-2">✨ Chango is wandering</div>
              <div className="text-xs">Disable "Wander" to dock the hologram</div>
            </div>
          </div>
        )}

        {/* Hologram Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hologram-mode">Mode</Label>
            <Select value={mode} onValueChange={handleModeChange} data-testid="select-hologram-mode">
              <SelectTrigger id="hologram-mode" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awakened">Awakened</SelectItem>
                <SelectItem value="sentinel">Sentinel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Size</span>
              <Slider
                min={100}
                max={300}
                step={10}
                value={size}
                onValueChange={handleSizeChange}
                className="w-32"
                data-testid="slider-hologram-size"
              />
              <span className="w-8 text-right">{size[0]}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>Speed</span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={speed}
                onValueChange={handleSpeedChange}
                className="w-32"
                data-testid="slider-hologram-speed"
              />
              <span className="w-8 text-right">{speed[0]}%</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="hologram-wander">Wander</Label>
              <Checkbox
                id="hologram-wander"
                checked={wander}
                onCheckedChange={handleWanderChange}
                data-testid="checkbox-hologram-wander"
              />
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-muted/30 rounded-full text-sm">
              <span className={`status-indicator ${isRunning ? 'status-online' : 'status-offline'}`}></span>
              <span data-testid="text-hologram-status">
                {mode === "awakened" ? "CHANGO • ONLINE" : "SENTINEL • OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
