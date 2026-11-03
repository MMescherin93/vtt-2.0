import { useMemo, useState } from 'react'
import type { DiceRoll } from '../../types/session'
import { DICE_TYPES, MAX_DICE_PER_ROLL } from '../../utils/dice'
import { FloatingPanel } from '../FloatingPanel'
import { DiceIcon } from '../icons'
import { formatMessageTime } from './ChatPanel'

export interface DicePanelProps {
  onRoll: (dice: string[]) => void
  history: DiceRoll[]
  disabled?: boolean
  onClose?: () => void
  storageKey?: string
  defaultPosition?: { x: number; y: number }
}

/** Интерфейс бросков кубиков d4…d100 с историей (ТЗ, п.6) */
export function DicePanel({
  onRoll,
  history,
  disabled = false,
  onClose,
  storageKey = 'vtt.panel.dice',
  defaultPosition = { x: 24, y: 24 }
}: DicePanelProps) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const dice = useMemo(
    () => DICE_TYPES.flatMap((die) => Array.from({ length: counts[die] ?? 0 }, () => String(die))),
    [counts]
  )

  const change = (die: string, delta: number): void => {
    setCounts((current) => {
      const next = Math.min(MAX_DICE_PER_ROLL, Math.max(0, (current[die] ?? 0) + delta))
      return { ...current, [die]: next }
    })
  }

  const roll = (): void => {
    if (dice.length === 0 || disabled) return
    onRoll(dice)
    setCounts({})
  }

  const recent = history.slice(-8).reverse()

  return (
    <FloatingPanel
      title="Кубики"
      icon={<DiceIcon size={16} />}
      onClose={onClose}
      storageKey={storageKey}
      defaultPosition={defaultPosition}
      width={300}
    >
      <div className="p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {DICE_TYPES.map((die) => {
            const count = counts[die] ?? 0
            return (
              <div
                key={die}
                className={`rounded-lg border p-1 text-center transition ${
                  count > 0
                    ? 'border-indigo-400/60 bg-indigo-500/15'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => change(die, 1)}
                  disabled={disabled}
                  className="w-full text-sm font-semibold text-gray-100 transition hover:text-indigo-300 disabled:opacity-40"
                  title={`Добавить ${die}`}
                >
                  {die}
                </button>
                <div className="flex items-center justify-between px-0.5 text-[11px] text-gray-400">
                  <button
                    type="button"
                    onClick={() => change(die, -1)}
                    disabled={count === 0}
                    className="h-4 w-4 rounded hover:bg-white/10 disabled:opacity-30"
                    aria-label={`Убрать ${die}`}
                  >
                    −
                  </button>
                  <span className={count > 0 ? 'text-indigo-200' : ''}>{count}</span>
                  <button
                    type="button"
                    onClick={() => change(die, 1)}
                    disabled={disabled}
                    className="h-4 w-4 rounded hover:bg-white/10 disabled:opacity-30"
                    aria-label={`Добавить ${die}`}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={roll}
          disabled={disabled || dice.length === 0}
          className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dice.length > 0 ? `Бросить ${dice.length} к.` : 'Выберите кубики'}
        </button>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            История бросков
          </div>
          {recent.length === 0 ? (
            <p className="py-2 text-center text-xs text-gray-500">Бросков ещё не было</p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {recent.map((roll) => (
                <li
                  key={roll.id}
                  className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-gray-300">{roll.userName}</span>
                    <span className="shrink-0 font-semibold text-indigo-300">{roll.total}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
                    <span className="truncate">
                      {roll.dice.join(' ')} → {roll.results.join(' ')}
                    </span>
                    <span className="shrink-0">{formatMessageTime(roll.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </FloatingPanel>
  )
}
