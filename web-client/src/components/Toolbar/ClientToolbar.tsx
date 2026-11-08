import {
  ChatIcon,
  CursorIcon,
  DiceIcon,
  EraserIcon,
  HandIcon,
  PencilIcon,
  TextIcon,
  ToolbarButton
} from '@vtt/shared/ui'
import { useClientStore } from '../../store/useClientStore'

const DRAW_COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f8fafc']

/** Упрощённый тулбар игрока (ТЗ, п.8): инструменты канваса, чат и кубики */
export function ClientToolbar() {
  const tool = useClientStore((state) => state.tool)
  const setTool = useClientStore((state) => state.setTool)
  const drawStyle = useClientStore((state) => state.drawStyle)
  const setDrawStyle = useClientStore((state) => state.setDrawStyle)
  const textSize = useClientStore((state) => state.textSize)
  const setTextSize = useClientStore((state) => state.setTextSize)
  const panels = useClientStore((state) => state.panels)
  const togglePanel = useClientStore((state) => state.togglePanel)
  const session = useClientStore((state) => state.session)
  const extensions = session?.enabledExtensions ?? {}

  const drawingEnabled = extensions['drawing'] ?? true
  const chatEnabled = extensions['chat'] ?? true
  const diceEnabled = extensions['dice'] ?? true

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-40 flex -translate-x-1/2 flex-col items-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[#14161f]/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <ToolbarButton
          label="Выбор / перетаскивание"
          icon={<CursorIcon size={18} />}
          active={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolbarButton
          label="Перемещение карты (пробел)"
          icon={<HandIcon size={18} />}
          active={tool === 'pan'}
          onClick={() => setTool('pan')}
        />
        {drawingEnabled && (
          <>
            <ToolbarButton
              label="Рисование"
              icon={<PencilIcon size={18} />}
              active={tool === 'draw'}
              onClick={() => setTool('draw')}
            />
            <ToolbarButton
              label="Ластик"
              icon={<EraserIcon size={18} />}
              active={tool === 'erase'}
              onClick={() => setTool('erase')}
            />
          </>
        )}
        <ToolbarButton
          label="Текст — клик по карте"
          icon={<TextIcon size={18} />}
          active={tool === 'text'}
          onClick={() => setTool('text')}
        />

        <span className="mx-1 h-6 w-px bg-white/10" />

        {chatEnabled && (
          <ToolbarButton
            label="Чат"
            icon={<ChatIcon size={18} />}
            active={panels.chat}
            onClick={() => togglePanel('chat')}
          />
        )}
        {diceEnabled && (
          <ToolbarButton
            label="Кубики"
            icon={<DiceIcon size={18} />}
            active={panels.dice}
            onClick={() => togglePanel('dice')}
          />
        )}
      </div>

      {drawingEnabled && (tool === 'draw' || tool === 'erase') && (
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
      {tool === 'text' && (
        <div className="pointer-events-auto mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#14161f]/85 px-3 py-2 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            {DRAW_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setDrawStyle({ color })}
                aria-label={`Цвет текста ${color}`}
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
            Размер
            <input
              type="range"
              min={10}
              max={120}
              value={textSize}
              onChange={(event) => setTextSize(Number(event.target.value))}
              className="w-24 accent-indigo-500"
            />
            <span className="w-7 text-right text-gray-300">{textSize}</span>
          </label>
        </div>
      )}
    </div>
  )
}
