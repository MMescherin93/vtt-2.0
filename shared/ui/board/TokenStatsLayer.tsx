import { Group, Layer, Rect, Text } from 'react-konva'
import type { Session } from '../../types/session'
import type { Token } from '../../types/token'
import { conditionById } from '../../utils/conditions'

export interface TokenStatsLayerProps {
  session: Session
  role: 'gm' | 'player'
  width: number
  height: number
  /** Показывать слой (модуль включён) */
  visible: boolean
}

const BAR_HEIGHT = 9
const BADGE = 21
const BADGE_GAP = 3

function barColor(ratio: number): string {
  if (ratio <= 0) return '#64748b'
  if (ratio <= 0.25) return '#ef4444'
  if (ratio <= 0.5) return '#f59e0b'
  return '#22c55e'
}

function TokenBubble({ token, isGm }: { token: Token; isGm: boolean }) {
  const stats = token.stats
  const hasNumbers = Boolean(stats && stats.hpMax > 0)
  const hasBar = hasNumbers || token.hpPercent !== undefined
  if (!hasBar && token.conditions.length === 0) return null

  const barWidth = Math.max(84, Math.min(220, token.width))
  const ratio = stats && stats.hpMax > 0 ? stats.hp / stats.hpMax : (token.hpPercent ?? 0)
  const temp =
    stats && stats.hpMax > 0 ? Math.min(1, stats.tempHp / stats.hpMax) : (token.tempPercent ?? 0)
  const barY = -token.height / 2 - 14
  const textY = barY - 17
  const conditions = token.conditions
    .map((id) => conditionById(id))
    .filter((condition): condition is NonNullable<typeof condition> => Boolean(condition))
    .slice(0, 8)

  const badgesWidth = conditions.length * BADGE + Math.max(0, conditions.length - 1) * BADGE_GAP
  const badgeY = textY - BADGE - 4

  return (
    <Group x={token.x} y={token.y}>
      {conditions.length > 0 && (
        <Rect
          x={-token.width / 2 - 3}
          y={-token.height / 2 - 3}
          width={token.width + 6}
          height={token.height + 6}
          cornerRadius={Math.min(token.width, token.height) / 2 + 3}
          stroke={conditions[0]!.color}
          strokeWidth={3}
          dash={
            conditions.some((condition) => condition.id === 'concentration') ? [7, 5] : undefined
          }
          opacity={0.85}
          listening={false}
        />
      )}

      {conditions.map((condition, index) => (
        <Rect
          key={`${token.id}-${condition.id}`}
          x={-badgesWidth / 2 + index * (BADGE + BADGE_GAP)}
          y={badgeY}
          width={BADGE}
          height={BADGE}
          cornerRadius={BADGE / 2}
          fill={condition.color}
          stroke="rgba(8,10,16,0.7)"
          strokeWidth={1}
          listening={false}
        />
      ))}
      {conditions.map((condition, index) => (
        <Text
          key={`${token.id}-${condition.id}-label`}
          x={-badgesWidth / 2 + index * (BADGE + BADGE_GAP)}
          y={badgeY + 4}
          width={BADGE}
          text={condition.short}
          align="center"
          fontSize={10}
          fontStyle="bold"
          fill="#0b0d12"
          listening={false}
        />
      ))}

      {hasNumbers && stats && (
        <>
          <Text
            x={-barWidth / 2}
            y={textY}
            width={barWidth}
            text={`${stats.hp} / ${stats.hpMax}`}
            fontSize={13}
            fontStyle="bold"
            fill="#e2e8f0"
            stroke="rgba(8,10,16,0.85)"
            strokeWidth={3}
            fillAfterStrokeEnabled
            listening={false}
          />
          {stats.ac > 0 && (
            <Text
              x={-barWidth / 2}
              y={textY}
              width={barWidth}
              text={`AC ${stats.ac}`}
              align="right"
              fontSize={13}
              fontStyle="bold"
              fill="#c7d2fe"
              stroke="rgba(8,10,16,0.85)"
              strokeWidth={3}
              fillAfterStrokeEnabled
              listening={false}
            />
          )}
        </>
      )}

      {hasBar && (
        <>
          <Rect
            x={-barWidth / 2}
            y={barY}
            width={barWidth}
            height={BAR_HEIGHT}
            cornerRadius={BAR_HEIGHT / 2}
            fill="rgba(8,10,16,0.8)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
            listening={false}
          />
          <Rect
            x={-barWidth / 2 + 1}
            y={barY + 1}
            width={Math.max(0, (barWidth - 2) * Math.max(0, Math.min(1, ratio)))}
            height={BAR_HEIGHT - 2}
            cornerRadius={(BAR_HEIGHT - 2) / 2}
            fill={barColor(ratio)}
            listening={false}
          />
          {temp > 0 && (
            <Rect
              x={-barWidth / 2 + 1 + (barWidth - 2) * Math.max(0, Math.min(1, ratio))}
              y={barY + 1}
              width={Math.max(0, Math.min((barWidth - 2) * (1 - ratio), (barWidth - 2) * temp))}
              height={BAR_HEIGHT - 2}
              cornerRadius={(BAR_HEIGHT - 2) / 2}
              fill="#38bdf8"
              listening={false}
            />
          )}
        </>
      )}

      {isGm && token.hidden && (
        <Text
          x={-barWidth / 2}
          y={badgeY - 14}
          width={barWidth}
          text="скрыт"
          align="center"
          fontSize={9}
          fill="#a78bfa"
          listening={false}
        />
      )}
    </Group>
  )
}

/** Слой HP/AC-бабблов и маркеров состояний (модуль «HP/AC и состояния») */
export function TokenStatsLayer({ session, role, width, height, visible }: TokenStatsLayerProps) {
  if (!visible) return null
  const isGm = role === 'gm'
  const tokens = isGm ? session.tokens : session.tokens.filter((token) => !token.hidden)

  return (
    <Layer listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {tokens.map((token) => (
        <TokenBubble key={token.id} token={token} isGm={isGm} />
      ))}
    </Layer>
  )
}
