'use client';

import { useAuth } from '@/hooks/use-auth';
import { useContext } from 'react';
import { MemberPageContext } from '@/context/member-page-context';
import { ListenerRequestNotifier } from './listener-request-notifier';
import { HeartHandshake, Search } from 'lucide-react';
import { useCall } from '@/hooks/use-call';

export function DesktopActionButton() {
  const { role } = useAuth();
  const memberContext = useContext(MemberPageContext);
  const { pendingRequest } = useCall();

  const setIsRequestDialogOpen = memberContext?.setIsRequestDialogOpen ?? (() => {});

  if (role === 'member') {
    return (
      <button
        onClick={() => setIsRequestDialogOpen(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center w-16 h-16 bg-primary rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 z-40"
        aria-label="Find Support"
      >
        {pendingRequest ? (
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping"></div>
            <Search className="relative w-full h-full" />
          </div>
        ) : (
          <HeartHandshake className="w-8 h-8" />
        )}
      </button>
    );
  }

  if (role === 'listener') {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <ListenerRequestNotifier isBottomNav={true} />
      </div>
    );
  }

  return null;
}
