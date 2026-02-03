
'use client';

import { useContext } from 'react';
import { CallContext, type CallContextType } from '@/context/call-context';

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
