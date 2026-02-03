
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useContext } from 'react';
import { MemberPageContext } from '@/context/member-page-context';
import { HeartHandshake } from 'lucide-react';


export default function MemberPage() {
  const { screenName } = useAuth();
  const memberContext = useContext(MemberPageContext);

  return (
    <main className="flex flex-col flex-1 items-center justify-center gap-4 p-4 md:gap-8 md:p-8 animate-in fade-in-0">
        <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Welcome, {screenName}</h1>
            <p className="text-muted-foreground md:text-xl/relaxed">
                You're in a safe space. When you're ready to talk, we're here to listen.
            </p>
        </div>
    </main>
  );
}
