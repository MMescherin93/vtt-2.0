import type { StatsVisibility, TokenStats } from '../types/token'

export function defaultStats(): TokenStats {
  return { hp: 0, hpMax: 0, tempHp: 0, ac: 0, visibility: 'full' }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function visibilityOf(value: unknown, fallback: StatsVisibility): StatsVisibility {
  return value === 'full' || value === 'bar' || value === 'hidden' ? value : fallback
}

/** Санитизация статов с частичным обновлением поверх base */
export function sanitizeStats(raw: unknown, base: TokenStats = defaultStats()): TokenStats {
  const source = raw && typeof raw === 'object' ? (raw as Partial<TokenStats>) : {}
  const hpMax = clampInt(source.hpMax ?? base.hpMax, 0, 9999, base.hpMax)
  return {
    hpMax,
    hp: clampInt(source.hp ?? base.hp, 0, hpMax, Math.min(base.hp, hpMax)),
    tempHp: clampInt(source.tempHp ?? base.tempHp, 0, 999, base.tempHp),
    ac: clampInt(source.ac ?? base.ac, 0, 99, base.ac),
    visibility: visibilityOf(source.visibility, base.visibility)
  }
}

/** Доля HP 0..1 для полосы игрока */
export function hpPercent(stats: TokenStats): number {
  if (stats.hpMax <= 0) return 0
  return Math.max(0, Math.min(1, stats.hp / stats.hpMax))
}

/** Доля временных HP для отдельного сегмента полосы */
export function tempPercent(stats: TokenStats): number {
  if (stats.hpMax <= 0) return 0
  return Math.max(0, Math.min(1, stats.tempHp / stats.hpMax))
}
