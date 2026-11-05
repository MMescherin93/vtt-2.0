import { useEffect, useMemo, useState } from 'react'
import { CONDITIONS } from '@vtt/shared/utils'
import { FloatingPanel } from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

const STATE_KEY = 'troika-token-stats'

interface TroikaTokenStats {
  skill: number
  stamina: number
  staminaMax: number
  luck: number
  luckMax: number
  features: string
}

interface TroikaState {
  byToken: Record<string, TroikaTokenStats>
}

interface Draft {
  skill: string
  stamina: string
  staminaMax: string
  luck: string
  luckMax: string
  features: string
}

const EMPTY: TroikaTokenStats = {
  skill: 0,
  stamina: 0,
  staminaMax: 0,
  luck: 0,
  luckMax: 0,
  features: ''
}

function readState(raw: unknown): TroikaState {
  if (!raw || typeof raw !== 'object') return { byToken: {} }
  const source = raw as { byToken?: unknown }
  if (!source.byToken || typeof source.byToken !== 'object') return { byToken: {} }
  const byToken: Record<string, TroikaTokenStats> = {}
  for (const [id, value] of Object.entries(source.byToken as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const item = value as Partial<TroikaTokenStats>
    byToken[id] = {
      skill: Number.isFinite(Number(item.skill)) ? Math.max(0, Number(item.skill)) : 0,
      stamina: Number.isFinite(Number(item.stamina)) ? Math.max(0, Number(item.stamina)) : 0,
      staminaMax: Number.isFinite(Number(item.staminaMax))
        ? Math.max(0, Number(item.staminaMax))
        : 0,
      luck: Number.isFinite(Number(item.luck)) ? Math.max(0, Number(item.luck)) : 0,
      luckMax: Number.isFinite(Number(item.luckMax)) ? Math.max(0, Number(item.luckMax)) : 0,
      features: typeof item.features === 'string' ? item.features.slice(0, 4000) : ''
    }
  }
  return { byToken }
}

function statsOf(state: TroikaState, tokenId: string | undefined): TroikaTokenStats {
  if (!tokenId) return EMPTY
  return state.byToken[tokenId] ?? EMPTY
}

function draftOf(stats: TroikaTokenStats): Draft {
  return {
    skill: String(stats.skill),
    stamina: String(stats.stamina),
    staminaMax: String(stats.staminaMax),
    luck: String(stats.luck),
    luckMax: String(stats.luckMax),
    features: stats.features
  }
}

function numberValue(value: string, fallback: number): number {
  const text = value.trim().replace(',', '.')
  if (!text) return fallback
  const number = Number(text)
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback
}

/** Панель Мастера для «Тройки»: умение, выносливость, удача и особенности. */
export function TroikaStatsPanel() {
  const session = useHostStore((state) => state.session)
  const selectedTokenId = useHostStore((state) => state.selectedTokenId)
  const setSelectedToken = useHostStore((state) => state.setSelectedToken)
  const updateToken = useHostStore((state) => state.updateToken)
  const setExtensionState = useHostStore((state) => state.setExtensionState)
  const toggleModulePanel = useHostStore((state) => state.toggleModulePanel)

  const token = useMemo(
    () => session?.tokens.find((item) => item.id === selectedTokenId) ?? null,
    [session, selectedTokenId]
  )
  const state = useMemo(
    () => readState(session?.extensionState?.[STATE_KEY]),
    [session?.extensionState]
  )
  const stats = statsOf(state, token?.id)
  const [draft, setDraft] = useState<Draft>(() => draftOf(stats))

  useEffect(() => {
    setDraft(draftOf(stats))
  }, [token?.id, stats.skill, stats.stamina, stats.staminaMax, stats.luck, stats.luckMax, stats.features])

  if (!session) return null

  const save = (patch: Partial<TroikaTokenStats>): void => {
    if (!token) return
    const next: TroikaState = {
      ...state,
      byToken: {
        ...state.byToken,
        [token.id]: { ...stats, ...patch }
      }
    }
    void setExtensionState(STATE_KEY, next)
  }

  const commitNumber = (field: keyof Draft): void => {
    const fallback = stats[field as keyof TroikaTokenStats] as number
    save({ [field]: numberValue(draft[field], fallback) } as Partial<TroikaTokenStats>)
  }

  const toggleCondition = (conditionId: string): void => {
    if (!token) return
    const next = token.conditions.includes(conditionId)
      ? token.conditions.filter((id) => id !== conditionId)
      : [...token.conditions, conditionId]
    void updateToken({ tokenId: token.id, conditions: next })
  }

  const NumberField = ({
    field,
    label,
    hint
  }: {
    field: 'skill' | 'stamina' | 'staminaMax' | 'luck' | 'luckMax'
    label: string
    hint?: string
  }) => (
    <label className="block text-[10px] uppercase tracking-wide text-gray-500">
      {label}
      {hint && <span className="ml-1 normal-case tracking-normal text-gray-600">{hint}</span>}
      <input
        value={draft[field]}
        inputMode="numeric"
        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
        onBlur={() => commitNumber(field)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitNumber(field)
            event.currentTarget.blur()
          }
        }}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-gray-100 outline-none focus:border-indigo-400/60"
      />
    </label>
  )

  return (
    <FloatingPanel
      title="Тройка: умение и состояние"
      defaultPosition={{ x: 360, y: 96 }}
      storageKey="vtt.gm.panel.troika-stats"
      width={380}
      onClose={() => toggleModulePanel('troika-token-stats', false)}
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
            <div>
              <NumberField field="skill" label="Умение" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberField field="staminaMax" label="Выносливость" hint="макс." />
              <NumberField field="stamina" label="Выносливость" hint="текущая" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberField field="luckMax" label="Удача" hint="макс." />
              <NumberField field="luck" label="Удача" hint="текущая" />
            </div>

            <label className="block text-[11px] uppercase tracking-wide text-gray-500">
              Особенности
              <textarea
                value={draft.features}
                rows={4}
                maxLength={4000}
                placeholder="Свободный текст: особенности, таланты, заметки…"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, features: event.target.value }))
                }
                onBlur={() => save({ features: draft.features })}
                className="mt-1 w-full resize-y rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs leading-relaxed text-gray-100 outline-none focus:border-indigo-400/60"
              />
            </label>

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
