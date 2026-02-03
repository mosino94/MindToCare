'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/app/loading';

export default function JournalEntryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main journal page since the detail view is removed.
    router.replace('/journal');
  }, [router]);

  // Show a loading indicator while redirecting.
  return <Loading />;
}
