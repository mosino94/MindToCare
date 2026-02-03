
'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import { Loader2, UserX } from 'lucide-react';
import { Button } from './ui/button';

const WAITING_TIME = 60; // 60 seconds

interface WaitingToastContentProps {
    acceptedAt: number;
    onCancel: () => void;
    actionButton?: ReactNode;
}

export function WaitingToastContent({ acceptedAt, onCancel, actionButton }: WaitingToastContentProps) {
  const [timeLeft, setTimeLeft] = useState(WAITING_TIME);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiresAt = acceptedAt + (WAITING_TIME * 1000);
      const newTimeLeft = Math.max(0, Math.round((expiresAt - now) / 1000));
      setTimeLeft(newTimeLeft);

      if (newTimeLeft <= 0) {
        setTimeLeft(0);
        onCancel();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    };
    
    intervalRef.current = setInterval(updateTimer, 1000);
    updateTimer();

    return () => {
        if(intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };
  }, [acceptedAt, onCancel]);

  const message = actionButton ? 'Your listener is ready. Join the call.' : 'Waiting for member to join...';

  return (
    <div className="flex items-center gap-4 w-full mt-2">
      <div className="relative h-12 w-12 flex-shrink-0">
        <Loader2 className="absolute h-full w-full animate-spin text-primary" />
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
          {timeLeft}
        </div>
      </div>
      <div className="grid gap-1 flex-1">
        <p className="text-sm opacity-90">{message}</p>
        <div className="flex gap-2 mt-2">
          {actionButton}
          <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
            <UserX className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
