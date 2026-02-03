'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // The Next.js dev overlay will pick this up.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
        // In a real app, you'd want to clean this up.
    };
  }, []);

  return null; // This component does not render anything
}
