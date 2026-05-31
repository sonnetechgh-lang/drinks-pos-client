import { useEffect } from 'react'
import { flushQueue } from '../db/syncQueue'

export const useSync = () => {
  useEffect(() => {
    // 1. Flush on mount
    flushQueue()

    // 2. Flush when coming back online
    const handleOnline = () => {
      console.log('App is online, flushing queue...')
      flushQueue()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])
}
