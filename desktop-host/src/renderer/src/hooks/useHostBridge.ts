import { useEffect } from 'react'
import { useHostStore } from '../store/useHostStore'

/**
 * Подписка окна Мастера на IPC-события главного процесса:
 * статус сервера, изменения сессии, токены, чат, кубики и туман.
 */
export function useHostBridge(): void {
  useEffect(() => {
    const store = useHostStore.getState()

    void window.hostApi.getServerStatus().then((status) => store.setStatus(status))
    void store.refreshSessions()

    const offStatus = window.hostApi.onServerStatus((status) => {
      useHostStore.getState().setStatus(status)
    })
    const offEvents = window.hostApi.onServerEvent((event) => {
      useHostStore.getState().applyServerEvent(event)
    })

    void window.hostApi.getActiveSession().then((session) => {
      if (session) {
        useHostStore.getState().applyServerEvent({ type: 'session:update', session })
      }
    })

    return () => {
      offStatus()
      offEvents()
    }
  }, [])
}
