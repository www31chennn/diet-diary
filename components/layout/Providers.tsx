'use client'
import { SessionProvider } from 'next-auth/react'
import { StoreProvider } from '@/lib/StoreContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StoreProvider>
        {children}
      </StoreProvider>
    </SessionProvider>
  )
}