import { FloatingPanel, UsersIcon } from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

/** Список подключённых участников (ТЗ, п.7: имя отправителя и роли) */
export function PlayersPanel() {
  const players = useHostStore((state) => state.players)
  const panels = useHostStore((state) => state.panels)
  const togglePanel = useHostStore((state) => state.togglePanel)

  if (!panels.players) return null

  return (
    <FloatingPanel
      title={`Участники · ${players.length}`}
      icon={<UsersIcon size={16} />}
      defaultPosition={{ x: 24, y: 480 }}
      storageKey="vtt.gm.panel.players"
      width={260}
      onClose={() => togglePanel('players')}
    >
      <div className="p-3">
        {players.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">
            Игроки ещё не подключились. Отправьте им ссылку из панели «Приглашение».
          </p>
        ) : (
          <ul className="space-y-1">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-gray-300"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <span className="min-w-0 flex-1 truncate">{player.name}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">
                  игрок
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FloatingPanel>
  )
}
