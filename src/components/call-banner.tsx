
'use client';

import { useCall } from '@/hooks/use-call';
import { Phone, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CallBanner() {
  const { callId, callStatus, duration, otherUser, isCallUIVisible, setCallUIVisible } = useCall();

  const isReconnecting = callStatus === 'reconnecting';

  if ((callStatus !== 'connected' && !isReconnecting) || !callId || isCallUIVisible) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
        className="fixed bottom-0 left-0 right-0 z-50"
        onClick={() => setCallUIVisible(true)}
    >
      <div className={cn(
          "text-white p-3 flex items-center justify-center cursor-pointer transition-colors",
          isReconnecting ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-500 hover:bg-red-600"
      )}>
        <div className={cn("flex items-center gap-4 animate-pulse")}>
            {isReconnecting ? <AlertCircle className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
            <div className="text-center">
                <p className="font-semibold text-sm">
                    {isReconnecting 
                        ? `Reconnecting with ${otherUser?.screenName || 'user'}...`
                        : `Call in progress with ${otherUser?.screenName || 'user'}`
                    }
                </p>
                {!isReconnecting && <p className="text-xs">{formatDuration(duration)}</p>}
            </div>
        </div>
      </div>
    </div>
  );
}
