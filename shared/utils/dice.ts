/** Набор кубиков из ТЗ (п.6) */
export const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

export type DiceType = (typeof DICE_TYPES)[number]

/** Разбирает запись вида 'd20' и возвращает число граней (null — некорректно) */
export function diceSides(dice: string): number | null {
  const match = /^d(\d{1,4})$/i.exec(dice.trim())
  if (!match) return null
  const sides = Number(match[1])
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) return null
  return sides
}

/** Максимум кубиков в одном броске (защита сервера от перегрузки) */
export const MAX_DICE_PER_ROLL = 50

/** Бросок одного кубика: 1..sides */
export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

/** Проверка списка кубиков из запроса клиента */
export function rollDice(dice: string[]): { dice: string[]; results: number[]; total: number } {
  const results = dice.map((die) => {
    const sides = diceSides(die)
    return sides === null ? 0 : rollDie(sides)
  })
  const total = results.reduce((sum, value) => sum + value, 0)
  return { dice, results, total }
}

/** Человекочитаемая строка броска, например «2 × d6 + d20» */
export function formatDice(dice: string[]): string {
  const counts = new Map<string, number>()
  for (const die of dice) counts.set(die, (counts.get(die) ?? 0) + 1)
  return [...counts.entries()]
    .map(([die, count]) => (count > 1 ? `${count}×${die}` : die))
    .join(' + ')
}
