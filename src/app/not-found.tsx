'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-4xl font-bold tracking-tighter">404 - Not Found</h1>
      <p className="max-w-md text-muted-foreground">
        Oops! The page you are looking for does not exist. It might have been moved or deleted.
      </p>
      <Button asChild>
        <Link href="/">Go back to Homepage</Link>
      </Button>
    </div>
  )
}
