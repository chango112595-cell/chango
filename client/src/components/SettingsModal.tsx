/**
 * Settings Modal Component
 * Houses all application settings including voice security, preferences, and configurations
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SecurityPanel } from '@/components/settings/SecurityPanel';
import { Settings, Shield, Volume2, Info, Palette } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeProvider';

interface SettingsModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsModal({ trigger, open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('security');
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 bg-background/95 backdrop-blur-xl border border-cyan-500/20">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-400">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure your Lolo AI experience, voice security, and system preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full justify-start px-6 bg-background/50 border-b border-cyan-500/20 rounded-none">
            <TabsTrigger 
              value="security" 
              className="flex items-center gap-2 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
            >
              <Shield className="h-4 w-4" />
              Voice Security
            </TabsTrigger>
            <TabsTrigger 
              value="audio" 
              className="flex items-center gap-2 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
            >
              <Volume2 className="h-4 w-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger 
              value="appearance" 
              className="flex items-center gap-2 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
            >
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger 
              value="about" 
              className="flex items-center gap-2 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
            >
              <Info className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(85vh-8rem)] px-6 py-4">
            <TabsContent value="security" className="mt-0 space-y-4">
              <SecurityPanel />
            </TabsContent>

            <TabsContent value="audio" className="mt-0 space-y-4">
              <div className="rounded-lg border border-cyan-500/20 p-6">
                <h3 className="text-lg font-semibold mb-4">Audio Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Speech Volume</label>
                    <p className="text-xs text-muted-foreground mb-2">Adjust the volume of AI speech output</p>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      defaultValue="80" 
                      className="w-full"
                      data-testid="slider-speech-volume"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Speech Rate</label>
                    <p className="text-xs text-muted-foreground mb-2">Control how fast the AI speaks</p>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1" 
                      defaultValue="1" 
                      className="w-full"
                      data-testid="slider-speech-rate"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Microphone Sensitivity</label>
                    <p className="text-xs text-muted-foreground mb-2">Adjust microphone pickup sensitivity</p>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      defaultValue="70" 
                      className="w-full"
                      data-testid="slider-mic-sensitivity"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="mt-0 space-y-4">
              <div className="rounded-lg border border-cyan-500/20 p-6">
                <h3 className="text-lg font-semibold mb-4">Appearance Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Theme</label>
                    <p className="text-xs text-muted-foreground mb-2">Choose your preferred color theme</p>
                    <select 
                      className="w-full px-3 py-2 rounded-md bg-background border border-cyan-500/20"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'classic' | 'hud' | 'auto')}
                      data-testid="select-theme"
                    >
                      <option value="classic">Classic</option>
                      <option value="hud">HUD</option>
                      <option value="auto">System</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">UI Mode</label>
                    <p className="text-xs text-muted-foreground mb-2">Choose between header bar or hologram sphere</p>
                    <select 
                      className="w-full px-3 py-2 rounded-md bg-background border border-cyan-500/20"
                      defaultValue="header"
                      data-testid="select-ui-mode"
                    >
                      <option value="header">Header Bar</option>
                      <option value="sphere">Hologram Sphere</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="mt-0 space-y-4">
              <div className="rounded-lg border border-cyan-500/20 p-6">
                <h3 className="text-lg font-semibold mb-4">About Lolo AI</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono">v-current</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Build</span>
                    <span className="font-mono">2025.10.03</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Engine</span>
                    <span className="font-mono">Neural v2</span>
                  </div>
                  <div className="pt-4 border-t border-cyan-500/20">
                    <p className="text-xs text-muted-foreground">
                      Lolo AI is an advanced voice-enabled AI assistant with biometric security features. 
                      It uses cutting-edge speech recognition and synthesis to provide a natural conversational experience.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Standalone settings button that can be placed anywhere
export function SettingsButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsModal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={`hover:bg-cyan-500/10 ${className}`}
          data-testid="button-open-settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      }
    />
  );
}