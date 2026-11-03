import type { FogOfWarData, FogOp, FogOpInput } from '../types/map'
import { newId } from './ids'

/** Максимальное число операций тумана, хранимых в сессии */
export const MAX_FOG_OPS = 4000

export function createEmptyFog(): FogOfWarData {
  return { covered: true, ops: [] }
}

/** Добавляет операцию тумана, обрезая историю при переполнении */
export function appendFogOp(fog: FogOfWarData, op: FogOpInput): FogOfWarData {
  const withId = { ...op, id: newId('fog') } as FogOp
  const ops = [...fog.ops, withId]
  return { covered: fog.covered, ops: ops.length > MAX_FOG_OPS ? ops.slice(-MAX_FOG_OPS) : ops }
}

/** Приводит присланные данные к безопасному виду (сервер — источник истины) */
export function sanitizeFog(value: unknown): FogOfWarData | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FogOfWarData>
  if (typeof candidate.covered !== 'boolean' || !Array.isArray(candidate.ops)) return null

  const ops: FogOp[] = []
  for (const raw of candidate.ops.slice(-MAX_FOG_OPS)) {
    if (!raw || typeof raw !== 'object') continue
    const op = raw as Partial<FogOp>
    if (op.op !== 'reveal' && op.op !== 'conceal') continue
    if (op.shape === 'rect') {
      const rect = op as Extract<FogOp, { shape: 'rect' }>
      if (![rect.x, rect.y, rect.width, rect.height].every((n) => Number.isFinite(n))) continue
      ops.push({
        id: typeof op.id === 'string' ? op.id : newId('fog'),
        op: op.op,
        shape: 'rect',
        x: rect.x,
        y: rect.y,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height)
      })
    } else if (op.shape === 'stroke') {
      const stroke = op as Extract<FogOp, { shape: 'stroke' }>
      const points = Array.isArray(stroke.points)
        ? stroke.points.filter((n) => Number.isFinite(n))
        : []
      if (points.length < 2) continue
      ops.push({
        id: typeof op.id === 'string' ? op.id : newId('fog'),
        op: op.op,
        shape: 'stroke',
        points,
        size: Math.max(1, Number(stroke.size) || 1)
      })
    }
  }
  return { covered: candidate.covered, ops }
}
