import { useEffect, useRef } from 'react'
import type { ExtensionDefinition } from '../plugins/types'
import { FloatingPanel } from './FloatingPanel'
import { mergeWithBaseline, withLocalSelection, writeSelection } from './extensionState'

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
  /** Разрешить игроку сохранять состояние (модули с playerWritable) */
  allowPlayerWrite?: boolean
  /** Модуль просит отправить текст в общий чат */
  onChat?: (text: string) => void
  /** Ключ метаданных Owlbear, под которым модуль хранит состояние */
  metaKey?: string
  /** У каждого клиента свой выбор внутри модуля (например, текущий лист) */
  perClientSelection?: boolean
  /** Ключ массива, элементы которого сливаются по id между клиентами */
  mergeListKey?: string
  onClose?: () => void
  width?: number
  height?: number
  storageKey?: string
  defaultPosition?: { x: number; y: number }
  definition?: ExtensionDefinition
  className?: string
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
  allowPlayerWrite = false,
  metaKey,
  perClientSelection = false,
  mergeListKey,
  onChat,
  onClose,
  width = 780,
  height = 620,
  storageKey,
  defaultPosition = { x: 280, y: 60 },
  className
}: ExtensionFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const stateRef = useRef<unknown>(state)
  const roleRef = useRef(role)
  const allowPlayerWriteRef = useRef(allowPlayerWrite)
  const onChangeRef = useRef(onChange)
  const onChatRef = useRef(onChat)
  const metaKeyRef = useRef(metaKey)
  const perClientSelectionRef = useRef(perClientSelection)
  const mergeListKeyRef = useRef(mergeListKey)
  const baselineRef = useRef<unknown>(null)
  const lastIncomingRef = useRef<string | null>(null)

  stateRef.current = state
  roleRef.current = role
  allowPlayerWriteRef.current = allowPlayerWrite
  onChangeRef.current = onChange
  onChatRef.current = onChat
  metaKeyRef.current = metaKey
  perClientSelectionRef.current = perClientSelection
  mergeListKeyRef.current = mergeListKey

  /** Состояние, которое видит модуль: с локальным выбором листа */
  const shownState = (value: unknown): unknown => {
    const key = mergeListKeyRef.current
    return perClientSelectionRef.current && key
      ? withLocalSelection(value, extensionId, key)
      : value
  }

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
        text?: unknown
      } | null
      if (!data || data.__vttExt !== extensionId) return

      if (data.type === 'hello') {
        if (metaKeyRef.current) post({ type: 'config', metaKey: metaKeyRef.current })
        const shown = shownState(stateRef.current ?? null)
        baselineRef.current = shown
        post({ type: 'role', role: roleRef.current === 'gm' ? 'GM' : 'PLAYER' })
        post({ type: 'metadata', state: shown })
        post({ type: 'ready' })
        return
      }
      if (data.type === 'getMetadata') {
        const shown = shownState(stateRef.current ?? null)
        baselineRef.current = shown
        post({ type: 'metadata', state: shown, reqId: data.reqId })
        return
      }
      if (data.type === 'chat') {
        const text = typeof data.text === 'string' ? data.text.trim().slice(0, 500) : ''
        if (text) onChatRef.current?.(text)
        return
      }
      if (
        data.type === 'setMetadata' &&
        (roleRef.current === 'gm' || allowPlayerWriteRef.current)
      ) {
        const key = mergeListKeyRef.current
        let next = data.state

        if (perClientSelectionRef.current && key && next && typeof next === 'object') {
          const currentId = (next as Record<string, unknown>).currentId
          if (typeof currentId === 'string') writeSelection(extensionId, currentId)
          next = mergeWithBaseline(baselineRef.current, next, stateRef.current, key)
        }

        // room.setMetadata + scene.setMetadata дают два одинаковых вызова
        let json: string | null
        try {
          json = JSON.stringify(next ?? null)
        } catch {
          json = null
        }
        if (json !== null && json === lastIncomingRef.current) return
        lastIncomingRef.current = json
        onChangeRef.current?.(next)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [extensionId])

  // Состояние обновилось — отправляем в iframe с локальным выбором листа
  useEffect(() => {
    const shown = shownState(state ?? null)
    post({ type: 'metadata', state: shown })
    baselineRef.current = shown
  }, [state])

  useEffect(() => {
    if (metaKey) post({ type: 'config', metaKey })
  }, [metaKey])

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
      className={className}
    >
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className="block w-full border-0 bg-[#14161f]"
        style={{ height }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-write"
      />
    </FloatingPanel>
  )
}
