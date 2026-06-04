import { useEffect, useRef } from 'react'

export const useRemoteRefresh = (refresh, intervalMs = 15000) => {
  const refreshRef = useRef(refresh)
  const activeRefreshRef = useRef(null)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    const runRefresh = () => {
      if (document.hidden || activeRefreshRef.current) return

      activeRefreshRef.current = Promise.resolve(refreshRef.current())
        .catch((error) => {
          console.warn('Remote refresh failed', error)
        })
        .finally(() => {
          activeRefreshRef.current = null
        })
    }

    const handleVisible = () => {
      if (!document.hidden) runRefresh()
    }

    const timer = window.setInterval(runRefresh, intervalMs)
    window.addEventListener('focus', runRefresh)
    window.addEventListener('online', runRefresh)
    document.addEventListener('visibilitychange', handleVisible)
    runRefresh()

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', runRefresh)
      window.removeEventListener('online', runRefresh)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [intervalMs])
}
