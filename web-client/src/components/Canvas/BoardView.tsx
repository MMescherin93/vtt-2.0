import { useEffect } from 'react'
import { Board, ChatPanel, DicePanel } from '@vtt/shared/ui'
import { useClientStore } from '../../store/useClientStore'
import { hostUrl } from '../../socket'
import { ClientToolbar } from '../Toolbar/ClientToolbar'

/** Стол игрока: канвас, упрощённый тулбар, чат и кубики */
export function BoardView() {
  const session = useClientStore((state) => state.session)
  const players = useClientStore((state) => state.players)
  const status = useClientStore((state) => state.status)
  const tool = useClientStore((state) => state.tool)
  const drawStyle = useClientStore((state) => state.drawStyle)
  const selectedTokenId = useClientStore((state) => state.selectedTokenId)
  const panels = useClientStore((state) => state.panels)
  const selfId = useClientStore((state) => state.selfId)
  const setSelectedToken = useClientStore((state) => state.setSelectedToken)
  const moveToken = useClientStore((state) => state.moveToken)
  const transformToken = useClientStore((state) => state.transformToken)
  const sendDrawing = useClientStore((state) => state.sendDrawing)
  const sendChat = useClientStore((state) => state.sendChat)
  const requestRoll = useClientStore((state) => state.requestRoll)
  const togglePanel = useClientStore((state) => state.togglePanel)
  const notice = useClientStore((state) => state.notice)
  const setNotice = useClientStore((state) => state.setNotice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice, setNotice])

  if (!session) return null

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Board
        session={session}
        role="player"
        tool={tool}
        drawStyle={drawStyle}
        fogTool="brush"
        fogBrushSize={0}
        showFogPreview={false}
        assetsBaseUrl={hostUrl}
        cameraKey={`player-${session.id}`}
        selectedTokenId={selectedTokenId}
        onSelectToken={setSelectedToken}
        onMoveToken={moveToken}
        onTransformToken={transformToken}
        onAddDrawing={sendDrawing}
        onFogChange={() => {
          // Туман войны меняет только Мастер
        }}
      />

      <div className="pointer-events-none fixed left-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14161f]/85 px-3 py-1.5 shadow-xl backdrop-blur-xl">
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' : 'bg-amber-500'
          }`}
        />
        <div className="max-w-52">
          <div className="truncate text-sm font-semibold text-gray-100">{session.name}</div>
          <div className="text-[11px] text-gray-500">
            {players.length > 0 ? `${players.length} участников` : 'игрок'}
          </div>
        </div>
      </div>

      <ClientToolbar />

      {panels.chat && (
        <ChatPanel
          messages={session.chatLog}
          currentUserId={selfId}
          players={players}
          onSend={sendChat}
          onClose={() => togglePanel('chat')}
          storageKey="vtt.player.panel.chat"
          defaultPosition={{ x: 24, y: 320 }}
        />
      )}
      {panels.dice && (
        <DicePanel
          history={session.rollLog}
          onRoll={requestRoll}
          onClose={() => togglePanel('dice')}
          storageKey="vtt.player.panel.dice"
          defaultPosition={{ x: 24, y: 24 }}
        />
      )}

      {status !== 'connected' && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-100 shadow-xl backdrop-blur">
          {status === 'connecting' ? 'Подключение к столу…' : 'Связь потеряна — переподключение…'}
        </div>
      )}

      {notice && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-white/10 bg-[#14161f]/90 px-4 py-2 text-sm text-gray-200 shadow-xl backdrop-blur">
          {notice}
        </div>
      )}
    </div>
  )
}
