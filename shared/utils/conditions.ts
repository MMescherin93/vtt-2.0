/** Каталог состояний токена (id → подпись, цвет, сокращение) */
export interface ConditionDefinition {
  id: string
  label: string
  short: string
  color: string
}

export const CONDITIONS: ConditionDefinition[] = [
  { id: 'blinded', label: 'Ослеплён', short: 'осл', color: '#a3a3a3' },
  { id: 'charmed', label: 'Очарован', short: 'оча', color: '#f472b6' },
  { id: 'deafened', label: 'Оглушён слухом', short: 'слух', color: '#94a3b8' },
  { id: 'frightened', label: 'Испуган', short: 'исп', color: '#c084fc' },
  { id: 'grappled', label: 'Схвачен', short: 'схв', color: '#fb923c' },
  { id: 'incapacitated', label: 'Недееспособен', short: 'нед', color: '#ef4444' },
  { id: 'invisible', label: 'Невидим', short: 'невид', color: '#67e8f9' },
  { id: 'paralyzed', label: 'Парализован', short: 'пара', color: '#facc15' },
  { id: 'petrified', label: 'Окаменел', short: 'окам', color: '#78716c' },
  { id: 'poisoned', label: 'Отравлен', short: 'яд', color: '#22c55e' },
  { id: 'prone', label: 'Сбит с ног', short: 'лёжа', color: '#fdba74' },
  { id: 'restrained', label: 'Опутан', short: 'опут', color: '#f97316' },
  { id: 'stunned', label: 'Ошеломлён', short: 'оше', color: '#fde047' },
  { id: 'unconscious', label: 'Без сознания', short: 'без', color: '#64748b' },
  { id: 'exhaustion', label: 'Истощение', short: 'ист', color: '#a16207' },
  { id: 'concentration', label: 'Концентрация', short: 'конц', color: '#38bdf8' },
  { id: 'burning', label: 'Горит', short: 'огн', color: '#f97316' },
  { id: 'bleeding', label: 'Кровотечение', short: 'кров', color: '#dc2626' },
  { id: 'slowed', label: 'Замедлен', short: 'зам', color: '#818cf8' },
  { id: 'hasted', label: 'Ускорен', short: 'уск', color: '#34d399' }
]

const CONDITION_IDS = new Set(CONDITIONS.map((condition) => condition.id))

export function conditionById(id: string): ConditionDefinition | undefined {
  return CONDITIONS.find((condition) => condition.id === id)
}

/** Оставляет только известные id, без дублей, не больше 12 */
export function sanitizeConditions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const result: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string' || !CONDITION_IDS.has(value)) continue
    if (result.includes(value)) continue
    result.push(value)
    if (result.length >= 12) break
  }
  return result
}
