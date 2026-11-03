import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage, PlayerInfo } from '../../types/session'
import { colorForPlayer } from '../../utils/color'
import { FloatingPanel } from '../FloatingPanel'
import { ChatIcon, SendIcon } from '../icons'

export interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  currentUserId: string
  players?: PlayerInfo[]
  disabled?: boolean
  onClose?: () => void
  storageKey?: string
  defaultPosition?: { x: number; y: number }
}

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Общий чат (ТЗ, п.7): имя отправителя, время, интеграция с бросками */
export function ChatPanel({
  messages,
  onSend,
  currentUserId,
  players = [],
  disabled = false,
  onClose,
  storageKey = 'vtt.panel.chat',
  defaultPosition = { x: 24, y: 320 }
}: ChatPanelProps) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = listRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText('')
  }

  return (
    <FloatingPanel
      title={`Чат${players.length > 0 ? ` · ${players.length}` : ''}`}
      icon={<ChatIcon size={16} />}
      onClose={onClose}
      storageKey={storageKey}
      defaultPosition={defaultPosition}
      width={330}
    >
      <div ref={listRef} className="h-64 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-500">Сообщений пока нет</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => {
              const mine = message.userId === currentUserId
              return (
                <li key={message.id} className={`flex gap-2 ${mine ? 'opacity-95' : ''}`}>
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorForPlayer(message.userId) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs font-semibold text-gray-200">
                        {message.userName}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-300">
                      {message.text}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={disabled ? 'Нет связи с хостом…' : 'Сообщение…'}
          disabled={disabled}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-indigo-500/70 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || text.trim().length === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Отправить сообщение"
        >
          <SendIcon size={16} />
        </button>
      </form>
    </FloatingPanel>
  )
}
