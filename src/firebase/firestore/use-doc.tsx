'use client';
import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, doc, DocumentReference, DocumentData, FirestoreError, getDoc, SnapshotOptions } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

const observer: SnapshotOptions = {
  serverTimestamps: 'estimate',
};

export function useDoc<T>(ref: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      ref as any,
      observer,
      (snapshot: any) => {
        setData(snapshot.exists() ? (snapshot.data() as T) : null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        setIsLoading(false);
        const permissionError = new FirestorePermissionError({
          path: ref?.path || '',
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error(`Error fetching document: ${ref.path}`, error);
      }
    );

    return () => unsubscribe();
  }, [ref?.path]);

  return { data, isLoading };
}

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
