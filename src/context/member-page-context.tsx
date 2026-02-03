
'use client';

import { createContext, useState, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';

interface MemberPageContextType {
  isRequestDialogOpen: boolean;
  setIsRequestDialogOpen: Dispatch<SetStateAction<boolean>>;
}

export const MemberPageContext = createContext<MemberPageContextType | undefined>(undefined);

export function MemberPageProvider({ children }: { children: ReactNode }) {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  const value = useMemo(() => ({ isRequestDialogOpen, setIsRequestDialogOpen }), [isRequestDialogOpen]);

  return (
    <MemberPageContext.Provider value={value}>
      {children}
    </MemberPageContext.Provider>
  );
}
