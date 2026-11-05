import type { FlDie, FlRollRequest, FlRollResult } from '../types/fl'

export type RandomSource = () => number

function die(random: RandomSource, sides = 6): number {
  return Math.min(sides, Math.max(1, Math.floor(random() * sides) + 1))
}

export function flDieSuccesses(item: FlDie): number {
  if (item.type === 'base' || item.type === 'skill' || item.type === 'gear') {
    return item.value === 6 ? 1 : 0
  }
  if (item.value >= 12) return 4
  if (item.value >= 10) return 3
  if (item.value >= 8) return 2
  if (item.value >= 6) return 1
  return 0
}

function isExtra(item: FlDie): boolean {
  return item.type === 'd8' || item.type === 'd10' || item.type === 'd12'
}

function normalizeCount(value: number): number {
  return Math.max(0, Math.min(30, Math.floor(value) || 0))
}

function countDice(
  dice: FlDie[]
): Pick<FlRollResult, 'successes' | 'baseBanes' | 'skillBanes' | 'gearBanes'> {
  let successes = 0
  let baseBanes = 0
  const skillBanes = 0
  let gearBanes = 0
  for (const item of dice) {
    const successesOnDie = flDieSuccesses(item)
    if (successesOnDie > 0) {
      successes += item.negative ? -successesOnDie : successesOnDie
      continue
    }
    // 1 на красных, d8, d10 и d12 не является баном.
    if (item.value !== 1 || item.type === 'skill' || isExtra(item)) {
      continue
    }
    if (item.type === 'base') baseBanes += 1
    else if (item.type === 'gear') gearBanes += 1
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
  for (let index = 0; index < normalizeCount(request.d8 ?? 0); index += 1) {
    dice.push({ type: 'd8', value: die(random, 8) })
  }
  for (let index = 0; index < normalizeCount(request.d10 ?? 0); index += 1) {
    dice.push({ type: 'd10', value: die(random, 10) })
  }
  for (let index = 0; index < normalizeCount(request.d12 ?? 0); index += 1) {
    dice.push({ type: 'd12', value: die(random, 12) })
  }

  return {
    dice,
    ...countDice(dice),
    pushed: false,
    ...(request.difficulty !== undefined ? { difficulty: request.difficulty } : {})
  }
}

/** Рискнуть: перебрасываются все кубы, кроме 6; на красных, d8/d10/d12 — ещё и 1. */
export function pushFlRoll(
  request: FlRollRequest,
  previous: FlRollResult,
  random: RandomSource = Math.random
): FlRollResult {
  if (previous.pushed) return previous
  const dice = previous.dice.map((item) => {
    const keepOne = item.type === 'base' || item.type === 'gear'
    const reroll = item.value !== 6 && (!keepOne || item.value !== 1)
    if (!reroll) return { ...item }
    const sides = item.type === 'd8' ? 8 : item.type === 'd10' ? 10 : item.type === 'd12' ? 12 : 6
    return { ...item, value: die(random, sides) }
  })
  return {
    dice,
    ...countDice(dice),
    pushed: true,
    ...(request.difficulty !== undefined ? { difficulty: request.difficulty } : {})
  }
}

export function formatFlRoll(result: FlRollResult): string {
  const groups: Record<FlDie['type'], number> = { base: 0, skill: 0, gear: 0, d8: 0, d10: 0, d12: 0 }
  for (const item of result.dice) groups[item.type] += 1
  const total = result.dice.length
  const banes = result.baseBanes + result.skillBanes + result.gearBanes
  const extra =
    groups.d8 || groups.d10 || groups.d12
      ? ` · d8 ${groups.d8}, d10 ${groups.d10}, d12 ${groups.d12}`
      : ''
  const difficulty =
    result.difficulty !== undefined && result.difficulty > 0
      ? result.successes >= result.difficulty
        ? ` · нужно ${result.difficulty}: успех`
        : ` · нужно ${result.difficulty}: не хватает ${result.difficulty - result.successes}`
      : ''
  return `🎲 Запретные земли: ${total} к. (б ${groups.base}, н ${groups.skill}, сн ${groups.gear}${extra}) — ${result.successes} усп., ${banes} бан${difficulty}${
    result.pushed ? ' · после риска' : ''
  }`
}

/** Расшифровка банов для применения к листу. */
export function flBanesSummary(result: FlRollResult): string {
  const parts: string[] = []
  if (result.baseBanes > 0) parts.push(`атрибут −${result.baseBanes} и Воля +${result.baseBanes}`)
  if (result.gearBanes > 0) parts.push(`снаряжение −${result.gearBanes}`)
  return parts.join('; ')
}
