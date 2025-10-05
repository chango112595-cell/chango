/**
 * Compact Header Component
 * Minimal, responsive header with online status indicator
 */

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertCircle, Circle } from 'lucide-react';
import { voiceGate } from '../core/gate';
import { debugBus } from '../dev/debugBus';

interface HeaderCompactProps {
  className?: string;
}

export function HeaderCompact({ className = '' }: HeaderCompactProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gateOpen, setGateOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      debugBus.info('HeaderCompact', 'online', {});
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      debugBus.warn('HeaderCompact', 'offline', {});
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Monitor gate status
  useEffect(() => {
    const updateGateStatus = () => {
      const status = voiceGate.getStatus();
      setGateOpen(status.isOpen);
      setHasPermission(status.hasPermission);
    };
    
    // Initial status
    updateGateStatus();
    
    // Subscribe to changes
    const unsubscribe = voiceGate.onStateChange(() => {
      updateGateStatus();
    });
    
    return unsubscribe;
  }, []);
  
  // Determine status color
  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (!hasPermission) return 'text-yellow-500';
    if (gateOpen) return 'text-green-500';
    return 'text-gray-500';
  };
  
  // Determine status icon
  const StatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }
    if (!hasPermission) {
      return <AlertCircle className="w-4 h-4" />;
    }
    // Use a simple circle instead of mic icons
    return <Circle className="w-4 h-4" />;
  };
  
  // Get status text
  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!hasPermission) return 'Permission Required';
    if (gateOpen) return 'Active';
    return 'Inactive';
  };
  
  return (
    <header 
      className={`header-compact ${className}`}
      data-testid="header-compact"
    >
      <div className="header-compact-inner">
        {/* Logo/Title with futuristic glow */}
        <div className="header-title">
          <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text animate-gradient-text">
            Chango AI
          </span>
        </div>
        
        {/* Status Indicator */}
        <div className="header-status">
          <div className={`status-indicator ${getStatusColor()}`}>
            <StatusIcon />
            <span className="status-text hidden sm:inline ml-2">
              {getStatusText()}
            </span>
          </div>
          
          {/* Connection indicator */}
          <div className="connection-dot">
            <div 
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              } ${isOnline ? 'animate-pulse' : ''}`}
            />
          </div>
        </div>
      </div>
    </header>
  );
}