'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/header';
import { PresenceManager } from '@/components/presence-manager';
import { Loader2 } from 'lucide-react';
import { CallBanner } from '@/components/call-banner';
import { CallUI } from '@/components/call-ui';
import { BottomNavBar } from '@/components/bottom-nav-bar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { FindListenerDialog } from '@/components/find-listener-dialog';
import { DesktopActionButton } from '@/components/desktop-action-button';
import { Skeleton } from './ui/skeleton';


export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profileCompleted, loading } = useAuth();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // These pages have their own full-page layout and should not be wrapped by the main app layout.
  const isFullPage = pathname.startsWith('/login') || pathname.startsWith('/listener/training');

  if (isFullPage || (!loading && !user)) {
    return (
      <main className="flex min-h-screen flex-1 flex-col">{children}</main>
    );
  }

  return (
    <div className={cn("flex min-h-screen w-full flex-col bg-background")}>
      <Header />
      <PresenceManager />
      <main className={cn("flex flex-1 flex-col", isMobile ? "pb-20" : "")}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          children
        )}
      </main>
      {/* Navigation components remain visible even if loading, as long as user exists */}
      {(user || loading) && !isFullPage && (
        <>
          <FindListenerDialog />
          <CallUI />
          <CallBanner />
          {isMobile ? <BottomNavBar /> : <DesktopActionButton />}
        </>
      )}
    </div>
  );
}
