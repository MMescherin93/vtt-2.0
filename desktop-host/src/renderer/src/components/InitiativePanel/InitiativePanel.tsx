import { useMemo, useState } from 'react'
import type { CombatState, Combatant, Token } from '@vtt/shared'
import { conditionById, rollInitiative, sortCombat, stepTurn } from '@vtt/shared/utils'
import { EyeIcon, EyeOffIcon, FloatingPanel, TrashIcon } from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

function makeId(): string {
  try {
    return `cb_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `cb_${Math.random().toString(36).slice(2, 10)}`
  }
}

function emptyCombat(): CombatState {
  return {
    active: false,
    round: 1,
    turnId: null,
    order: [],
    combatants: [],
    announce: true,
    updatedAt: Date.now()
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Панель Мастера: универсальный трекер инициативы */
export function InitiativePanel() {
  const session = useHostStore((state) => state.session)
  const setCombat = useHostStore((state) => state.setCombat)
  const sendChat = useHostStore((state) => state.sendChat)
  const setSelectedToken = useHostStore((state) => state.setSelectedToken)
  const toggleModulePanel = useHostStore((state) => state.toggleModulePanel)

  const [addTokenId, setAddTokenId] = useState('')
  const [manualName, setManualName] = useState('')

  const combat = session?.combat ?? emptyCombat()
  const tokens = session?.tokens ?? []
  const tokenById = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens])
  const combatantById = useMemo(
    () => new Map(combat.combatants.map((combatant) => [combatant.id, combatant])),
    [combat.combatants]
  )

  if (!session) return null

  const commit = (next: CombatState): void => {
    void setCombat({ ...next, updatedAt: Date.now() })
  }

  const tokenOf = (combatant: Combatant): Token | null =>
    combatant.tokenId ? (tokenById.get(combatant.tokenId) ?? null) : null

  const isHidden = (combatant: Combatant): boolean =>
    combatant.hidden || Boolean(tokenOf(combatant)?.hidden)

  const announceTurn = (state: CombatState): void => {
    if (!state.announce || !state.turnId) return
    const current = state.combatants.find((combatant) => combatant.id === state.turnId)
    if (!current) return
    const name = isHidden(current) ? 'Мастер' : current.name
    void sendChat(`Раунд ${state.round} · ход ${name}`)
  }

  const addTokenCombatant = (token: Token): void => {
    if (combat.combatants.some((combatant) => combatant.tokenId === token.id)) return
    const combatant: Combatant = {
      id: makeId(),
      tokenId: token.id,
      name: token.name,
      initiative: 0,
      bonus: 0,
      tiebreak: Math.floor(Math.random() * 1000),
      hidden: token.hidden,
      defeated: false
    }
    commit({
      ...combat,
      combatants: [...combat.combatants, combatant],
      order: [...combat.order, combatant.id]
    })
  }

  const addSelectedToken = (): void => {
    const token = tokenById.get(addTokenId)
    if (!token) return
    addTokenCombatant(token)
    setAddTokenId('')
  }

  const addAll = (): void => {
    const additions = tokens
      .filter((token) => !combat.combatants.some((combatant) => combatant.tokenId === token.id))
      .map<Combatant>((token) => ({
        id: makeId(),
        tokenId: token.id,
        name: token.name,
        initiative: 0,
        bonus: 0,
        tiebreak: Math.floor(Math.random() * 1000),
        hidden: token.hidden,
        defeated: false
      }))
    if (additions.length === 0) return
    commit({
      ...combat,
      combatants: [...combat.combatants, ...additions],
      order: [...combat.order, ...additions.map((combatant) => combatant.id)]
    })
  }

  const addManual = (): void => {
    const name = manualName.trim()
    if (!name) return
    const combatant: Combatant = {
      id: makeId(),
      tokenId: null,
      name: name.slice(0, 80),
      initiative: 0,
      bonus: 0,
      tiebreak: Math.floor(Math.random() * 1000),
      hidden: false,
      defeated: false
    }
    commit({
      ...combat,
      combatants: [...combat.combatants, combatant],
      order: [...combat.order, combatant.id]
    })
    setManualName('')
  }

  const updateCombatant = (id: string, patch: Partial<Combatant>): void => {
    commit({
      ...combat,
      combatants: combat.combatants.map((combatant) =>
        combatant.id === id ? { ...combatant, ...patch } : combatant
      )
    })
  }

  const remove = (id: string): void => {
    const order = combat.order.filter((item) => item !== id)
    commit({
      ...combat,
      combatants: combat.combatants.filter((combatant) => combatant.id !== id),
      order,
      turnId: combat.turnId === id ? (order[0] ?? null) : combat.turnId
    })
  }

  const move = (id: string, direction: -1 | 1): void => {
    const index = combat.order.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= combat.order.length) return
    const order = [...combat.order]
    const [item] = order.splice(index, 1)
    if (!item) return
    order.splice(target, 0, item)
    commit({ ...combat, order })
  }

  const rollAll = (): void => {
    commit(
      sortCombat({
        ...combat,
        combatants: combat.combatants.map((combatant) => ({
          ...combatant,
          initiative: rollInitiative(combatant.bonus),
          tiebreak: Math.floor(Math.random() * 1000)
        }))
      })
    )
  }

  const start = (): void => {
    if (combat.order.length === 0) return
    const next = {
      ...combat,
      active: true,
      round: 1,
      turnId: combat.order[0]!,
      updatedAt: Date.now()
    }
    commit(next)
    announceTurn(next)
  }

  const next = (): void => {
    if (!combat.active) return
    const next = stepTurn(combat, 1)
    commit(next)
    announceTurn(next)
  }

  const previous = (): void => {
    if (!combat.active) return
    const next = stepTurn(combat, -1)
    commit(next)
    announceTurn(next)
  }

  const end = (): void => {
    commit({ ...combat, active: false, turnId: null })
  }

  const newFight = (): void => {
    commit({ ...emptyCombat(), announce: combat.announce })
  }

  const current = combat.turnId ? combatantById.get(combat.turnId) : null
  const currentLabel = current
    ? `${isHidden(current) ? 'Мастер' : current.name}`
    : combat.active
      ? 'ход не выбран'
      : 'бой не начат'

  return (
    <FloatingPanel
      title={`Инициатива · раунд ${combat.round}`}
      defaultPosition={{ x: 320, y: 96 }}
      storageKey="vtt.gm.panel.initiative"
      width={410}
      onClose={() => toggleModulePanel('initiative', false)}
    >
      <div className="space-y-2.5 p-3">
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                {combat.active ? 'сейчас ходит' : 'бой'}
              </div>
              <div className="truncate text-sm font-semibold text-gray-100">{currentLabel}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={previous}
                disabled={!combat.active}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!combat.active}
                className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={start}
              disabled={combat.active || combat.order.length === 0}
              className="flex-1 rounded-md border border-white/10 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              Начать бой
            </button>
            <button
              type="button"
              onClick={end}
              disabled={!combat.active}
              className="flex-1 rounded-md border border-white/10 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              Завершить
            </button>
            <button
              type="button"
              onClick={newFight}
              className="flex-1 rounded-md border border-white/10 py-1 text-[11px] text-gray-300 transition hover:bg-white/10"
            >
              Новый бой
            </button>
          </div>
        </div>

        <div className="flex gap-1">
          <select
            value={addTokenId}
            onChange={(event) => setAddTokenId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-gray-200"
          >
            <option value="">— токен —</option>
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addSelectedToken}
            disabled={!addTokenId}
            className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-30"
          >
            + Добавить
          </button>
          <button
            type="button"
            onClick={addAll}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10"
            title="Добавить всех токенов"
          >
            Все
          </button>
        </div>

        <div className="flex gap-1">
          <input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addManual()
            }}
            placeholder="Имя без токена"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-200 outline-none focus:border-indigo-400/60"
          />
          <button
            type="button"
            onClick={addManual}
            disabled={!manualName.trim()}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          >
            Вручную
          </button>
        </div>

        <div className="max-h-[46vh] space-y-1 overflow-y-auto pr-0.5">
          {combat.order.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
              Добавьте токены или бойцов вручную
            </p>
          )}

          {combat.order.map((id, index) => {
            const combatant = combatantById.get(id)
            if (!combatant) return null
            const token = tokenOf(combatant)
            const active = combat.active && combat.turnId === id
            const hp = token?.stats
              ? `${token.stats.hp}/${token.stats.hpMax}`
              : token?.hpPercent !== undefined
                ? `${Math.round(token.hpPercent * 100)}%`
                : '—'
            const conditions = token?.conditions
              .map((conditionId) => conditionById(conditionId))
              .filter(Boolean)
              .slice(0, 5)

            return (
              <div
                key={id}
                className={`flex items-center gap-1.5 rounded-lg border px-1.5 py-1 ${
                  active ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/5 bg-black/20'
                }`}
              >
                <input
                  value={combatant.initiative}
                  inputMode="numeric"
                  onChange={(event) =>
                    updateCombatant(id, {
                      initiative: clampInt(Number(event.target.value) || 0, -999, 9999)
                    })
                  }
                  className="w-10 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-xs font-semibold text-gray-100"
                  aria-label="Инициатива"
                />
                <input
                  value={combatant.bonus}
                  inputMode="numeric"
                  onChange={(event) =>
                    updateCombatant(id, {
                      bonus: clampInt(Number(event.target.value) || 0, -99, 99)
                    })
                  }
                  className="w-8 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-[10px] text-gray-400"
                  title="Бонус к инициативе"
                  aria-label="Бонус"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (token) setSelectedToken(token.id)
                  }}
                  className={`min-w-0 flex-1 truncate text-left text-xs ${
                    combatant.defeated ? 'text-gray-600 line-through' : 'text-gray-200'
                  }`}
                  title={token ? 'Выбрать токен' : combatant.name}
                >
                  {combatant.name}
                </button>
                <span className="w-14 shrink-0 text-right text-[10px] text-gray-500">{hp}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateCombatant(id, {
                      initiative: rollInitiative(combatant.bonus),
                      tiebreak: Math.floor(Math.random() * 1000)
                    })
                  }
                  className="w-5 text-center text-[11px] text-gray-600 hover:text-indigo-300"
                  title="Бросить инициативу"
                >
                  🎲
                </button>
                <button
                  type="button"
                  onClick={() => updateCombatant(id, { defeated: !combatant.defeated })}
                  className={`w-5 text-center text-[11px] ${
                    combatant.defeated ? 'text-red-400' : 'text-gray-600 hover:text-gray-300'
                  }`}
                  title="Выбыл"
                >
                  ☠
                </button>
                <button
                  type="button"
                  onClick={() => updateCombatant(id, { hidden: !combatant.hidden })}
                  className="flex w-5 items-center justify-center text-gray-500 hover:text-gray-200"
                  title={combatant.hidden ? 'Скрыт от игроков' : 'Виден игрокам'}
                >
                  {combatant.hidden ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
                </button>
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    disabled={index === 0}
                    className="text-[9px] leading-none text-gray-600 hover:text-gray-200 disabled:opacity-20"
                    title="Выше"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    disabled={index === combat.order.length - 1}
                    className="text-[9px] leading-none text-gray-600 hover:text-gray-200 disabled:opacity-20"
                    title="Ниже"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-600 hover:text-red-300"
                  title="Убрать из боя"
                >
                  <TrashIcon size={12} />
                </button>
                {conditions && conditions.length > 0 && (
                  <span className="ml-0.5 flex gap-0.5">
                    {conditions.map((condition) => (
                      <span
                        key={condition!.id}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: condition!.color }}
                        title={condition!.label}
                      />
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1 border-t border-white/5 pt-2">
          <button
            type="button"
            onClick={rollAll}
            disabled={combat.combatants.length === 0}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          >
            🎲 Бросить всем
          </button>
          <button
            type="button"
            onClick={() => commit(sortCombat(combat))}
            disabled={combat.combatants.length === 0}
            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          >
            Сортировать
          </button>
          <label className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
            <input
              type="checkbox"
              checked={combat.announce}
              onChange={(event) => commit({ ...combat, announce: event.target.checked })}
            />
            в чат
          </label>
        </div>
      </div>
    </FloatingPanel>
  )
}
