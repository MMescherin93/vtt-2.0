import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@vtt/shared'

export type VttSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** ID сессии из ссылки-приглашения (?session=...) */
export const SESSION_ID = new URLSearchParams(window.location.search).get('session') ?? ''

/**
 * Адрес хоста Мастера:
 * 1) VITE_HOST_URL из .env.local (например, для отдельного туннеля);
 * 2) параметр ?host= в ссылке;
 * 3) если клиент открыт с dev-сервера Vite (5173) — localhost:3001;
 * 4) иначе тот же origin (хост раздаёт клиент и Socket.io с одного порта).
 */
function resolveHostUrl(): string {
  const fromEnv = import.meta.env.VITE_HOST_URL as string | undefined
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  const fromQuery = new URLSearchParams(window.location.search).get('host')
  if (fromQuery) return fromQuery.replace(/\/+$/, '')

  if (window.location.port === '5173') return 'http://localhost:3001'
  return window.location.origin
}

export const hostUrl = resolveHostUrl()

/**
 * Единственный socket-клиент приложения.
 * reconnection: true — автоматическое переподключение (ТЗ, «Обработка отключений»).
 */
export const socket: VttSocket = io(hostUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000
})
