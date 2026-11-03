import {
  ChatIcon,
  CursorIcon,
  DiceIcon,
  EraserIcon,
  EyeIcon,
  EyeOffIcon,
  FogIcon,
  GridIcon,
  HandIcon,
  LinkIcon,
  LockIcon,
  PencilIcon,
  TrashIcon,
  UnlockIcon,
  UsersIcon,
  ToolbarButton
} from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

const DRAW_COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f8fafc']

/**
 * Плавающий тулбар Мастера (ТЗ, п.8): инструменты + GM-only панели.
 * Панели не закреплены и перетаскиваются, тулбар не перекрывает карту целиком.
 */
export function HostToolbar() {
  const session = useHostStore((state) => state.session)
  const players = useHostStore((state) => state.players)
  const tool = useHostStore((state) => state.tool)
  const setTool = useHostStore((state) => state.setTool)
  const drawStyle = useHostStore((state) => state.drawStyle)
  const setDrawStyle = useHostStore((state) => state.setDrawStyle)
  const fogTool = useHostStore((state) => state.fogTool)
  const setFogTool = useHostStore((state) => state.setFogTool)
  const fogBrushSize = useHostStore((state) => state.fogBrushSize)
  const setFogBrushSize = useHostStore((state) => state.setFogBrushSize)
  const showFogPreview = useHostStore((state) => state.showFogPreview)
  const toggleFogPreview = useHostStore((state) => state.toggleFogPreview)
  const panels = useHostStore((state) => state.panels)
  const togglePanel = useHostStore((state) => state.togglePanel)
  const selectedTokenId = useHostStore((state) => state.selectedTokenId)
  const tokens = session?.tokens ?? []
  const selectedToken = tokens.find((token) => token.id === selectedTokenId) ?? null

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-20 flex -translate-x-1/2 flex-col items-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[#14161f]/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <ToolbarButton
          label="Выбор (V)"
          icon={<CursorIcon size={18} />}
          active={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolbarButton
          label="Перемещение карты (H / пробел)"
          icon={<HandIcon size={18} />}
          active={tool === 'pan'}
          onClick={() => setTool('pan')}
        />
        <ToolbarButton
          label="Рисование (P)"
          icon={<PencilIcon size={18} />}
          active={tool === 'draw'}
          onClick={() => setTool('draw')}
        />
        <ToolbarButton
          label="Ластик (E)"
          icon={<EraserIcon size={18} />}
          active={tool === 'erase'}
          onClick={() => setTool('erase')}
        />
        <ToolbarButton
          label="Туман войны (F)"
          icon={<FogIcon size={18} />}
          active={tool === 'fog'}
          onClick={() => setTool('fog')}
        />

        <span className="mx-1 h-6 w-px bg-white/10" />

        <ToolbarButton
          label="Токены"
          icon={<UsersIcon size={18} />}
          active={panels.tokens}
          badge={tokens.length}
          onClick={() => togglePanel('tokens')}
        />
        <ToolbarButton
          label="Карта и сетка"
          icon={<GridIcon size={18} />}
          active={panels.map}
          onClick={() => togglePanel('map')}
        />
        <ToolbarButton
          label="Чат"
          icon={<ChatIcon size={18} />}
          active={panels.chat}
          onClick={() => togglePanel('chat')}
        />
        <ToolbarButton
          label="Кубики"
          icon={<DiceIcon size={18} />}
          active={panels.dice}
          onClick={() => togglePanel('dice')}
        />
        <ToolbarButton
          label="Участники"
          icon={<UsersIcon size={18} />}
          active={panels.players}
          badge={players.length}
          onClick={() => togglePanel('players')}
        />
        <ToolbarButton
          label="Ссылка-приглашение"
          icon={<LinkIcon size={18} />}
          active={panels.invite}
          onClick={() => togglePanel('invite')}
        />
      </div>

      {(tool === 'draw' || tool === 'erase') && (
        <div className="pointer-events-auto mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#14161f]/85 px-3 py-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            {DRAW_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setDrawStyle({ color })}
                aria-label={`Цвет ${color}`}
                className={`h-5 w-5 rounded-full border transition ${
                  drawStyle.color === color
                    ? 'scale-110 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                    : 'border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Толщина
            <input
              type="range"
              min={1}
              max={40}
              value={drawStyle.size}
              onChange={(event) => setDrawStyle({ size: Number(event.target.value) })}
              className="w-24 accent-indigo-500"
            />
            <span className="w-6 text-right text-gray-300">{drawStyle.size}</span>
          </label>
        </div>
      )}

      {tool === 'fog' && (
        <div className="pointer-events-auto mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#14161f]/85 px-3 py-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-1">
            {(
              [
                ['brush', 'Кисть'],
                ['eraser', 'Ластик'],
                ['rect', 'Область']
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFogTool(value)}
                className={`rounded-md px-2 py-1 text-xs transition ${
                  fogTool === value
                    ? 'bg-indigo-500/25 text-indigo-100'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Кисть
            <input
              type="range"
              min={30}
              max={400}
              step={10}
              value={fogBrushSize}
              onChange={(event) => setFogBrushSize(Number(event.target.value))}
              className="w-24 accent-indigo-500"
            />
          </label>
          <button
            type="button"
            onClick={toggleFogPreview}
            className={`rounded-md px-2 py-1 text-xs transition ${
              showFogPreview ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-white'
            }`}
          >
            {showFogPreview ? 'Туман виден' : 'Туман скрыт'}
          </button>
        </div>
      )}

      {selectedToken && (
        <div className="pointer-events-auto mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14161f]/85 px-3 py-1.5 text-xs text-gray-300 shadow-xl backdrop-blur-xl">
          <span className="max-w-40 truncate font-medium text-gray-100">{selectedToken.name}</span>
          <button
            type="button"
            onClick={() =>
              void window.hostApi.updateToken({
                tokenId: selectedToken.id,
                hidden: !selectedToken.hidden
              })
            }
            className="flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-white/10"
            title="Скрыть токен от игроков"
          >
            {selectedToken.hidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            {selectedToken.hidden ? 'Скрыт' : 'Виден'}
          </button>
          <button
            type="button"
            onClick={() =>
              void window.hostApi.updateToken({
                tokenId: selectedToken.id,
                locked: !selectedToken.locked
              })
            }
            className="flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-white/10"
            title="Запретить перемещение"
          >
            {selectedToken.locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
            {selectedToken.locked ? 'Закреплён' : 'Свободен'}
          </button>
          <button
            type="button"
            onClick={() => void window.hostApi.removeToken(selectedToken.id)}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-red-300 transition hover:bg-red-500/15"
            title="Удалить токен"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
