import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useVoiceSynthesis } from "@/hooks/useVoiceSynthesis";
import { ACCENT_PROFILES } from "@/lib/accentEngine";

// Available emotions for CVE
const EMOTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "calm", label: "Calm" },
  { value: "cheerful", label: "Cheerful" },
  { value: "serious", label: "Serious" },
  { value: "empathetic", label: "Empathetic" },
];

export default function AccentEmulator() {
  const [selectedProfile, setSelectedProfile] = useState("neutral");
  const [selectedEmotion, setSelectedEmotion] = useState("neutral");
  const [intensity, setIntensity] = useState([0.55]);
  const [rate, setRate] = useState([1.0]);
  const [pitch, setPitch] = useState([1.0]);
  
  const { applyAccent, repeatWithAccent } = useVoiceSynthesis();

  const handleApplyAccent = () => {
    applyAccent({
      profile: selectedProfile,
      intensity: intensity[0],
      rate: rate[0],
      pitch: pitch[0],
      emotion: selectedEmotion,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accent Emulation Engine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="accent-profile">Accent Profile</Label>
              <Select 
                value={selectedProfile} 
                onValueChange={setSelectedProfile}
                data-testid="select-accent-profile"
              >
                <SelectTrigger id="accent-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCENT_PROFILES).map(([key, profile]) => (
                    <SelectItem key={key} value={key}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emotion-select">Emotion</Label>
              <Select 
                value={selectedEmotion} 
                onValueChange={setSelectedEmotion}
                data-testid="select-emotion"
              >
                <SelectTrigger id="emotion-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((emotion) => (
                    <SelectItem key={emotion.value} value={emotion.value}>
                      {emotion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="intensity-slider">
                Intensity: {intensity[0].toFixed(2)}
              </Label>
              <Slider
                id="intensity-slider"
                min={0}
                max={1}
                step={0.05}
                value={intensity}
                onValueChange={setIntensity}
                className="mt-2"
                data-testid="slider-accent-intensity"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Voice Parameters</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Rate</span>
                  <Slider
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={rate}
                    onValueChange={setRate}
                    className="w-32"
                    data-testid="slider-voice-rate"
                  />
                  <span className="w-8 text-muted-foreground">{rate[0].toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Pitch</span>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={pitch}
                    onValueChange={setPitch}
                    className="w-32"
                    data-testid="slider-voice-pitch"
                  />
                  <span className="w-8 text-muted-foreground">{pitch[0].toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleApplyAccent} 
                className="w-full"
                data-testid="button-apply-accent"
              >
                Apply Accent
              </Button>
              <Button 
                onClick={repeatWithAccent} 
                variant="outline" 
                className="w-full"
                data-testid="button-repeat-accent"
              >
                Repeat with Accent
              </Button>
            </div>
          </div>
        </div>

        {/* Current Configuration Display */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Current Configuration: {ACCENT_PROFILES[selectedProfile]?.name} accent, {selectedEmotion} emotion, {(intensity[0] * 100).toFixed(0)}% intensity
          </p>
        </div>
      </CardContent>
    </Card>
  );
}