/**
 * Security Panel UI Component
 * Manages voice enrollment, security settings, and voiceprint management
 */

import { useState } from 'react';
import { useVoiceprint } from '@/hooks/useVoiceprint';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Mic, 
  MicOff, 
  UserCheck, 
  Trash2, 
  RefreshCw, 
  Settings,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export function SecurityPanel() {
  const {
    isEnrolling,
    enrollmentProgress,
    voiceprints,
    activeVoiceprint,
    settings,
    lastMatch,
    startEnrollment,
    cancelEnrollment,
    deleteVoiceprint,
    setActiveVoiceprint,
    updateSettings,
    clearAllVoiceprints
  } = useVoiceprint();

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format similarity percentage
  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Enrollment Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Voice Security
          </CardTitle>
          <CardDescription>
            Secure your voice commands with biometric authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enrollment Status */}
          <div className="space-y-2">
            <Label>Enrollment Status</Label>
            {voiceprints.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No voice enrolled. Enroll your voice to enable security features.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {voiceprints.map((vp) => (
                  <div
                    key={vp.id}
                    className="flex items-center justify-between p-2 rounded-md border"
                    data-testid={`voiceprint-${vp.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">
                          {activeVoiceprint?.id === vp.id && (
                            <Badge variant="default" className="mr-2">Active</Badge>
                          )}
                          Voice Profile
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enrolled: {formatDate(vp.enrollmentDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeVoiceprint?.id !== vp.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveVoiceprint(vp.id)}
                          data-testid={`button-activate-${vp.id}`}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVoiceprint(vp.id)}
                        data-testid={`button-delete-${vp.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrollment Controls */}
          <div className="space-y-2">
            {isEnrolling ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Mic className="h-4 w-4 animate-pulse text-red-500" />
                    Recording Voice... (7 seconds)
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEnrollment}
                    data-testid="button-cancel-enrollment"
                  >
                    Cancel
                  </Button>
                </div>
                <Progress value={enrollmentProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Speak naturally for the entire duration for best results
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={startEnrollment}
                  disabled={voiceprints.length >= 5}
                  className="flex-1"
                  data-testid="button-start-enrollment"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {voiceprints.length === 0 ? 'Enroll Voice' : 'Add New Voice'}
                </Button>
                {voiceprints.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (activeVoiceprint) {
                        deleteVoiceprint(activeVoiceprint.id);
                        startEnrollment();
                      }
                    }}
                    data-testid="button-re-enroll"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-enroll
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Last Match Result */}
          {lastMatch && (
            <div className="p-2 rounded-md bg-muted">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Last Verification</Label>
                <div className="flex items-center gap-2">
                  {lastMatch.match ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs font-medium">
                    {formatSimilarity(lastMatch.similarity)} match
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Require Voice Match */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-match">Require Voice Match</Label>
              <p className="text-xs text-muted-foreground">
                Only allow recognized voices to use voice commands
              </p>
            </div>
            <Switch
              id="require-match"
              checked={settings.requireMatch}
              onCheckedChange={(checked) => updateSettings({ requireMatch: checked })}
              disabled={voiceprints.length === 0}
              data-testid="switch-require-match"
            />
          </div>

          {/* VAD Enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="vad-enabled">Voice Activity Detection</Label>
              <p className="text-xs text-muted-foreground">
                Detect when you start and stop speaking
              </p>
            </div>
            <Switch
              id="vad-enabled"
              checked={settings.vadEnabled}
              onCheckedChange={(checked) => updateSettings({ vadEnabled: checked })}
              data-testid="switch-vad"
            />
          </div>

          {/* Barge-in Enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="barge-in">Barge-in</Label>
              <p className="text-xs text-muted-foreground">
                Stop AI speech when you start talking
              </p>
            </div>
            <Switch
              id="barge-in"
              checked={settings.bargeInEnabled}
              onCheckedChange={(checked) => updateSettings({ bargeInEnabled: checked })}
              data-testid="switch-barge-in"
            />
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
              data-testid="button-toggle-advanced"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </Button>

            {showAdvanced && (
              <div className="space-y-4 pt-2 border-t">
                {/* Match Threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="threshold">Match Threshold</Label>
                    <span className="text-sm text-muted-foreground">
                      {formatSimilarity(settings.matchThreshold)}
                    </span>
                  </div>
                  <Slider
                    id="threshold"
                    min={0.7}
                    max={0.95}
                    step={0.05}
                    value={[settings.matchThreshold]}
                    onValueChange={(value) => updateSettings({ matchThreshold: value[0] })}
                    className="w-full"
                    data-testid="slider-threshold"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values require closer voice match
                  </p>
                </div>

                {/* Auto-idle Timeout */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="idle-timeout">Auto-idle Timeout</Label>
                    <span className="text-sm text-muted-foreground">
                      {settings.autoIdleTimeout / 1000}s
                    </span>
                  </div>
                  <Slider
                    id="idle-timeout"
                    min={500}
                    max={5000}
                    step={500}
                    value={[settings.autoIdleTimeout]}
                    onValueChange={(value) => updateSettings({ autoIdleTimeout: value[0] })}
                    className="w-full"
                    data-testid="slider-idle-timeout"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stop listening after this duration of silence
                  </p>
                </div>

                {/* Clear All Data */}
                {voiceprints.length > 0 && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={clearAllVoiceprints}
                      className="w-full"
                      data-testid="button-clear-all"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear All Voice Data
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}