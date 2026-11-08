import { useState } from 'react'
import {
  formatRootRoll,
  ROOT_STATS,
  rollRootMove,
  type RootRollMode,
  type RootRollResult,
  type RootStat
} from '../../utils/rootDice'
import { FloatingPanel } from '../FloatingPanel'
import { DiceIcon } from '../icons'

export interface RootRollPanelProps {
  onSendChat: (text: string) => void
  onClose: () => void
  storageKey?: string
}

const OUTCOME_STYLES: Record<string, string> = {
  '10+': 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  '7-9': 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  '6-': 'border-red-400/40 bg-red-500/10 text-red-200'
}

/** Бросок хода Root RPG: 2d6 + характеристика, 10+ / 7–9 / 6−. */
export function RootRollPanel({ onSendChat, onClose, storageKey }: RootRollPanelProps) {
  const [stat, setStat] = useState<RootStat>('charm')
  const [modifier, setModifier] = useState(0)
  const [mode, setMode] = useState<RootRollMode>('normal')
  const [result, setResult] = useState<RootRollResult | null>(null)

  const roll = (): void => {
    const next = rollRootMove({ stat, modifier, mode })
    setResult(next)
    onSendChat(formatRootRoll(next))
  }

  return (
    <FloatingPanel
      title="Корни — броски"
      storageKey={storageKey}
      defaultPosition={{ x: 460, y: 100 }}
      width={520}
      defaultHeight={390}
      resizable
      onClose={onClose}
    >
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] uppercase tracking-wide text-gray-500">
            Характеристика
            <select
              value={stat}
              onChange={(event) => setStat(event.target.value as RootStat)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm font-semibold text-gray-100 outline-none focus:border-emerald-400/60"
            >
              {ROOT_STATS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[10px] uppercase tracking-wide text-gray-500">
            Модификатор
            <input
              type="number"
              min={-3}
              max={3}
              value={modifier}
              onChange={(event) => setModifier(Math.max(-3, Math.min(3, Number(event.target.value) || 0)))}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-center text-sm font-semibold text-gray-100 outline-none focus:border-emerald-400/60"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          {(
            [
              ['normal', 'Обычный'],
              ['advantage', 'Преимущество'],
              ['disadvantage', 'Помеха']
            ] as Array<[RootRollMode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                mode === id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={roll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-emerald-500"
        >
          <DiceIcon size={16} />
          Бросить 2d6
        </button>

        {result ? (
          <div className={`rounded-lg border p-3 ${OUTCOME_STYLES[result.outcome]}`}>
            <div className="flex flex-wrap items-center gap-2">
              {result.dice.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-black ${
                    result.kept.includes(value)
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/10 text-gray-500 line-through'
                  }`}
                  title={result.kept.includes(value) ? 'взято' : 'отброшено'}
                >
                  {value}
                </span>
              ))}
              <span className="ml-auto text-xs font-semibold">
                {result.kept.join(' + ')}
                {result.modifier === 0
                  ? ''
                  : result.modifier > 0
                    ? ` + ${result.modifier}`
                    : ` − ${Math.abs(result.modifier)}`}{' '}
                = <span className="text-lg font-black">{result.total}</span>
              </span>
            </div>
            <div className="mt-2 text-sm font-black">{result.outcome}</div>
            <p className="mt-1 text-[10px] opacity-80">
              {result.outcome === '10+'
                ? 'Успех. Всё идёт по-твоему.'
                : result.outcome === '7-9'
                  ? 'Успех с осложнением или ценой.'
                  : 'Провал. Последствия и/или урон.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-center text-xs text-gray-500">
            Выберите характеристику и бросьте 2d6. Результат уйдёт в чат.
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-gray-600">
          Корни используют 2d6 + характеристику. 10+ — успех, 7–9 — успех с осложнением, 6− — провал.
          Преимущество/помеха бросают 3d6 и оставляют две лучшие/худшие кости.
        </p>
      </div>
    </FloatingPanel>
  )
}
