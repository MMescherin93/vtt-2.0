import { useEffect, useMemo, useState } from 'react'
import type { Token, TokenStats } from '@vtt/shared'
import { CONDITIONS } from '@vtt/shared/utils'
import { FloatingPanel } from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

const VISIBILITY_LABELS: Record<TokenStats['visibility'], string> = {
  full: 'Все видят',
  bar: 'Только полоса',
  hidden: 'Скрыто'
}

function parseStatInput(value: string, current: number): number {
  const text = value.trim().replace(',', '.')
  if (!text) return current
  const delta = /^[+-]\d+$/.test(text) ? Number(text) : null
  if (delta !== null) return current + delta
  if (/^=\d+$/.test(text)) return Number(text.slice(1))
  const number = Number(text)
  return Number.isFinite(number) ? number : current
}

interface Draft {
  hp: string
  hpMax: string
  tempHp: string
  ac: string
}

function draftOf(token: Token | null): Draft {
  return {
    hp: token?.stats ? String(token.stats.hp) : '',
    hpMax: token?.stats ? String(token.stats.hpMax) : '',
    tempHp: token?.stats ? String(token.stats.tempHp) : '',
    ac: token?.stats ? String(token.stats.ac) : ''
  }
}

/** Панель Мастера: HP/AC и состояния выбранного токена */
export function TokenStatsPanel() {
  const session = useHostStore((state) => state.session)
  const selectedTokenId = useHostStore((state) => state.selectedTokenId)
  const setSelectedToken = useHostStore((state) => state.setSelectedToken)
  const updateToken = useHostStore((state) => state.updateToken)
  const toggleModulePanel = useHostStore((state) => state.toggleModulePanel)

  const token = useMemo(
    () => session?.tokens.find((item) => item.id === selectedTokenId) ?? null,
    [session, selectedTokenId]
  )
  const [draft, setDraft] = useState<Draft>(() => draftOf(token))

  useEffect(() => {
    setDraft(draftOf(token))
  }, [token?.id, token?.stats?.hp, token?.stats?.hpMax, token?.stats?.tempHp, token?.stats?.ac])

  if (!session) return null

  const applyStats = (patch: Partial<TokenStats>): void => {
    if (!token) return
    void updateToken({ tokenId: token.id, stats: patch })
  }

  const commitField = (field: keyof Draft): void => {
    if (!token) return
    const current = token.stats ?? { hp: 0, hpMax: 0, tempHp: 0, ac: 0, visibility: 'full' }
    const value = parseStatInput(draft[field], current[field])
    applyStats({ [field]: value } as Partial<TokenStats>)
  }

  const quickHp = (delta: number): void => {
    if (!token?.stats) return
    applyStats({ hp: token.stats.hp + delta })
  }

  const toggleCondition = (conditionId: string): void => {
    if (!token) return
    const next = token.conditions.includes(conditionId)
      ? token.conditions.filter((id) => id !== conditionId)
      : [...token.conditions, conditionId]
    void updateToken({ tokenId: token.id, conditions: next })
  }

  return (
    <FloatingPanel
      title="HP/AC и состояния"
      defaultPosition={{ x: 360, y: 96 }}
      storageKey="vtt.gm.panel.stats"
      width={380}
      onClose={() => toggleModulePanel('token-stats', false)}
    >
      <div className="space-y-3 p-3">
        <label className="block text-[11px] uppercase tracking-wide text-gray-500">
          Токен
          <select
            value={token?.id ?? ''}
            onChange={(event) => setSelectedToken(event.target.value || null)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-200"
          >
            <option value="">— выберите токен —</option>
            {session.tokens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.hidden ? ' (скрыт)' : ''}
              </option>
            ))}
          </select>
        </label>

        {!token ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
            Выберите токен в списке или на карте
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['hp', 'HP'],
                  ['hpMax', 'Макс.'],
                  ['tempHp', 'Врем.'],
                  ['ac', 'AC']
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-[10px] uppercase tracking-wide text-gray-500">
                  {label}
                  <input
                    value={draft[field]}
                    inputMode="numeric"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [field]: event.target.value }))
                    }
                    onBlur={() => commitField(field)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitField(field)
                        event.currentTarget.blur()
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-gray-100 outline-none focus:border-indigo-400/60"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => quickHp(delta)}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-[11px] text-gray-300 transition hover:bg-white/10"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void updateToken({ tokenId: token.id, stats: null })}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-400 transition hover:bg-red-500/15 hover:text-red-300"
                title="Сбросить статы"
              >
                Сброс
              </button>
            </div>

            <label className="block text-[11px] uppercase tracking-wide text-gray-500">
              Видимость для игроков
              <select
                value={token.stats?.visibility ?? 'full'}
                onChange={(event) =>
                  applyStats({ visibility: event.target.value as TokenStats['visibility'] })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-gray-200"
              >
                {(Object.keys(VISIBILITY_LABELS) as TokenStats['visibility'][]).map((mode) => (
                  <option key={mode} value={mode}>
                    {VISIBILITY_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>

            {token.hidden && (
              <p className="rounded-md bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200">
                Токен скрыт от игроков — баббл видят только вы
              </p>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">
                  Состояния · {token.conditions.length}
                </span>
                {token.conditions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void updateToken({ tokenId: token.id, conditions: [] })}
                    className="text-[10px] text-gray-500 transition hover:text-red-300"
                  >
                    снять все
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {CONDITIONS.map((condition) => {
                  const active = token.conditions.includes(condition.id)
                  return (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => toggleCondition(condition.id)}
                      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] transition ${
                        active
                          ? 'border-indigo-400/50 bg-indigo-500/15 text-gray-100'
                          : 'border-white/5 bg-black/20 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: condition.color }}
                      />
                      <span className="truncate">{condition.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </FloatingPanel>
  )
}
