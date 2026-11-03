import { useEffect, useRef } from 'react'
import type { ExtensionDefinition } from '../plugins/types'
import { FloatingPanel } from './FloatingPanel'

export interface ExtensionFrameProps {
  title: string
  /** URL страницы модуля на HTTP-сервере хоста */
  src: string
  /** id расширения — используется как метка postMessage и ключ состояния */
  extensionId: string
  role: 'gm' | 'player'
  /** Состояние расширения из сессии (сырое, без обёртки метаданных) */
  state: unknown
  /** Мастер сохраняет изменения; у игрока не вызывается */
  onChange?: (state: unknown) => void
  onClose?: () => void
  width?: number
  height?: number
  storageKey?: string
  defaultPosition?: { x: number; y: number }
  definition?: ExtensionDefinition
}

/**
 * Песочница расширения (модуля) в iframe.
 *
 * Расширения из Owlbear Rodeo ожидают SDK и метаданные сцены. Наш адаптер
 * внутри iframe (obr-shim.js) обменивается с этой страницей сообщениями:
 * запрашивает роль и состояние сцены и присылает изменения. Состояние живёт
 * в сессии VTT, поэтому его видят и Мастер, и игроки.
 */
export function ExtensionFrame({
  title,
  src,
  extensionId,
  role,
  state,
  onChange,
  onClose,
  width = 780,
  height = 620,
  storageKey,
  defaultPosition = { x: 280, y: 60 }
}: ExtensionFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const stateRef = useRef<unknown>(state)
  const roleRef = useRef(role)
  const onChangeRef = useRef(onChange)

  stateRef.current = state
  roleRef.current = role
  onChangeRef.current = onChange

  const post = (message: Record<string, unknown>): void => {
    frameRef.current?.contentWindow?.postMessage({ __vttExt: extensionId, ...message }, '*')
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const frame = frameRef.current
      if (!frame || event.source !== frame.contentWindow) return

      const data = event.data as {
        __vttExt?: string
        type?: string
        reqId?: number
        state?: unknown
      } | null
      if (!data || data.__vttExt !== extensionId) return

      if (data.type === 'hello') {
        post({ type: 'role', role: roleRef.current === 'gm' ? 'GM' : 'PLAYER' })
        post({ type: 'metadata', state: stateRef.current ?? null })
        post({ type: 'ready' })
        return
      }
      if (data.type === 'getMetadata') {
        post({ type: 'metadata', state: stateRef.current ?? null, reqId: data.reqId })
        return
      }
      if (data.type === 'setMetadata' && roleRef.current === 'gm') {
        onChangeRef.current?.(data.state)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [extensionId])

  // Мастер обновил состояние — отправляем всем открытым iframe
  useEffect(() => {
    post({ type: 'metadata', state: state ?? null })
  }, [state])

  useEffect(() => {
    post({ type: 'role', role: role === 'gm' ? 'GM' : 'PLAYER' })
  }, [role])

  return (
    <FloatingPanel
      title={title}
      onClose={onClose}
      width={width}
      storageKey={storageKey}
      defaultPosition={defaultPosition}
    >
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className="block w-full border-0 bg-[#14161f]"
        style={{ height }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="clipboard-write"
      />
    </FloatingPanel>
  )
}
