import type { CombatState, Combatant } from '../types/combat'
import type { Token } from '../types/token'

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** Приводит бой из JSON/сокета к безопасному состоянию */
export function normalizeCombat(raw: unknown): CombatState | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<CombatState>
  if (!Array.isArray(source.combatants)) return null

  const seen = new Set<string>()
  const combatants: Combatant[] = []
  for (const item of source.combatants.slice(0, 100)) {
    if (!item || typeof item !== 'object') continue
    const id = typeof item.id === 'string' && item.id ? item.id.slice(0, 64) : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    combatants.push({
      id,
      tokenId: typeof item.tokenId === 'string' && item.tokenId ? item.tokenId : null,
      name: (typeof item.name === 'string' ? item.name.trim().slice(0, 80) : '') || 'Без имени',
      initiative: clampInt(item.initiative, -999, 9999, 0),
      bonus: clampInt(item.bonus, -99, 99, 0),
      tiebreak: clampInt(item.tiebreak, 0, 1_000_000, 0),
      hidden: Boolean(item.hidden),
      defeated: Boolean(item.defeated)
    })
  }

  const combatantIds = new Set(combatants.map((combatant) => combatant.id))
  const order: string[] = []
  if (Array.isArray(source.order)) {
    for (const value of source.order) {
      if (typeof value === 'string' && combatantIds.has(value) && !order.includes(value)) {
        order.push(value)
      }
    }
  }
  for (const combatant of combatants) {
    if (!order.includes(combatant.id)) order.push(combatant.id)
  }

  const turnId =
    typeof source.turnId === 'string' && order.includes(source.turnId) ? source.turnId : null

  return {
    active: Boolean(source.active),
    round: clampInt(source.round, 1, 999, 1),
    turnId,
    order,
    combatants,
    announce: source.announce !== false,
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now()
  }
}

/** Версия боя для игроков: без скрытых бойцов и их имён */
export function playerCombat(combat: CombatState | null, tokens: Token[] = []): CombatState | null {
  if (!combat) return null
  const hiddenTokenIds = new Set(tokens.filter((token) => token.hidden).map((token) => token.id))
  const visible = combat.combatants.filter(
    (combatant) =>
      !combatant.hidden && (!combatant.tokenId || !hiddenTokenIds.has(combatant.tokenId))
  )
  const visibleIds = new Set(visible.map((combatant) => combatant.id))
  const turnHidden = Boolean(combat.turnId && !visibleIds.has(combat.turnId))

  return {
    ...combat,
    combatants: visible,
    order: combat.order.filter((id) => visibleIds.has(id)),
    turnId: combat.turnId && visibleIds.has(combat.turnId) ? combat.turnId : null,
    turnHidden
  }
}

function withTurn(combat: CombatState, turnId: string | null): CombatState {
  return { ...combat, turnId, updatedAt: Date.now() }
}

/** Следующий/предыдущий ход с переходом через границу раунда */
export function stepTurn(combat: CombatState, direction: 1 | -1): CombatState {
  if (!combat.active || combat.order.length === 0) return combat
  const currentIndex = combat.turnId ? combat.order.indexOf(combat.turnId) : -1

  if (direction === 1) {
    if (currentIndex < 0) return withTurn(combat, combat.order[0]!)
    if (currentIndex >= combat.order.length - 1) {
      return {
        ...withTurn(combat, combat.order[0]!),
        round: Math.min(999, combat.round + 1)
      }
    }
    return withTurn(combat, combat.order[currentIndex + 1]!)
  }

  if (currentIndex <= 0) {
    return {
      ...withTurn(combat, combat.order[combat.order.length - 1]!),
      round: Math.max(1, combat.round - 1)
    }
  }
  return withTurn(combat, combat.order[currentIndex - 1]!)
}

/** Сортировка по инициативе (по убыванию), затем tiebreak */
export function sortCombat(combat: CombatState): CombatState {
  const byId = new Map(combat.combatants.map((combatant) => [combatant.id, combatant]))
  const order = [...combat.order].sort((left, right) => {
    const a = byId.get(left)
    const b = byId.get(right)
    if (!a || !b) return 0
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    return b.tiebreak - a.tiebreak
  })
  return { ...combat, order, updatedAt: Date.now() }
}

/** Бросок d20 + бонус */
export function rollInitiative(bonus = 0): number {
  return Math.floor(Math.random() * 20) + 1 + bonus
}

/** Убирает бойца, привязанного к удалённому токену */
export function removeTokenFromCombat(combat: CombatState, tokenId: string): CombatState {
  const removedIds = new Set(
    combat.combatants.filter((combatant) => combatant.tokenId === tokenId).map((c) => c.id)
  )
  if (removedIds.size === 0) return combat

  const combatants = combat.combatants.filter((combatant) => !removedIds.has(combatant.id))
  const order = combat.order.filter((id) => !removedIds.has(id))
  let turnId = combat.turnId
  if (turnId && removedIds.has(turnId)) {
    turnId = order[0] ?? null
  }
  if (order.length === 0) turnId = null

  return { ...combat, combatants, order, turnId, updatedAt: Date.now() }
}
