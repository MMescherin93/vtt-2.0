import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Text, Transformer } from 'react-konva'
import type { Session } from '../../types/session'
import type { Token } from '../../types/token'
import { assetUrl } from '../assets'
import { useImage } from '../useImage'
import { tokenPlaceholder } from './tokenPlaceholder'
import type { TokenTransform } from './types'

/** Минимальный размер токена в пикселях карты */
const MIN_TOKEN_SIZE = 24

interface TokenNodeProps {
  token: Token
  sessionId: string
  assetsBaseUrl: string
  interactive: boolean
  /** Показывать подпись токена (расширение «Подписи токенов») */
  showLabels: boolean
  /** Цвет подписи */
  labelColor?: string
  selected: boolean
  isGm: boolean
  active: boolean
  mapWidth: number
  mapHeight: number
  onSelect: (tokenId: string) => void
  onMove: (tokenId: string, x: number, y: number, final: boolean) => void
  onTransform: (tokenId: string, data: TokenTransform) => void
}

function TokenNode({
  token,
  sessionId,
  assetsBaseUrl,
  interactive,
  showLabels,
  labelColor = '#e2e8f0',
  selected,
  isGm,
  active,
  mapWidth,
  mapHeight,
  onSelect,
  onMove,
  onTransform
}: TokenNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const [transformNode, setTransformNode] = useState<Konva.Group | null>(null)
  const lastEmitRef = useRef(0)

  const url = token.imageUrl ? assetUrl(assetsBaseUrl, sessionId, token.imageUrl) : ''
  const { image } = useImage(url)
  const placeholder = useMemo(() => tokenPlaceholder(token.name), [token.name])

  useEffect(() => {
    setTransformNode(selected ? groupRef.current : null)
  }, [selected, token.id])

  const clampX = useCallback(
    (x: number): number => (mapWidth > 0 ? Math.min(mapWidth, Math.max(0, x)) : x),
    [mapWidth]
  )
  const clampY = useCallback(
    (y: number): number => (mapHeight > 0 ? Math.min(mapHeight, Math.max(0, y)) : y),
    [mapHeight]
  )

  const handleDragMove = (event: KonvaEventObject<DragEvent>): void => {
    const node = event.target
    const x = clampX(node.x())
    const y = clampY(node.y())
    if (x !== node.x()) node.x(x)
    if (y !== node.y()) node.y(y)
    const now = Date.now()
    if (now - lastEmitRef.current > 70) {
      lastEmitRef.current = now
      onMove(token.id, x, y, false)
    }
  }

  const handleDragEnd = (event: KonvaEventObject<DragEvent>): void => {
    const node = event.target
    onMove(token.id, clampX(node.x()), clampY(node.y()), true)
  }

  const handleTransformEnd = (): void => {
    const node = groupRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const width = Math.max(MIN_TOKEN_SIZE, token.width * Math.abs(scaleX))
    const height = Math.max(MIN_TOKEN_SIZE, token.height * Math.abs(scaleY))
    const rotation = Math.round(node.rotation() * 10) / 10

    // Сбрасываем масштаб: размер будет взят из нового состояния токена
    node.scaleX(1)
    node.scaleY(1)
    node.offsetX(0)
    node.offsetY(0)

    onTransform(token.id, {
      x: clampX(node.x()),
      y: clampY(node.y()),
      width: Math.round(width),
      height: Math.round(height),
      rotation
    })
  }

  const canDrag = interactive && !token.locked
  const showLabel = (showLabels && !token.hideName) || selected
  const labelWidth = Math.max(token.width, 80)

  return (
    <>
      <Group
        ref={groupRef}
        x={token.x}
        y={token.y}
        rotation={token.rotation}
        draggable={canDrag}
        listening={interactive}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={() => onSelect(token.id)}
        onTap={() => onSelect(token.id)}
        opacity={token.hidden && isGm ? 0.45 : 1}
      >
        <KonvaImage
          image={image ?? placeholder}
          x={-token.width / 2}
          y={-token.height / 2}
          width={token.width}
          height={token.height}
          cornerRadius={Math.min(token.width, token.height) / 2}
          shadowColor="#000"
          shadowBlur={selected ? 18 : 8}
          shadowOpacity={selected ? 0.6 : 0.35}
          shadowOffset={{ x: 0, y: 3 }}
        />
        {token.hidden && (
          <Rect
            x={-token.width / 2}
            y={-token.height / 2}
            width={token.width}
            height={token.height}
            stroke="#a78bfa"
            strokeWidth={2}
            dash={[8, 6]}
            cornerRadius={Math.min(token.width, token.height) / 2}
            listening={false}
          />
        )}
        {token.locked && (
          <Rect
            x={-token.width / 2}
            y={-token.height / 2}
            width={token.width}
            height={token.height}
            stroke="#f59e0b"
            strokeWidth={2}
            cornerRadius={Math.min(token.width, token.height) / 2}
            listening={false}
          />
        )}
        {active && (
          <Rect
            x={-token.width / 2 - 5}
            y={-token.height / 2 - 5}
            width={token.width + 10}
            height={token.height + 10}
            cornerRadius={Math.min(token.width, token.height) / 2 + 5}
            stroke="#fbbf24"
            strokeWidth={3}
            shadowColor="#fbbf24"
            shadowBlur={12}
            shadowOpacity={0.7}
            listening={false}
          />
        )}
        {showLabel && (
          <Text
            x={-labelWidth / 2}
            y={token.height / 2 + 6}
            width={labelWidth}
            text={token.name}
            align="center"
            fontSize={Math.max(12, Math.min(18, token.height / 5))}
            fill={labelColor}
            listening={false}
          />
        )}
      </Group>

      {selected && transformNode && interactive && (!token.locked || isGm) && (
        <Transformer
          nodes={[transformNode]}
          rotateEnabled
          keepRatio={false}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          anchorSize={9}
          anchorCornerRadius={2}
          anchorStroke="#818cf8"
          anchorFill="#0f1117"
          borderStroke="#818cf8"
          borderDash={[4, 4]}
          onTransformEnd={handleTransformEnd}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < MIN_TOKEN_SIZE || newBox.height < MIN_TOKEN_SIZE ? oldBox : newBox
          }
        />
      )}
    </>
  )
}

