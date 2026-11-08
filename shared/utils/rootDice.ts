export type RootStat = 'charm' | 'cunning' | 'finesse' | 'luck' | 'might'
export type RootRollMode = 'normal' | 'advantage' | 'disadvantage'
export type RootOutcome = '10+' | '7-9' | '6-'

export interface RootRollRequest {
  stat: RootStat
  modifier?: number
  mode?: RootRollMode
}

export interface RootRollResult {
  stat: RootStat
  modifier: number
  mode: RootRollMode
  dice: number[]
  kept: number[]
  total: number
  outcome: RootOutcome
}

export const ROOT_STATS: Array<{ id: RootStat; label: string }> = [
  { id: 'charm', label: 'Обаяние' },
  { id: 'cunning', label: 'Хитрость' },
  { id: 'finesse', label: 'Ловкость' },
  { id: 'luck', label: 'Удача' },
  { id: 'might', label: 'Мощь' }
]

export function rootStatLabel(stat: RootStat): string {
  return ROOT_STATS.find((item) => item.id === stat)?.label ?? stat
}

export function rootOutcome(total: number): RootOutcome {
  if (total >= 10) return '10+'
  if (total >= 7) return '7-9'
  return '6-'
}

function d6(): number {
  return Math.floor(Math.random() * 6) + 1
}

/** 2d6 + stat; advantage/disadvantage roll 3d6 and keep two. */
export function rollRootMove({
  stat,
  modifier = 0,
  mode = 'normal'
}: RootRollRequest): RootRollResult {
  const count = mode === 'normal' ? 2 : 3
  const dice = Array.from({ length: count }, () => d6())
  const sorted = [...dice].sort((a, b) => a - b)
  const kept =
    mode === 'advantage' ? sorted.slice(-2) : mode === 'disadvantage' ? sorted.slice(0, 2) : sorted
  const total = kept.reduce((sum, value) => sum + value, 0) + modifier
  return {
    stat,
    modifier,
    mode,
    dice,
    kept,
    total,
    outcome: rootOutcome(total)
  }
}

export function formatRootRoll(result: RootRollResult): string {
  const mode =
    result.mode === 'advantage' ? ' · преимущество' : result.mode === 'disadvantage' ? ' · помеха' : ''
  const modifier = result.modifier === 0 ? '' : result.modifier > 0 ? ` + ${result.modifier}` : ` − ${Math.abs(result.modifier)}`
  return `Корни · ${rootStatLabel(result.stat)}${mode}: [${result.kept.join(', ')}]${modifier} = ${result.total} — ${result.outcome}`
}
