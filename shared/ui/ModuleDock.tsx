import type { ExtensionDefinition } from '../plugins/types'
import { PuzzleIcon } from './icons'

export interface ModuleDockProps {
  /** Активированные модули с разворачиваемой панелью */
  modules: ExtensionDefinition[]
  /** Какие панели сейчас развёрнуты */
  open: Record<string, boolean>
  /** Базовый URL хоста для иконок модулей */
  baseUrl: string
  onToggle: (extensionId: string) => void
}

/**
 * Док активированных модулей в правом верхнем углу.
 * Клик по иконке разворачивает панель модуля, повторный — сворачивает.
 */
export function ModuleDock({ modules, open, baseUrl, onToggle }: ModuleDockProps) {
  if (modules.length === 0) return null

  const iconUrl = (definition: ExtensionDefinition): string | null => {
    if (!definition.icon) return null
    return `${baseUrl.replace(/\/+$/, '')}/${definition.icon.replace(/^\/+/, '')}`
  }

  return (
    <div className="pointer-events-auto fixed right-3 top-3 z-40 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#14161f]/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {modules.map((definition) => {
        const isOpen = Boolean(open[definition.id])
        const url = iconUrl(definition)
        return (
          <button
            key={definition.id}
            type="button"
            onClick={() => onToggle(definition.id)}
            title={`${definition.title}: ${isOpen ? 'свернуть' : 'развернуть'}`}
            aria-label={`${definition.title} — ${isOpen ? 'свернуть' : 'развернуть'}`}
            aria-pressed={isOpen}
            className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border transition ${
              isOpen
                ? 'border-indigo-400/70 bg-indigo-500/25 shadow-[0_0_14px_-4px_rgba(99,102,241,0.9)]'
                : 'border-transparent bg-white/5 hover:border-white/15 hover:bg-white/10'
            }`}
          >
            {url ? (
              <img
                src={url}
                alt=""
                draggable={false}
                className={`h-6 w-6 object-contain transition ${isOpen ? '' : 'opacity-80'}`}
              />
            ) : (
              <PuzzleIcon size={18} />
            )}
          </button>
        )
      })}
    </div>
  )
}