export interface TokensLayerProps {
  session: Session
  assetsBaseUrl: string
  role: 'gm' | 'player'
  /** Размер рабочего поля (карта или виртуальный стол без карты) */
  width: number
  height: number
  /** Разрешено ли взаимодействие (инструмент «выбор») */
  interactive: boolean
  /** Показывать подписи токенов */
  showLabels: boolean
  /** Цвет подписей токенов */
  labelColor?: string
  /** Токен, чей сейчас ход (подсветка трекера инициативы) */
  activeTokenId?: string | null
  selectedTokenId: string | null
  onSelect: (tokenId: string | null) => void
  onMove: (tokenId: string, x: number, y: number, final: boolean) => void
  onTransform: (tokenId: string, data: TokenTransform) => void
}

/** Слой токенов (ТЗ, п.3) */
export function TokensLayer({
  session,
  assetsBaseUrl,
  role,
  width,
  height,
  interactive,
  showLabels,
  labelColor = '#e2e8f0',
  activeTokenId = null,
  selectedTokenId,
  onSelect,
  onMove,
  onTransform
}: TokensLayerProps) {
  const isGm = role === 'gm'
  const tokens = isGm ? session.tokens : session.tokens.filter((token) => !token.hidden)

  return (
    <Layer listening={interactive} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {tokens.map((token) => (
        <TokenNode
          key={token.id}
          token={token}
          sessionId={session.id}
          assetsBaseUrl={assetsBaseUrl}
          interactive={interactive}
          showLabels={showLabels}
          labelColor={labelColor}
          selected={token.id === selectedTokenId}
          isGm={isGm}
          active={token.id === activeTokenId}
          mapWidth={width}
          mapHeight={height}
          onSelect={onSelect}
          onMove={onMove}
          onTransform={onTransform}
        />
      ))}
    </Layer>
  )
}
