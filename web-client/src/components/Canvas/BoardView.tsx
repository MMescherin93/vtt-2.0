import { useEffect } from 'react'
import { BUILT_IN_EXTENSIONS, isExtensionVisible } from '@vtt/shared/plugins'
import {
  Board,
  ChatPanel,
  DicePanel,
  ExtensionFrame,
  ExtensionsPanel,
  MapSwitcher,
  ModuleDock,
  PuzzleIcon
} from '@vtt/shared/ui'
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
  const extensions = useClientStore((state) => state.extensions)
  const toggleExtension = useClientStore((state) => state.toggleExtension)
  const activeMapId = useClientStore((state) => state.activeMapId)
  const focusRequest = useClientStore((state) => state.focusRequest)
  const setActiveMap = useClientStore((state) => state.setActiveMap)
  const focusMap = useClientStore((state) => state.focusMap)
  const modulePanels = useClientStore((state) => state.modulePanels)
  const toggleModulePanel = useClientStore((state) => state.toggleModulePanel)

  const chatEnabled = extensions['chat'] ?? true
  const diceEnabled = extensions['dice'] ?? true
  const labelsEnabled = extensions['token-labels'] ?? true
  const troikaEnabled = extensions['troika-initiative'] ?? false
  const troikaOpen = troikaEnabled && (modulePanels['troika-initiative'] ?? false)

  const dockModules = BUILT_IN_EXTENSIONS.filter(
    (definition) =>
      definition.panel &&
      definition.icon &&
      isExtensionVisible(definition, 'player') &&
      (extensions[definition.id] ?? definition.defaultEnabled)
  )

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
        showTokenLabels={labelsEnabled}
        focusMap={focusRequest}
        onActiveMapChange={setActiveMap}
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

      {troikaOpen && (
        <ExtensionFrame
          title="Инициатива «Тройка»"
          src={`${hostUrl}/extensions/troika-initiative/index.html`}
          extensionId="troika-initiative"
          role="player"
          state={session.extensionState['troika-initiative'] ?? null}
          onClose={() => toggleModulePanel('troika-initiative', false)}
          width={760}
          height={620}
          storageKey="vtt.player.panel.troika"
          defaultPosition={{ x: 300, y: 60 }}
        />
      )}

      <ModuleDock
        modules={dockModules}
        open={modulePanels}
        baseUrl={hostUrl}
        onToggle={(extensionId) => toggleModulePanel(extensionId)}
      />

      <MapSwitcher
        maps={session.maps}
        sessionId={session.id}
        assetsBaseUrl={hostUrl}
        activeMapId={activeMapId}
        onSelect={focusMap}
      />

      {chatEnabled && panels.chat && (
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
      {diceEnabled && panels.dice && (
        <DicePanel
          history={session.rollLog}
          onRoll={requestRoll}
          onClose={() => togglePanel('dice')}
          storageKey="vtt.player.panel.dice"
          defaultPosition={{ x: 24, y: 24 }}
        />
      )}

      {panels.extensions && (
        <ExtensionsPanel
          definitions={BUILT_IN_EXTENSIONS}
          values={extensions}
          role="player"
          onToggle={toggleExtension}
          onClose={() => togglePanel('extensions')}
          storageKey="vtt.player.panel.extensions"
          defaultPosition={{ x: 380, y: 380 }}
        />
      )}

      <button
        type="button"
        onClick={() => togglePanel('extensions')}
        title="Расширения"
        aria-label="Расширения"
        className={`fixed bottom-4 right-16 z-20 flex h-9 w-9 items-center justify-center rounded-lg border shadow-xl backdrop-blur-xl transition ${
          panels.extensions
            ? 'border-indigo-400/60 bg-indigo-500/30 text-indigo-100'
            : 'border-white/10 bg-[#14161f]/85 text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <PuzzleIcon size={18} />
      </button>

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
