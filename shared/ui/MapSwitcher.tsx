import type { MapAsset } from '../types/map'
import { assetUrl } from './assets'

export interface MapSwitcherProps {
  maps: MapAsset[]
  sessionId: string
  assetsBaseUrl: string
  /** Карта, которая сейчас в центре экрана */
  activeMapId: string | null
  onSelect: (mapId: string) => void
}

/**
 * Мини-индикатор карт в левом нижнем углу: превью карт по порядку.
 * Клик — камера перелетает к выбранной карте (переключение перетаскиванием
 * полотна при этом остаётся основным способом).
 */
export function MapSwitcher({
  maps,
  sessionId,
  assetsBaseUrl,
  activeMapId,
  onSelect
}: MapSwitcherProps) {
  if (maps.length === 0) return null

  return (
    <div className="pointer-events-auto fixed bottom-4 left-4 z-20 flex max-w-[60vw] items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#14161f]/85 p-1.5 shadow-xl backdrop-blur-xl">
      {maps.map((map, index) => {
        const active = map.id === activeMapId
        const fileName = map.imageUrl.split('/').pop() ?? 'карта'
        return (
          <button
            key={map.id}
            type="button"
            onClick={() => onSelect(map.id)}
            title={`${index + 1}. ${fileName} · ${map.width}×${map.height}`}
            aria-label={`Перейти к карте ${index + 1}`}
            aria-current={active}
            className={`relative h-10 w-14 shrink-0 overflow-hidden rounded-md border transition ${
              active
                ? 'border-indigo-400 ring-1 ring-indigo-400/60'
                : 'border-white/10 opacity-80 hover:border-white/30 hover:opacity-100'
            }`}
          >
            <img
              src={assetUrl(assetsBaseUrl, sessionId, map.imageUrl)}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 text-[9px] font-semibold text-gray-200">
              {index + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}
