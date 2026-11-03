import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { Token } from '@vtt/shared'
import {
  assetUrl,
  EditIcon,
  FloatingPanel,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  UnlockIcon,
  UploadIcon
} from '@vtt/shared/ui'
import { useAssetsBaseUrl } from '../../lib/host'
import { worldCenter } from '@vtt/shared/utils'
import { useHostStore } from '../../store/useHostStore'

/** Панель токенов (ТЗ, п.3): загрузка PNG, список, GM-only скрытие/закрепление */
export function TokenPanel() {
  const session = useHostStore((state) => state.session)
  const panels = useHostStore((state) => state.panels)
  const togglePanel = useHostStore((state) => state.togglePanel)
  const selectedTokenId = useHostStore((state) => state.selectedTokenId)
  const setSelectedToken = useHostStore((state) => state.setSelectedToken)
  const updateToken = useHostStore((state) => state.updateToken)
  const renameToken = useHostStore((state) => state.renameToken)
  const removeToken = useHostStore((state) => state.removeToken)
  const addQuickToken = useHostStore((state) => state.addQuickToken)
  const addTokenFromFile = useHostStore((state) => state.addTokenFromFile)
  const assetsBaseUrl = useAssetsBaseUrl()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [quickName, setQuickName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  if (!session || !panels.tokens) return null

  const uploadFiles = (files: File[]): void => {
    const center = worldCenter(session.maps)
    const centerX = center.x
    const centerY = center.y
    files
      .filter((file) => file.type.startsWith('image/'))
      .forEach((file, index) => {
        void addTokenFromFile(
          file,
          centerX + index * session.settings.gridSize,
          centerY + index * 8
        )
      })
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    uploadFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragOver(false)
    uploadFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <FloatingPanel
      title={`Токены · ${session.tokens.length}`}
      icon={<PlusIcon size={16} />}
      defaultPosition={{ x: 24, y: 96 }}
      storageKey="vtt.gm.panel.tokens"
      width={300}
      onClose={() => togglePanel('tokens')}
    >
      <div className="space-y-2 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            <UploadIcon size={14} />
            Загрузить PNG
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </div>

        <div className="flex gap-2">
          <input
            value={quickName}
            onChange={(event) => setQuickName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && quickName.trim()) {
                void addQuickToken(quickName.trim())
                setQuickName('')
              }
            }}
            placeholder="Имя без картинки…"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/70"
          />
          <button
            type="button"
            onClick={() => {
              if (!quickName.trim()) return
              void addQuickToken(quickName.trim())
              setQuickName('')
            }}
            className="rounded-lg border border-white/10 px-2.5 text-gray-300 transition hover:bg-white/10"
            aria-label="Добавить токен"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-lg border border-dashed px-2 py-2 text-center text-[11px] transition ${
            dragOver
              ? 'border-indigo-400/70 bg-indigo-500/10 text-indigo-200'
              : 'border-white/10 text-gray-600'
          }`}
        >
          Перетащите изображения сюда — токены появятся в центре карты
        </div>

        {session.tokens.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">Токенов пока нет</p>
        ) : (
          <ul className="space-y-1">
            {session.tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                sessionId={session.id}
                assetsBaseUrl={assetsBaseUrl}
                selected={token.id === selectedTokenId}
                onSelect={() => setSelectedToken(token.id)}
                onRename={(name) => renameToken(token.id, name)}
                onToggleHidden={() =>
                  void updateToken({ tokenId: token.id, hidden: !token.hidden })
                }
                onToggleLocked={() =>
                  void updateToken({ tokenId: token.id, locked: !token.locked })
                }
                onRemove={() => {
                  void removeToken(token.id)
                  if (selectedTokenId === token.id) setSelectedToken(null)
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </FloatingPanel>
  )
}

interface TokenRowProps {
  token: Token
  sessionId: string
  assetsBaseUrl: string
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onToggleHidden: () => void
  onToggleLocked: () => void
  onRemove: () => void
}

function TokenRow({
  token,
  sessionId,
  assetsBaseUrl,
  selected,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onRemove
}: TokenRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(token.name)

  const startEditing = (): void => {
    setDraft(token.name)
    setEditing(true)
  }

  const commit = (): void => {
    onRename(draft)
    setEditing(false)
  }

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
        selected
          ? 'border-indigo-400/50 bg-indigo-500/10'
          : 'border-transparent hover:border-white/10 hover:bg-white/5'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {token.imageUrl ? (
          <img
            src={assetUrl(assetsBaseUrl, sessionId, token.imageUrl)}
            alt=""
            className="h-8 w-8 shrink-0 rounded-md border border-white/10 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-indigo-500/20 text-xs font-semibold text-indigo-200">
            {token.name.slice(0, 1).toUpperCase()}
          </span>
        )}

        {editing ? (
          <div className="min-w-0 flex-1">
            <input
              value={draft}
              autoFocus
              maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') setEditing(false)
              }}
              onBlur={commit}
              className="w-full rounded-md border border-indigo-400/60 bg-black/50 px-1.5 py-0.5 text-xs text-gray-100 outline-none"
              aria-label="Имя токена"
            />
            <span className="mt-0.5 block text-[10px] text-gray-600">
              Enter — сохранить, Esc — отмена
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            onDoubleClick={startEditing}
            className="min-w-0 flex-1 text-left"
            title="Двойной клик — переименовать"
          >
            <span className="block truncate text-xs font-medium text-gray-200">{token.name}</span>
            <span className="block text-[10px] text-gray-600">
              {Math.round(token.width)}×{Math.round(token.height)}
              {token.hidden ? ' · скрыт' : ''}
            </span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={startEditing}
        title="Переименовать токен"
        className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-white/10 hover:text-white"
      >
        <EditIcon size={14} />
      </button>
      <button
        type="button"
        onClick={onToggleHidden}
        title={token.hidden ? 'Показать игрокам' : 'Скрыть от игроков'}
        className={`flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10 ${
          token.hidden ? 'text-violet-300' : 'text-gray-500'
        }`}
      >
        {token.hidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
      </button>
      <button
        type="button"
        onClick={onToggleLocked}
        title={token.locked ? 'Разрешить перемещение' : 'Закрепить'}
        className={`flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/10 ${
          token.locked ? 'text-amber-300' : 'text-gray-500'
        }`}
      >
        {token.locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Удалить токен"
        className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-red-500/15 hover:text-red-300"
      >
        <TrashIcon size={14} />
      </button>
    </li>
  )
}
