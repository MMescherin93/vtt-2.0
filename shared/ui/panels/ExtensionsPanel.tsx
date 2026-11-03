import type { ExtensionDefinition, ExtensionValues } from '../../plugins/types'
import { isExtensionVisible } from '../../plugins/types'
import { FloatingPanel } from '../FloatingPanel'
import { PuzzleIcon } from '../icons'

export interface ExtensionsPanelProps {
  definitions: ExtensionDefinition[]
  values: ExtensionValues
  role: 'gm' | 'player'
  onToggle: (extensionId: string, enabled: boolean) => void
  onClose?: () => void
  storageKey?: string
  defaultPosition?: { x: number; y: number }
}

/**
 * Панель расширений (кнопка в правом нижнем углу экрана).
 * Показывает модули, доступные роли, и позволяет включать/выключать их.
 */
export function ExtensionsPanel({
  definitions,
  values,
  role,
  onToggle,
  onClose,
  storageKey = 'vtt.panel.extensions',
  defaultPosition = { x: 380, y: 380 }
}: ExtensionsPanelProps) {
  const visible = definitions.filter((definition) => isExtensionVisible(definition, role))
  const enabledCount = visible.filter(
    (definition) => values[definition.id] ?? definition.defaultEnabled
  ).length

  return (
    <FloatingPanel
      title={`Расширения · ${enabledCount}/${visible.length}`}
      icon={<PuzzleIcon size={16} />}
      onClose={onClose}
      storageKey={storageKey}
      defaultPosition={defaultPosition}
      width={340}
    >
      <div className="space-y-1.5 p-3">
        {visible.map((definition) => {
          const enabled = values[definition.id] ?? definition.defaultEnabled
          return (
            <div
              key={definition.id}
              className={`flex items-start gap-3 rounded-lg border px-2.5 py-2 transition ${
                enabled ? 'border-indigo-400/30 bg-indigo-500/10' : 'border-white/5 bg-black/20'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-200">{definition.title}</span>
                  {definition.scope !== 'both' && (
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                      только Мастер
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  {definition.description}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${definition.title}: ${enabled ? 'включено' : 'выключено'}`}
                onClick={() => onToggle(definition.id, !enabled)}
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                  enabled ? 'bg-indigo-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          )
        })}

        <p className="pt-1 text-[11px] leading-relaxed text-gray-600">
          Включение расширений сохраняется в этом браузере.
        </p>
      </div>
    </FloatingPanel>
  )
}
