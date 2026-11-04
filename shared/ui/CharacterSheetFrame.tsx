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
 */
export function CharacterSheetFrame({ className = '', ...props }: CharacterSheetFrameProps) {
  return (
    <ExtensionFrame {...props} className={`!max-h-[96vh] ${className}`.trim()} zoomable resizable />
  )
}
