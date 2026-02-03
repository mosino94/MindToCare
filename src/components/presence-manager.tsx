
'use client';

import { useEffect } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

export function PresenceManager() {
  const { user, identity, role } = useAuth();

  useEffect(() => {
    if (!user || !identity) {
      return;
    }

    const presenceRef = ref(database, `status/${identity}`);
    const connectedRef = ref(database, '.info/connected');
    let manualStatusUnsubscribe = () => {};

    const connectedSub = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) {
        return;
      }

      // Set the onDisconnect handler to mark the user as offline when they disconnect
      onDisconnect(presenceRef).set({ state: 'offline', last_changed: serverTimestamp() });

      // Set the initial online status
      if (role === 'member') {
        set(presenceRef, { state: 'online', last_changed: serverTimestamp() });
      } else if (role === 'listener') {
        // For listeners, their online status depends on their manually set preference.
        // We listen to this preference to set the real-time status.
        const userStatusRef = ref(database, `users/${user.uid}/status`);
        manualStatusUnsubscribe = onValue(userStatusRef, (snapshot) => {
            const manualStatus = snapshot.val() || 'available'; // Default to 'available' if not set

            if (manualStatus === 'available') {
                set(presenceRef, { state: 'online', last_changed: serverTimestamp() });
            } else if (manualStatus === 'busy') {
                set(presenceRef, { state: 'busy', last_changed: serverTimestamp() });
            } else { // 'offline'
                set(presenceRef, { state: 'offline', last_changed: serverTimestamp() });
            }
        });
      }
    });

    // Cleanup function when the component unmounts or dependencies change (e.g., user logs out, role changes)
    return () => {
      connectedSub();
      manualStatusUnsubscribe();
      if (presenceRef) {
        // Immediately set status to offline on cleanup to avoid stale presence data
        set(presenceRef, { state: 'offline', last_changed: serverTimestamp() });
      }
    };
  }, [user, identity, role]);

  return null;
}
