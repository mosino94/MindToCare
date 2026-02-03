
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/app-layout';
import { PT_Sans } from 'next/font/google';
import './globals.css';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
});

const logoUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-7147485763-c4a98.firebasestorage.app/o/logo%2FChatGPT%20Image%20Jan%2022%2C%202026%2C%2008_48_01%20PM.png?alt=media&token=ff749795-5819-40b6-affc-456eb54ad1cf';

export const metadata: Metadata = {
  title: 'MindToCare',
  description: 'A safe space for connection and support.',
  generator: null,
  icons: {
    icon: logoUrl,
    shortcut: logoUrl,
    apple: logoUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ptSans.variable} suppressHydrationWarning>
      <head />
      <body className="font-body antialiased">
        <Providers>
            <AppLayout>{children}</AppLayout>
            <Toaster />
        </Providers>
      </body>
    </html>
  );
}
