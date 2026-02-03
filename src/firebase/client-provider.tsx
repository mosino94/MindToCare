'use client';

import { ReactNode, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './config';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const app = useMemo(() => initializeFirebase(), []);
  const auth = useMemo(() => getAuth(app), [app]);
  const firestore = useMemo(() => getFirestore(app), [app]);

  return (
    <FirebaseProvider value={{ app, auth, firestore }}>
      {children}
    </FirebaseProvider>
  );
}
