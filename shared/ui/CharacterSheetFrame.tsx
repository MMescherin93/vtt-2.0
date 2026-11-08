import type { ComponentProps } from 'react'
import { ExtensionFrame } from './ExtensionFrame'

export type CharacterSheetFrameProps = Omit<
  ComponentProps<typeof ExtensionFrame>,
  'zoomable' | 'resizable'
>

/**
 * Обязательная обёртка для всех листов персонажей.
 *
 * Правило проекта: лист персонажа всегда можно масштабировать (50–200%)
 * и растягивать за края окна. Настройки запоминаются отдельно для клиента
 * и листа. Не используйте ExtensionFrame для листов напрямую — только
 * CharacterSheetFrame, чтобы новое поведение не потерялось.
 *
 * Размер окна листа ограничивает FloatingPanel: он подстраивается под
 * вьюпорт игрока и не заезжает под панель инструментов.
 */
export function CharacterSheetFrame({ className = '', ...props }: CharacterSheetFrameProps) {
  return <ExtensionFrame {...props} className={className} zoomable resizable />
}
