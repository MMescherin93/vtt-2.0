import type { InviteInfo, TunnelStatus } from '../shared/ipc'

export interface InviteContext {
  lanIp: string
  clientPort: number
  servingClient: boolean
  /** Адрес туннеля (запущенный cloudflared или вставленный вручную) */
  tunnelUrl: string | null
  tunnel: TunnelStatus
}

/** Собирает ссылку-приглашение с учётом адреса туннеля (уточнение 1) */
export function buildInvite(context: InviteContext, sessionId: string | null): InviteInfo {
  const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''
  const localUrl = sessionId ? `http://localhost:${context.clientPort}/${query}` : null
  const lanUrl = sessionId ? `http://${context.lanIp}:${context.clientPort}/${query}` : null
  const tunnelBase = context.tunnelUrl?.replace(/\/+$/, '') ?? ''
  const tunnelUrl = sessionId && tunnelBase ? `${tunnelBase}/${query}` : null

  const hasLan = context.lanIp !== '127.0.0.1' && context.lanIp !== 'localhost'
  const inviteUrl = tunnelUrl ?? (hasLan ? lanUrl : localUrl)

  return {
    sessionId,
    inviteUrl,
    localUrl,
    lanUrl,
    tunnelUrl,
    lanIp: context.lanIp,
    clientPort: context.clientPort,
    servingClient: context.servingClient,
    tunnel: context.tunnel
  }
}
