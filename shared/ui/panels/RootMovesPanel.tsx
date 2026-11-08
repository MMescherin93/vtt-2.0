import { useEffect, useRef, useState } from 'react'
import type { RootMove, RootMoveCategory, RootMovesLibrary } from '../../types/root'
import { ROOT_MOVE_CATEGORIES, rootMoveCategoryLabel } from '../../types/root'
import { formatRootRoll, ROOT_STATS, rollRootMove, type RootStat } from '../../utils/rootDice'
import { FloatingPanel } from '../FloatingPanel'
import { DiceIcon } from '../icons'

export interface RootMovesPanelProps {
  state: unknown
  onChange?: (state: RootMovesLibrary) => void
  sheetState: unknown
  onSheetChange?: (state: unknown) => void
  onSendChat: (text: string) => void
  onClose: () => void
  storageKey?: string
}

function makeId(): string {
  try {
    return `move_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `move_${Math.random().toString(36).slice(2, 10)}`
  }
}

function normalize(raw: unknown): RootMove[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { moves?: unknown }).moves)
      ? (raw as { moves: unknown[] }).moves
      : []
  return source.slice(0, 500).map((item) => {
    const value = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const category = ROOT_MOVE_CATEGORIES.some((entry) => entry.id === value.category)
      ? (value.category as RootMoveCategory)
      : 'custom'
    const stat = ROOT_STATS.some((entry) => entry.id === value.stat)
      ? (value.stat as RootStat)
      : undefined
    return {
      id: typeof value.id === 'string' && value.id ? value.id : makeId(),
      name: typeof value.name === 'string' ? value.name.slice(0, 160) : '',
      category,
      ...(stat ? { stat } : {}),
      text: typeof value.text === 'string' ? value.text.slice(0, 6000) : ''
    }
  })
}

function serialized(moves: RootMove[]): string {
  return JSON.stringify({ version: 1, moves })
}

function sheetMoveId(move: RootMove): string {
  return `sheet_${move.id}`
}

export function RootMovesPanel({
  state,
  onChange,
  sheetState,
  onSheetChange,
  onSendChat,
  onClose,
  storageKey
}: RootMovesPanelProps) {
  const [moves, setMoves] = useState<RootMove[]>(() => normalize(state))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<RootMoveCategory | 'all'>('all')
  const [added, setAdded] = useState<string | null>(null)
  const [lastRoll, setLastRoll] = useState('')
  const lastSyncRef = useRef(serialized(normalize(state)))
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const next = normalize(state)
    const json = serialized(next)
    if (json === lastSyncRef.current) return
    lastSyncRef.current = json
    setMoves(next)
  }, [state])

  const commit = (next: RootMove[]): void => {
    setMoves(next)
    lastSyncRef.current = serialized(next)
    onChange?.({ version: 1, moves: next })
  }

  const updateMove = (id: string, patch: Partial<RootMove>): void => {
    commit(moves.map((move) => (move.id === id ? { ...move, ...patch } : move)))
  }

  const addMove = (): void => {
    const next: RootMove = { id: makeId(), name: 'Новый ход', category: 'custom', text: '' }
    commit([...moves, next])
  }

  const removeMove = (id: string): void => {
    commit(moves.filter((move) => move.id !== id))
  }

  const addToSheet = (move: RootMove): void => {
    if (!onSheetChange) return
    const base =
      sheetState && typeof sheetState === 'object'
        ? { ...(sheetState as Record<string, unknown>) }
        : {}
    const existing = Array.isArray(base.moves) ? base.moves : []
    if (existing.some((item) => item && typeof item === 'object' && (item as { id?: string }).id === sheetMoveId(move))) {
      setAdded(move.id)
      return
    }
    const nextMoves = [
      ...existing,
      {
        id: sheetMoveId(move),
        name: move.name || 'Ход',
        text: move.text
      }
    ]
    onSheetChange({ ...base, moves: nextMoves })
    setAdded(move.id)
    window.setTimeout(() => setAdded((current) => (current === move.id ? null : current)), 1800)
  }

  const rollMove = (move: RootMove): void => {
    if (!move.stat) return
    const result = rollRootMove({ stat: move.stat })
    const text = `${move.name ? `${move.name}: ` : ''}${formatRootRoll(result)}`
    setLastRoll(text)
    onSendChat(text)
  }

  const exportMoves = (): void => {
    const blob = new Blob([JSON.stringify({ version: 1, moves }, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'root-moves.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importMoves = async (file: File): Promise<void> => {
    try {
      const parsed = JSON.parse(await file.text())
      const imported = normalize(parsed)
      const known = new Set(moves.map((move) => move.id))
      const merged = [...moves, ...imported.filter((move) => !known.has(move.id))]
      commit(merged)
    } catch {
      setLastRoll('Не удалось прочитать JSON')
    }
  }

  const visible = moves.filter((move) => {
    if (category !== 'all' && move.category !== category) return false
    const query = search.trim().toLowerCase()
    return !query || `${move.name} ${move.text}`.toLowerCase().includes(query)
  })

  return (
    <FloatingPanel
      title="Корни — ходы"
      storageKey={storageKey}
      defaultPosition={{ x: 360, y: 70 }}
      width={760}
      defaultHeight={650}
      resizable
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию или тексту"
            className="min-w-40 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-emerald-400/60"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as RootMoveCategory | 'all')}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-200 outline-none"
          >
            <option value="all">Все категории</option>
            {ROOT_MOVE_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addMove}
            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            + ход
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="rounded-md border border-white/15 px-2 py-1.5 text-[10px] text-gray-300 hover:bg-white/10"
          >
            Импорт
          </button>
          <button
            type="button"
            onClick={exportMoves}
            className="rounded-md border border-white/15 px-2 py-1.5 text-[10px] text-gray-300 hover:bg-white/10"
          >
            Экспорт
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importMoves(file)
              event.target.value = ''
            }}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-xs text-gray-500">
              Пока нет ходов. Нажмите «+ ход» или импортируйте JSON.
            </div>
          ) : (
            visible.map((move) => {
              const isAdded = added === move.id
              return (
                <div key={move.id} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                  <div className="grid grid-cols-[1fr_150px_145px] gap-1.5">
                    <input
                      value={move.name}
                      onChange={(event) => updateMove(move.id, { name: event.target.value })}
                      placeholder="Название хода"
                      className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs font-semibold text-gray-100 outline-none focus:border-emerald-400/60"
                    />
                    <select
                      value={move.category}
                      onChange={(event) =>
                        updateMove(move.id, { category: event.target.value as RootMoveCategory })
                      }
                      className="rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-[10px] text-gray-300 outline-none"
                    >
                      {ROOT_MOVE_CATEGORIES.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={move.stat ?? ''}
                      onChange={(event) =>
                        updateMove(move.id, {
                          stat: (event.target.value || undefined) as RootStat | undefined
                        })
                      }
                      className="rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-[10px] text-gray-300 outline-none"
                    >
                      <option value="">без броска</option>
                      {ROOT_STATS.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={move.text}
                    onChange={(event) => updateMove(move.id, { text: event.target.value })}
                    rows={2}
                    placeholder="Текст хода и его эффект"
                    className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] leading-relaxed text-gray-200 outline-none focus:border-emerald-400/60"
                  />

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-wide text-gray-600">
                      {rootMoveCategoryLabel(move.category)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToSheet(move)}
                      disabled={!onSheetChange}
                      className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-30"
                    >
                      {isAdded ? 'Добавлено' : 'В лист'}
                    </button>
                    <button
                      type="button"
                      onClick={() => rollMove(move)}
                      disabled={!move.stat}
                      className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-gray-300 hover:bg-white/10 disabled:opacity-30"
                    >
                      <DiceIcon size={12} />
                      Бросок
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMove(move.id)}
                      className="ml-auto text-[10px] text-gray-600 hover:text-red-300"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {lastRoll && (
          <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-100">
            {lastRoll}
          </div>
        )}

        <p className="text-[9px] leading-relaxed text-gray-600">
          Библиотека не содержит текстов книги. Добавляйте свои ходы или импортируйте JSON. Ходы из
          библиотеки можно отправлять в лист персонажа.
        </p>
      </div>
    </FloatingPanel>
  )
}
