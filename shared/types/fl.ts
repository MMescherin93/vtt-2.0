/** Тип кубика в пуле «Запретных земель» */
export type FlDieType = 'base' | 'skill' | 'gear' | 'd8' | 'd10' | 'd12'

export interface FlDie {
  type: FlDieType
  value: number
  /** Минус-куб: его успехи вычитаются */
  negative?: boolean
}

export interface FlRollRequest {
  base: number
  skill: number
  gear: number
  /** Дополнительные d8: 6–7 — 1 успех, 8 — 2 успеха, 1 не фиксируется */
  d8?: number
  /** Дополнительные d10: 6–7 — 1, 8–9 — 2, 10 — 3 успеха, 1 не фиксируется */
  d10?: number
  /** Дополнительные d12: 6–7 — 1, 8–9 — 2, 10–11 — 3, 12 — 4 успеха */
  d12?: number
  modifier?: number
  help?: number
  difficulty?: number
  attribute?: string
  skillId?: string
}

export interface FlRollResult {
  dice: FlDie[]
  successes: number
  baseBanes: number
  skillBanes: number
  gearBanes: number
  pushed: boolean
  difficulty?: number
}
