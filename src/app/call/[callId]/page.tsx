
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCall } from '@/hooks/use-call';
import Loading from '@/app/loading';

export default function CallPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pageCallId = params.callId as string;

  const { callId, initiateCall, callStatus, setCallId } = useCall();

  useEffect(() => {
    // If we land on this page, it's to initiate a call.
    // The useCall hook and CallUI component will handle the rest.
    if (pageCallId && user && !callId && callStatus === 'disconnected') {
      // The third argument `isCaller` is set to false because joining via URL is always the callee
      initiateCall(pageCallId, user.uid, false);
    }
  }, [pageCallId, user, callId, initiateCall, callStatus]);

  useEffect(() => {
    const homePath = role === 'listener' ? '/listener' : '/member';
    // Once the call is handled by the floating UI, we can navigate away
    // from this "trigger" page back to the home page.
    if (callId === pageCallId && callStatus !== 'disconnected' && callStatus !== 'initializing') {
        router.replace(homePath);
    }

    // Handle case where call ends while on this page
    if (callStatus === 'disconnected' && callId) {
        setTimeout(() => {
            router.replace(homePath);
            setCallId(null);
        }, 1000);
    }

  }, [callId, pageCallId, callStatus, router, setCallId, role]);


  // This page itself doesn't render any UI for the call.
  // It just acts as a trigger. A loading spinner is shown while it works.
  return <Loading />;
}
