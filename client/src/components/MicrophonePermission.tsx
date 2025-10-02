import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requestMicrophonePermission, getLoloStatus } from '@/app/bootstrap';

export function MicrophonePermission() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasPermission, setHasPermission] = useState(() => {
    const status = getLoloStatus();
    return status.micPermission;
  });

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestMicrophonePermission();
      setHasPermission(granted);
      if (granted) {
        console.log('[MicrophonePermission] Permission granted!');
      } else {
        console.log('[MicrophonePermission] Permission denied');
      }
    } catch (error) {
      console.error('[MicrophonePermission] Error:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  // If already has permission, don't show the card
  if (hasPermission) {
    return null;
  }

  return (
    <Card className="fixed top-20 right-4 p-4 max-w-sm bg-yellow-900/20 border-yellow-500/30 z-50" data-testid="mic-permission-card">
      <div className="flex items-start gap-3">
        <MicOff className="text-yellow-500 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-500 mb-1">Microphone Access Required</h3>
          <p className="text-sm text-gray-300 mb-3">
            Lolo needs microphone permission to listen for voice commands. Click below to grant permission.
          </p>
          <Button 
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="bg-yellow-600 hover:bg-yellow-700"
            data-testid="button-request-mic"
          >
            <Mic className="mr-2 h-4 w-4" />
            {isRequesting ? 'Requesting...' : 'Enable Microphone'}
          </Button>
        </div>
      </div>
    </Card>
  );
}