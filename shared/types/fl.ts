/** Тип кубика в пуле «Запретных земель» */
export type FlDieType = 'base' | 'skill' | 'gear' | 'd8' | 'd12'

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
  /** Дополнительные d8: 6+ — успех, 1 не фиксируется */
  d8?: number
  /** Дополнительные d12: 6+ — успех, 1 не фиксируется */
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
