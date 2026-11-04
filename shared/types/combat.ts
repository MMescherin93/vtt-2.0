/** Участник боя в трекере инициативы */
export interface Combatant {
  id: string
  /** Привязанный токен; null — ручной участник без токена */
  tokenId: string | null
  name: string
  initiative: number
  /** Бонус к броску инициативы */
  bonus: number
  /** Случайный tiebreak для равных инициатив */
  tiebreak: number
  /** Скрыт от игроков (наследуется от скрытого токена) */
  hidden: boolean
  /** Выбыл из боя */
  defeated: boolean
}

/** Состояние боя (одно активное сражение на сессию) */
export interface CombatState {
  active: boolean
  round: number
  /** id текущего бойца; null — бой не начат/завершён */
  turnId: string | null
  /** Порядок отображения: массив id бойцов */
  order: string[]
  combatants: Combatant[]
  /** Объявлять смену хода в чат */
  announce: boolean
  updatedAt: number
  /** Только для игроков: текущий ход скрыт */
  turnHidden?: boolean
}
