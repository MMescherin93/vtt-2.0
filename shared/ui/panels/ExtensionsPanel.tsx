import type { ExtensionCategory, ExtensionDefinition, ExtensionValues } from '../../plugins/types'
import { isExtensionVisible } from '../../plugins/types'
import { EXTENSION_CATEGORIES } from '../../plugins/builtins'
import { FloatingPanel } from '../FloatingPanel'
import { PuzzleIcon } from '../icons'

export interface ExtensionsPanelProps {
  definitions: ExtensionDefinition[]
  values: ExtensionValues
  role: 'gm' | 'player'
  /** У игрока панель только для просмотра: включает расширения Мастер */
  readOnly?: boolean
  onToggle?: (extensionId: string, enabled: boolean) => void
  onClose?: () => void
  storageKey?: string
  defaultPosition?: { x: number; y: number }
  /** Разделы каталога; по умолчанию — базовые и «Тройка!» */
  categories?: ExtensionCategory[]
}

/**
 * Каталог расширений (кнопка с пазлом в правом нижнем углу).
 * Модули сгруппированы по разделам, как в Owlbear Rodeo: «Базовые» —
 * инструменты стола, «Тройка!» — модули конкретной системы.
 */
export function ExtensionsPanel({
  definitions,
  values,
  role,
  readOnly = false,
  onToggle,
  onClose,
  storageKey = 'vtt.panel.extensions.v2',
  defaultPosition = { x: 300, y: 80 },
  categories = EXTENSION_CATEGORIES
}: ExtensionsPanelProps) {
  const visible = definitions.filter((definition) => isExtensionVisible(definition, role))
  const enabledCount = visible.filter(
    (definition) => values[definition.id] ?? definition.defaultEnabled
  ).length

  const sections = categories
    .map((category) => ({
      category,
      items: visible.filter((definition) => (definition.category ?? 'basic') === category.id)
    }))
    .filter((section) => section.items.length > 0)

  // На случай модуля с неизвестным разделом — показываем его отдельно
  const known = new Set(categories.map((category) => category.id))
  const unknown = visible.filter((definition) => !known.has(definition.category ?? 'basic'))
  if (unknown.length > 0) {
    sections.push({
      category: { id: 'other', title: 'Другие', description: 'Прочие модули' },
      items: unknown
    })
  }

  return (
    <FloatingPanel
      title={`Расширения · ${enabledCount}/${visible.length}`}
      icon={<PuzzleIcon size={16} />}
      onClose={onClose}
      storageKey={storageKey}
      defaultPosition={defaultPosition}
      width={640}
    >
      <div className="space-y-5 p-4">
        {sections.map(({ category, items }) => {
          const sectionEnabled = items.filter(
            (definition) => values[definition.id] ?? definition.defaultEnabled
          ).length
          return (
            <section key={category.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {category.title}
                  </h3>
                  {category.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-600">
                      {category.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {sectionEnabled}/{items.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {items.map((definition) => {
                  const enabled = values[definition.id] ?? definition.defaultEnabled
                  return (
                    <div
                      key={definition.id}
                      className={`flex flex-col rounded-xl border px-3 py-2.5 transition ${
                        enabled
                          ? 'border-indigo-400/30 bg-indigo-500/10'
                          : 'border-white/5 bg-black/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold leading-snug text-gray-200">
                          {definition.title}
                        </span>

                        {readOnly ? (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              enabled
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-white/5 text-gray-500'
                            }`}
                          >
                            {enabled ? 'вкл' : 'выкл'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${definition.title}: ${enabled ? 'включено' : 'выключено'}`}
                            onClick={() => onToggle?.(definition.id, !enabled)}
                            className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                              enabled ? 'bg-indigo-500' : 'bg-white/15'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                                enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                        {definition.description}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {definition.scope !== 'both' && (
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                            только Мастер
                          </span>
                        )}
                        {definition.playerWritable && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                            общее редактирование
                          </span>
                        )}
                        {definition.panel && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                            панель
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        <p className="border-t border-white/5 pt-3 text-[11px] leading-relaxed text-gray-600">
          {readOnly
            ? 'Расширения включает Мастер для всей сессии. Иконки справа сверху разворачивают и сворачивают панели.'
            : 'Включение расширений общее для всей сессии: игроки сразу видят тот же набор. Активированные модули с панелью появляются иконками в правом верхнем углу — клик разворачивает и сворачивает панель.'}
        </p>
      </div>
    </FloatingPanel>
  )
}
