import { useMemo } from 'react'
import { conditionById } from '@vtt/shared/utils'
import { FloatingPanel } from '@vtt/shared/ui'
import { useClientStore } from '../../store/useClientStore'

/** Панель игрока: порядок боя только для чтения */
export function InitiativePanel() {
  const session = useClientStore((state) => state.session)
  const setSelectedToken = useClientStore((state) => state.setSelectedToken)
  const toggleModulePanel = useClientStore((state) => state.toggleModulePanel)

  const combat = session?.combat ?? {
    active: false,
    round: 1,
    turnId: null,
    order: [],
    combatants: [],
    announce: true,
    updatedAt: 0
  }
  const tokenById = useMemo(
    () => new Map((session?.tokens ?? []).map((token) => [token.id, token])),
    [session?.tokens]
  )
  const combatantById = useMemo(
    () => new Map((combat?.combatants ?? []).map((combatant) => [combatant.id, combatant])),
    [combat?.combatants]
  )

  if (!session) return null

  const current = combat.turnId ? combatantById.get(combat.turnId) : null
  const currentLabel = combat.turnHidden
    ? 'Ход Мастера'
    : current
      ? current.name
      : combat.active
        ? 'ход не выбран'
        : 'бой не начат'

  return (
    <FloatingPanel
      title={`Инициатива · раунд ${combat.round}`}
      defaultPosition={{ x: 420, y: 96 }}
      storageKey="vtt.player.panel.initiative"
      width={340}
      onClose={() => toggleModulePanel('initiative', false)}
    >
      <div className="space-y-2 p-3">
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {combat.active ? 'сейчас ходит' : 'бой'}
          </div>
          <div className="truncate text-sm font-semibold text-gray-100">{currentLabel}</div>
        </div>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {combat.order.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
              Мастер ещё не начал бой
            </p>
          )}
          {combat.order.map((id) => {
            const combatant = combatantById.get(id)
            if (!combatant) return null
            const token = combatant.tokenId ? tokenById.get(combatant.tokenId) : undefined
            const active = combat.active && combat.turnId === id
            const hp = token?.stats
              ? `${token.stats.hp}/${token.stats.hpMax}`
              : token?.hpPercent !== undefined
                ? `${Math.round(token.hpPercent * 100)}%`
                : '—'
            const conditions = token?.conditions
              .map((conditionId) => conditionById(conditionId))
              .filter(Boolean)
              .slice(0, 5)

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (token) setSelectedToken(token.id)
                }}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                  active ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/5 bg-black/20'
                }`}
              >
                <span className="w-7 text-xs font-semibold text-gray-300">
                  {combatant.initiative}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-xs ${
                    combatant.defeated ? 'text-gray-600 line-through' : 'text-gray-200'
                  }`}
                >
                  {combatant.name}
                </span>
                <span className="text-[10px] text-gray-500">{hp}</span>
                <span className="flex gap-0.5">
                  {conditions?.map((condition) => (
                    <span
                      key={condition!.id}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: condition!.color }}
                      title={condition!.label}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </FloatingPanel>
  )
}
