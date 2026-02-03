'use client';

import Loading from './loading';

// This page only shows a loading spinner.
// The main routing logic is handled in `src/components/auth-provider.tsx`,
// which will redirect the user to the correct page (`/login`, `/profile/complete`, `/member`, or `/listener`)
// based on their authentication and profile status.
export default function RootPage() {
  return <Loading />;
}
