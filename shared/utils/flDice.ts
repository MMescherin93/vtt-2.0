import type { FlDie, FlRollRequest, FlRollResult } from '../types/fl'

export type RandomSource = () => number

function die(random: RandomSource): number {
  return Math.min(6, Math.max(1, Math.floor(random() * 6) + 1))
}

function normalizeCount(value: number): number {
  return Math.max(0, Math.min(30, Math.floor(value) || 0))
}

function countDice(dice: FlDie[]): Pick<FlRollResult, 'successes' | 'baseBanes' | 'skillBanes' | 'gearBanes'> {
  let successes = 0
  let baseBanes = 0
  let skillBanes = 0
  let gearBanes = 0
  for (const item of dice) {
    if (item.value === 6) {
      successes += item.negative ? -1 : 1
      continue
    }
    if (item.value !== 1) continue
    if (item.type === 'base') baseBanes += 1
    else if (item.type === 'gear') gearBanes += 1
    else skillBanes += 1
  }
  return { successes, baseBanes, skillBanes, gearBanes }
}

/** Собрать пул и бросить его. Модификаторы добавляют красные/минус-кубы. */
export function rollFlPool(request: FlRollRequest, random: RandomSource = Math.random): FlRollResult {
  const modifier = Math.trunc(request.modifier ?? 0)
  const help = normalizeCount(request.help ?? 0)
  const base = normalizeCount(request.base)
  const skill = normalizeCount(request.skill) + Math.max(0, modifier) + help
  const gear = normalizeCount(request.gear)
  const negative = Math.max(0, -modifier)

  const dice: FlDie[] = []
  for (let index = 0; index < base; index += 1) {
    dice.push({ type: 'base', value: die(random) })
  }
  for (let index = 0; index < skill; index += 1) {
    dice.push({ type: 'skill', value: die(random) })
  }
  for (let index = 0; index < gear; index += 1) {
    dice.push({ type: 'gear', value: die(random) })
  }
  for (let index = 0; index < negative; index += 1) {
    dice.push({ type: 'skill', value: die(random), negative: true })
  }

  return {
    dice,
    ...countDice(dice),
    pushed: false,
    ...(request.difficulty !== undefined ? { difficulty: request.difficulty } : {})
  }
}

/** Толчок: перебрасываются все грани, кроме 1 и 6. Один раз за бросок. */
export function pushFlRoll(
  request: FlRollRequest,
  previous: FlRollResult,
  random: RandomSource = Math.random
): FlRollResult {
  if (previous.pushed) return previous
  const dice = previous.dice.map((item) =>
    item.value > 1 && item.value < 6 ? { ...item, value: die(random) } : { ...item }
  )
  return {
    dice,
    ...countDice(dice),
    pushed: true,
    ...(request.difficulty !== undefined ? { difficulty: request.difficulty } : {})
  }
}

export function formatFlRoll(result: FlRollResult): string {
  const groups: Record<FlDie['type'], number> = { base: 0, skill: 0, gear: 0 }
  for (const item of result.dice) groups[item.type] += 1
  const total = result.dice.length
  const banes = result.baseBanes + result.skillBanes + result.gearBanes
  const difficulty =
    result.difficulty !== undefined && result.difficulty > 0
      ? result.successes >= result.difficulty
        ? ` · нужно ${result.difficulty}: успех`
        : ` · нужно ${result.difficulty}: не хватает ${result.difficulty - result.successes}`
      : ''
  return `🎲 Запретные земли: ${total} к. (б ${groups.base}, н ${groups.skill}, сн ${groups.gear}) — ${result.successes} усп., ${banes} бан${difficulty}${
    result.pushed ? ' · после толчка' : ''
  }`
}

/** Расшифровка банов для применения к листу. */
export function flBanesSummary(result: FlRollResult): string {
  const parts: string[] = []
  if (result.baseBanes > 0) parts.push(`атрибут −${result.baseBanes} и Воля +${result.baseBanes}`)
  if (result.gearBanes > 0) parts.push(`снаряжение −${result.gearBanes}`)
  if (result.skillBanes > 0) parts.push(`навык: ${result.skillBanes} бан (без урона)`)
  return parts.join('; ')
}
