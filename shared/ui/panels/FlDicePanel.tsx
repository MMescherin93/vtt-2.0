import { useState } from 'react'
import type { FlRollResult } from '../../types/fl'
import { flBanesSummary, formatFlRoll, pushFlRoll, rollFlPool } from '../../utils/flDice'
import { FloatingPanel } from '../FloatingPanel'
import { DiceIcon } from '../icons'

export interface FlDicePanelProps {
  onSendChat: (text: string) => void
  onClose: () => void
  storageKey?: string
}

const TYPE_COLORS: Record<string, string> = {
  base: 'border-slate-300 bg-slate-100 text-slate-900',
  skill: 'border-red-400 bg-red-500/90 text-white',
  gear: 'border-zinc-950 bg-zinc-900 text-zinc-100',
  d8: 'border-teal-400 bg-teal-500/90 text-white',
  d12: 'border-violet-400 bg-violet-500/90 text-white'
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 30
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="block text-[10px] uppercase tracking-wide text-gray-500">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-center text-sm font-semibold text-gray-100 outline-none focus:border-indigo-400/60"
      />
    </label>
  )
}

function Die({ item }: { item: FlRollResult['dice'][number] }) {
  const success = item.type === 'd8' || item.type === 'd12' ? item.value >= 6 : item.value === 6
  const skull = (item.type === 'base' || item.type === 'gear') && item.value === 1
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg font-black shadow-md ${
        TYPE_COLORS[item.type] ?? TYPE_COLORS.base
      } ${item.negative ? 'ring-2 ring-fuchsia-400/80' : ''}`}
      title={`${item.type}: ${item.value}${item.negative ? ' (минус)' : ''}`}
    >
      {success ? '⚔' : skull ? '☠' : item.value}
    </span>
  )
}

/** Кубы Forbidden Lands: пул d6, успехи/баны, один push. */
export function FlDicePanel({ onSendChat, onClose, storageKey }: FlDicePanelProps) {
  const [base, setBase] = useState(3)
  const [skill, setSkill] = useState(2)
  const [gear, setGear] = useState(0)
  const [d8, setD8] = useState(0)
  const [d12, setD12] = useState(0)
  const [modifier, setModifier] = useState(0)
  const [help, setHelp] = useState(0)
  const [difficulty, setDifficulty] = useState(0)
  const [result, setResult] = useState<FlRollResult | null>(null)

  const request = () => ({
    base,
    skill,
    gear,
    d8,
    d12,
    modifier,
    help,
    ...(difficulty > 0 ? { difficulty } : {})
  })

  const roll = (): void => {
    const next = rollFlPool(request())
    setResult(next)
    onSendChat(formatFlRoll(next))
  }

  const push = (): void => {
    if (!result || result.pushed) return
    const next = pushFlRoll(request(), result)
    setResult(next)
    const summary = flBanesSummary(next)
    onSendChat(`${formatFlRoll(next)}${summary ? ` · ${summary}` : ''}`)
  }

  return (
    <FloatingPanel
      title="Кубы «Запретных земель»"
      storageKey={storageKey}
      defaultPosition={{ x: 420, y: 90 }}
      width={600}
      defaultHeight={430}
      resizable
      onClose={onClose}
    >
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Базовые (белые)" value={base} onChange={setBase} />
          <Stepper label="Навык (красные)" value={skill} onChange={setSkill} />
          <Stepper label="Снаряжение (чёрные)" value={gear} onChange={setGear} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stepper label="Дополнительные d8" value={d8} onChange={setD8} />
          <Stepper label="Дополнительные d12" value={d12} onChange={setD12} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Модификатор" value={modifier} onChange={setModifier} min={-10} max={10} />
          <Stepper label="Помощь" value={help} onChange={setHelp} min={0} max={3} />
          <Stepper label="Нужно успехов" value={difficulty} onChange={setDifficulty} min={0} max={20} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={roll}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            <DiceIcon size={15} />
            Бросить
          </button>
          <button
            type="button"
            onClick={push}
            disabled={!result || result.pushed}
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-35"
            title="Один раз за бросок: перебросить все кубы, кроме 6; на красных, d8 и d12 — ещё и 1"
          >
            Рискнуть
          </button>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-white/10"
          >
            Сброс
          </button>
          <span className="ml-auto text-[10px] text-gray-500">
            {result?.pushed ? 'риск использован' : 'риск доступен'}
          </span>
        </div>

        {result ? (
          <>
            <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {result.dice.map((item, index) => (
                  <Die key={`${item.type}-${index}`} item={item} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="font-semibold text-gray-100">
                  Успехов: <span className="text-emerald-300">{result.successes}</span>
                </span>
                <span className="text-gray-400">
                  Баны: белые {result.baseBanes} · чёрные {result.gearBanes}
                </span>
                {result.difficulty ? (
                  <span
                    className={
                      result.successes >= result.difficulty ? 'text-emerald-300' : 'text-red-300'
                    }
                  >
                    {result.successes >= result.difficulty
                      ? 'цель достигнута'
                      : `не хватает ${result.difficulty - result.successes}`}
                  </span>
                ) : null}
              </div>
              {result.pushed && (
                <p className="mt-1 text-[10px] leading-relaxed text-amber-200/80">
                  {flBanesSummary(result) || 'Последствий нет'}
                </p>
              )}
            </div>
            <p className="text-[10px] leading-relaxed text-gray-600">
              Белые — атрибут, красные — навык, чёрные — снаряжение. 6 — успех; на d8 и d12
              успех при 6+. 1 на белых/чёрных — бан; на красных, d8 и d12 — нет, их можно
              перебрасывать. Рискнуть можно один раз: 1 на белых снижает атрибут и даёт Волю,
              1 на чёрных ломает снаряжение.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-xs text-gray-500">
            Соберите пул и нажмите «Бросить». После броска можно один раз рискнуть.
          </div>
        )}
      </div>
    </FloatingPanel>
  )
}
