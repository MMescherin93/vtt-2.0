import { useMemo } from 'react'
import { useHostStore } from '../store/useHostStore'

/** Базовый URL HTTP-сервера хоста (картинки карты и токенов) */
export function useAssetsBaseUrl(): string {
  const port = useHostStore((state) => state.status?.port ?? 3001)
  return useMemo(() => `http://127.0.0.1:${port}`, [port])
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
