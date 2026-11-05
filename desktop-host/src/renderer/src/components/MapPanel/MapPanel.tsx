import { useRef, type ChangeEvent } from 'react'
import {
  ChevronIcon,
  EyeIcon,
  FloatingPanel,
  FogIcon,
  GridIcon,
  ImageIcon,
  TrashIcon,
  UploadIcon
} from '@vtt/shared/ui'
import type { GridType } from '@vtt/shared'
import { GRID_TYPE_LABELS } from '@vtt/shared/utils'
import { useHostStore } from '../../store/useHostStore'

/** Панель карты и сетки (ТЗ, п.2) + управление туманом войны (п.4) */
export function MapPanel() {
  const session = useHostStore((state) => state.session)
  const panels = useHostStore((state) => state.panels)
  const togglePanel = useHostStore((state) => state.togglePanel)
  const updateSessionPatch = useHostStore((state) => state.updateSessionPatch)
  const uploadMap = useHostStore((state) => state.uploadMap)
  const removeMap = useHostStore((state) => state.removeMap)
  const clearMap = useHostStore((state) => state.clearMap)
  const changeFog = useHostStore((state) => state.changeFog)
  const fogBrushSize = useHostStore((state) => state.fogBrushSize)
  const setFogBrushSize = useHostStore((state) => state.setFogBrushSize)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!session || !panels.map) return null

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadMap(file)
  }

  const gridTypes: GridType[] = ['square', 'hex', 'none']

  return (
    <FloatingPanel
      title="Карта и сетка"
      icon={<GridIcon size={16} />}
      defaultPosition={{ x: 24, y: 96 }}
      storageKey="vtt.gm.panel.map"
      width={310}
      onClose={() => togglePanel('map')}
    >
      <div className="space-y-4 p-3">
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <ImageIcon size={13} /> Карты · {session.maps.length}
          </h3>

          {session.maps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[11px] text-gray-500">
              Карт нет — сетка и токены работают на виртуальном столе 1920×1080
            </p>
          ) : (
            <ul className="space-y-1">
              {session.maps.map((map, index) => (
                <li
                  key={map.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-gray-200">
                      {map.imageUrl.split('/').pop()}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {map.width} × {map.height} px
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void updateSessionPatch({ moveMap: { mapId: map.id, direction: 'left' } })
                    }
                    disabled={index === 0}
                    title="Сдвинуть карту влево"
                    aria-label="Сдвинуть карту влево"
                    className="flex h-6 w-5 items-center justify-center rounded text-gray-500 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    <ChevronIcon size={12} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void updateSessionPatch({ moveMap: { mapId: map.id, direction: 'right' } })
                    }
                    disabled={index === session.maps.length - 1}
                    title="Сдвинуть карту вправо"
                    aria-label="Сдвинуть карту вправо"
                    className="flex h-6 w-5 items-center justify-center rounded text-gray-500 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    <ChevronIcon size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeMap(map.id)}
                    title="Удалить карту"
                    className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-red-500/15 hover:text-red-300"
                  >
                    <TrashIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              <UploadIcon size={14} />
              Загрузить карту
            </button>
            {session.maps.length > 0 && (
              <button
                type="button"
                onClick={() => void clearMap()}
                title="Убрать все карты"
                className="rounded-lg border border-white/10 px-2 text-gray-400 transition hover:bg-red-500/15 hover:text-red-300"
              >
                <TrashIcon size={14} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-600">
            Карты лежат слева направо с зазором 120 px. Переключение — перетаскивание полотна;
            токены можно переносить между картами. Видео при загрузке конвертируется в GIF
            (первые 15 секунд, до 900 px).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            hidden
            onChange={handleFile}
          />
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Сетка
          </h3>
          <div className="grid grid-cols-3 gap-1">
            {gridTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void updateSessionPatch({ settings: { gridType: type } })}
                className={`rounded-md border px-1 py-1.5 text-[11px] transition ${
                  session.settings.gridType === type
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {GRID_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>Показывать сетку</span>
            <input
              type="checkbox"
              checked={session.settings.showGrid}
              onChange={(event) =>
                void updateSessionPatch({ settings: { showGrid: event.target.checked } })
              }
              className="h-4 w-4 accent-indigo-500"
            />
          </label>

          <label className="mt-2 block text-xs text-gray-400">
            <span className="flex justify-between">
              Размер ячейки
              <span className="text-gray-300">{session.settings.gridSize} px</span>
            </span>
            <input
              type="range"
              min={20}
              max={300}
              step={5}
              value={session.settings.gridSize}
              disabled={session.settings.gridType === 'none'}
              onChange={(event) =>
                void updateSessionPatch({ settings: { gridSize: Number(event.target.value) } })
              }
              className="mt-1 w-full accent-indigo-500 disabled:opacity-40"
            />
          </label>

          <label className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>Цвет сетки</span>
            <input
              type="color"
              value={session.settings.gridColor}
              onChange={(event) =>
                void updateSessionPatch({ settings: { gridColor: event.target.value } })
              }
              className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <EyeIcon size={13} /> Подписи токенов
          </h3>
          <label className="flex items-center justify-between text-xs text-gray-400">
            <span>Показывать имена</span>
            <input
              type="checkbox"
              checked={session.settings.showTokenNames}
              onChange={(event) =>
                void updateSessionPatch({ settings: { showTokenNames: event.target.checked } })
              }
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
          <label className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>Цвет имён</span>
            <input
              type="color"
              value={session.settings.tokenLabelColor}
              onChange={(event) =>
                void updateSessionPatch({
                  settings: { tokenLabelColor: event.target.value }
                })
              }
              className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-600">
            Отдельное имя можно скрыть в панели выбранного токена.
          </p>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <FogIcon size={13} /> Туман войны
          </h3>
          <p className="mb-2 text-[11px] leading-relaxed text-gray-500">
            Операций: {session.fogOfWar.ops.length}. Кисть закрашивает, ластик и область открывают.
            Игроки видят только открытые участки. В режиме «туман скрыт» Мастер видит закрытые
            области затемнёнными — карта и токены остаются читаемыми.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => changeFog({ covered: true, ops: [] })}
              className="rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-gray-300 transition hover:bg-white/10"
            >
              Закрыть всё
            </button>
            <button
              type="button"
              onClick={() => changeFog({ covered: false, ops: [] })}
              className="rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-gray-300 transition hover:bg-white/10"
            >
              Открыть всё
            </button>
            <button
              type="button"
              onClick={() => changeFog({ covered: session.fogOfWar.covered, ops: [] })}
              className="col-span-2 rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-gray-300 transition hover:bg-white/10"
            >
              Стереть все росчерки тумана
            </button>
          </div>

          <label className="mt-3 block text-xs text-gray-400">
            <span className="flex justify-between">
              Размер кисти тумана
              <span className="text-gray-300">{fogBrushSize} px</span>
            </span>
            <input
              type="range"
              min={30}
              max={400}
              step={10}
              value={fogBrushSize}
              onChange={(event) => setFogBrushSize(Number(event.target.value))}
              className="mt-1 w-full accent-indigo-500"
            />
          </label>
        </section>
      </div>
    </FloatingPanel>
  )
}
