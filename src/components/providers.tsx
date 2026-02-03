"use client";

import { AuthProvider } from '@/components/auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { CallProvider } from '@/components/call-provider';
import { MemberPageProvider } from '@/context/member-page-context';
import { FirebaseClientProvider } from '@/firebase';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <FirebaseClientProvider>
        <AuthProvider>
          <MemberPageProvider>
            <CallProvider>
                {children}
            </CallProvider>
          </MemberPageProvider>
        </AuthProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}
