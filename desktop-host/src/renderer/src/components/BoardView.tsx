import { useEffect } from 'react'
import { BUILT_IN_EXTENSIONS, isExtensionVisible } from '@vtt/shared/plugins'
import {
  Board,
  CharacterSheetFrame,
  ChatPanel,
  DicePanel,
  FlDicePanel,
  ChevronIcon,
  ExtensionFrame,
  ExtensionsPanel,
  MapSwitcher,
  ModuleDock,
  NotesPanel,
  PdfPanel,
  PuzzleIcon,
  RootMovesPanel,
  RootRollPanel
} from '@vtt/shared/ui'
import { useAssetsBaseUrl } from '../lib/host'
import { isVideoFile } from '../lib/videoToGif'
import { useHostStore } from '../store/useHostStore'
import { HostToolbar } from './Toolbar/HostToolbar'
import { InitiativePanel } from './InitiativePanel/InitiativePanel'
import { InvitePanel } from './InvitePanel/InvitePanel'
import { MapPanel } from './MapPanel/MapPanel'
import { PlayersPanel } from './PlayersPanel/PlayersPanel'
import { TokenPanel } from './TokenPanel/TokenPanel'
import { TokenStatsPanel } from './TokenStatsPanel/TokenStatsPanel'
import { TroikaStatsPanel } from './TroikaStatsPanel/TroikaStatsPanel'

/** Стол Мастера: канвас, тулбар и плавающие панели */
export function BoardView() {
  const session = useHostStore((state) => state.session)
  const players = useHostStore((state) => state.players)
  const status = useHostStore((state) => state.status)
  const tool = useHostStore((state) => state.tool)
  const drawStyle = useHostStore((state) => state.drawStyle)
  const textSize = useHostStore((state) => state.textSize)
  const fogTool = useHostStore((state) => state.fogTool)
  const fogBrushSize = useHostStore((state) => state.fogBrushSize)
  const showFogPreview = useHostStore((state) => state.showFogPreview)
  const selectedTokenId = useHostStore((state) => state.selectedTokenId)
  const panels = useHostStore((state) => state.panels)
  const setSelectedToken = useHostStore((state) => state.setSelectedToken)
  const moveToken = useHostStore((state) => state.moveToken)
  const transformToken = useHostStore((state) => state.transformToken)
  const addDrawing = useHostStore((state) => state.addDrawing)
  const addText = useHostStore((state) => state.addText)
  const updateText = useHostStore((state) => state.updateText)
  const removeText = useHostStore((state) => state.removeText)
  const addNote = useHostStore((state) => state.addNote)
  const updateNote = useHostStore((state) => state.updateNote)
  const removeNote = useHostStore((state) => state.removeNote)
  const changeFog = useHostStore((state) => state.changeFog)
  const sendChat = useHostStore((state) => state.sendChat)
  const rollDice = useHostStore((state) => state.rollDice)
  const uploadMap = useHostStore((state) => state.uploadMap)
  const addTokenFromFile = useHostStore((state) => state.addTokenFromFile)
  const setScreen = useHostStore((state) => state.setScreen)
  const togglePanel = useHostStore((state) => state.togglePanel)
  const notice = useHostStore((state) => state.notice)
  const setNotice = useHostStore((state) => state.setNotice)
  const error = useHostStore((state) => state.error)
  const setError = useHostStore((state) => state.setError)
  const extensions = session?.enabledExtensions ?? {}
  const toggleExtension = useHostStore((state) => state.toggleExtension)
  const activeMapId = useHostStore((state) => state.activeMapId)
  const focusRequest = useHostStore((state) => state.focusRequest)
  const setActiveMap = useHostStore((state) => state.setActiveMap)
  const focusMap = useHostStore((state) => state.focusMap)
  const setExtensionState = useHostStore((state) => state.setExtensionState)
  const modulePanels = useHostStore((state) => state.modulePanels)
  const toggleModulePanel = useHostStore((state) => state.toggleModulePanel)

  const chatEnabled = extensions['chat'] ?? true
  const diceEnabled = extensions['dice'] ?? true
  const labelsEnabled =
    (extensions['token-labels'] ?? true) && (session?.settings.showTokenNames ?? true)
  const troikaEnabled = extensions['troika-initiative'] ?? false
  const troikaOpen = troikaEnabled && (modulePanels['troika-initiative'] ?? false)
  const sheetEnabled = extensions['troika-sheet'] ?? false
  const sheetOpen = sheetEnabled && (modulePanels['troika-sheet'] ?? false)
  const azagEnabled = extensions['azag-sheet'] ?? false
  const azagOpen = azagEnabled && (modulePanels['azag-sheet'] ?? false)
  const dice3dEnabled = extensions['dice3d'] ?? false
  const dice3dOpen = dice3dEnabled && (modulePanels['dice3d'] ?? false)
  const statsEnabled = extensions['token-stats'] ?? false
  const statsOpen = statsEnabled && (modulePanels['token-stats'] ?? false)
  const troikaStatsEnabled = extensions['troika-token-stats'] ?? false
  const troikaStatsOpen = troikaStatsEnabled && (modulePanels['troika-token-stats'] ?? false)
  const initiativeEnabled = extensions['initiative'] ?? false
  const initiativeOpen = initiativeEnabled && (modulePanels['initiative'] ?? false)
  const pdfEnabled = extensions['pdf-viewer'] ?? false
  const pdfOpen = pdfEnabled && (modulePanels['pdf-viewer'] ?? false)
  const notesEnabled = extensions['notes'] ?? false
  const notesOpen = notesEnabled && (modulePanels['notes'] ?? false)
  const flSheetEnabled = extensions['forbidden-lands-sheet'] ?? false
  const flSheetOpen = flSheetEnabled && (modulePanels['forbidden-lands-sheet'] ?? false)
  const flDiceEnabled = extensions['fl-dice'] ?? false
  const flDiceOpen = flDiceEnabled && (modulePanels['fl-dice'] ?? false)
  const agonSheetEnabled = extensions['agon-sheet'] ?? false
  const agonSheetOpen = agonSheetEnabled && (modulePanels['agon-sheet'] ?? false)
  const rootSheetEnabled = extensions['root-sheet'] ?? false
  const rootSheetOpen = rootSheetEnabled && (modulePanels['root-sheet'] ?? false)
  const rootRollEnabled = extensions['root-roll'] ?? false
  const rootRollOpen = rootRollEnabled && (modulePanels['root-roll'] ?? false)
  const rootMovesEnabled = extensions['root-moves'] ?? false
  const rootMovesOpen = rootMovesEnabled && (modulePanels['root-moves'] ?? false)

  // Активированные модули с панелью получают иконку в доке справа сверху
  const dockModules = BUILT_IN_EXTENSIONS.filter(
    (definition) =>
      definition.panel &&
      definition.icon &&
      isExtensionVisible(definition, 'gm') &&
      (extensions[definition.id] ?? definition.defaultEnabled)
  )

  const assetsBaseUrl = useAssetsBaseUrl()

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice, setNotice])

  if (!session) return null

  const hasMap = session.maps.length > 0

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Board
        session={session}
        role="gm"
        tool={tool}
        drawStyle={drawStyle}
        textSize={textSize}
        fogTool={fogTool}
        fogBrushSize={fogBrushSize}
        showFogPreview={showFogPreview}
        assetsBaseUrl={assetsBaseUrl}
        cameraKey={`gm-${session.id}`}
        selectedTokenId={selectedTokenId}
        onSelectToken={setSelectedToken}
        onMoveToken={moveToken}
        onTransformToken={transformToken}
        onAddDrawing={addDrawing}
        onAddText={addText}
        onUpdateText={updateText}
        onRemoveText={removeText}
        onFogChange={changeFog}
        showTokenLabels={labelsEnabled}
        focusMap={focusRequest}
        onActiveMapChange={setActiveMap}
        onFilesDropped={(files, world) => {
          const media = files.find(
            (file) => file.type.startsWith('image/') || isVideoFile(file)
          )
          if (!media) {
            setError('Можно перетаскивать изображения (PNG, JPEG, WebP, GIF) и видео (MP4, WebM)')
            return
          }
          if (!hasMap || isVideoFile(media)) void uploadMap(media)
          else void addTokenFromFile(media, world.x, world.y)
        }}
      />

      <div className="pointer-events-none fixed left-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14161f]/85 px-2.5 py-1.5 shadow-xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setScreen('sessions')}
          className="pointer-events-auto flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-gray-400 transition hover:bg-white/10 hover:text-white"
          title="К списку сессий"
        >
          <ChevronIcon size={14} className="rotate-180" />
          Сессии
        </button>
        <span className="h-5 w-px bg-white/10" />
        <div className="max-w-56">
          <div className="truncate text-sm font-semibold text-gray-100">{session.name}</div>
          <div className="text-[11px] text-gray-500">
            {players.length} игроков ·{' '}
            {status?.servingClient ? `порт ${status.port}` : 'клиент на 5173'}
          </div>
        </div>
      </div>

      <HostToolbar />

      <MapSwitcher
        maps={session.maps}
        sessionId={session.id}
        assetsBaseUrl={assetsBaseUrl}
        activeMapId={activeMapId}
        onSelect={focusMap}
      />

      {chatEnabled && panels.chat && (
        <ChatPanel
          messages={session.chatLog}
          currentUserId="gm"
          players={players}
          onSend={sendChat}
          onClose={() => togglePanel('chat')}
          storageKey="vtt.gm.panel.chat"
          defaultPosition={{ x: 24, y: 320 }}
        />
      )}
      {diceEnabled && panels.dice && (
        <DicePanel
          history={session.rollLog}
          onRoll={rollDice}
          onClose={() => togglePanel('dice')}
          storageKey="vtt.gm.panel.dice"
          defaultPosition={{ x: 360, y: 320 }}
        />
      )}
      <TokenPanel />
      <MapPanel />
      <InvitePanel />
      <PlayersPanel />

      {troikaOpen && (
        <ExtensionFrame
          title="Инициатива «Тройка»"
          src={`${assetsBaseUrl}/extensions/troika-initiative/index.html`}
          extensionId="troika-initiative"
          role="gm"
          metaKey="com.troika.initiative/state"
          state={session.extensionState['troika-initiative'] ?? null}
          onChange={(next) => void setExtensionState('troika-initiative', next)}
          onClose={() => toggleModulePanel('troika-initiative', false)}
          width={760}
          height={620}
          storageKey="vtt.gm.panel.troika"
          defaultPosition={{ x: 300, y: 60 }}
        />
      )}

      {sheetOpen && (
        <CharacterSheetFrame
          title="Лист персонажа «Тройка»"
          src={`${assetsBaseUrl}/extensions/troika-sheet/index.html`}
          extensionId="troika-sheet"
          role="gm"
          metaKey="com.troika.sheet/state"
          perClientSelection
          mergeListKey="chars"
          state={session.extensionState['troika-sheet'] ?? null}
          onChange={(next) => void setExtensionState('troika-sheet', next)}
          onClose={() => toggleModulePanel('troika-sheet', false)}
          width={920}
          height={720}
          storageKey="vtt.gm.panel.sheet"
          defaultPosition={{ x: 240, y: 40 }}
        />
      )}

      {azagOpen && (
        <CharacterSheetFrame
          title="Лист персонажа AZAG"
          src={`${assetsBaseUrl}/extensions/azag-sheet/index.html`}
          extensionId="azag-sheet"
          role="gm"
          metaKey="com.azag.sheet/state"
          perClientSelection
          mergeListKey="chars"
          state={session.extensionState['azag-sheet'] ?? null}
          onChange={(next) => void setExtensionState('azag-sheet', next)}
          onClose={() => toggleModulePanel('azag-sheet', false)}
          width={Math.min(1440, window.innerWidth - 48)}
          height={Math.min(880, window.innerHeight - 150)}
          storageKey="vtt.gm.panel.azag"
          defaultPosition={{ x: 60, y: 14 }}
        />
      )}

      {dice3dOpen && (
        <ExtensionFrame
          title="3D-кубики"
          src={`${assetsBaseUrl}/extensions/dice3d/index.html`}
          extensionId="dice3d"
          role="gm"
          state={null}
          onChat={(text) => sendChat(text)}
          onClose={() => toggleModulePanel('dice3d', false)}
          width={920}
          height={Math.min(660, window.innerHeight - 200)}
          storageKey="vtt.gm.panel.dice3d"
          defaultPosition={{ x: 320, y: 80 }}
        />
      )}

      {statsOpen && <TokenStatsPanel />}
      {troikaStatsOpen && <TroikaStatsPanel />}
      {initiativeOpen && <InitiativePanel />}

      {notesOpen && (
        <NotesPanel
          sessionId={session.id}
          role="gm"
          ownerKey="gm"
          notes={session.notes}
          onAdd={(note) => addNote(note)}
          onUpdate={(patch) => updateNote(patch)}
          onRemove={(noteId) => removeNote(noteId)}
          onClose={() => toggleModulePanel('notes', false)}
          storageKey="vtt.gm.panel.notes"
        />
      )}

      {pdfOpen && (
        <PdfPanel
          sessionId={session.id}
          assetsBaseUrl={assetsBaseUrl}
          pdfs={session.pdfs}
          canManage
          onPick={() => window.hostApi.pickPdf()}
          onRemove={(pdfId) => window.hostApi.removePdf(pdfId)}
          onClose={() => toggleModulePanel('pdf-viewer', false)}
          storageKey="vtt.gm.panel.pdf"
        />
      )}

      {flSheetOpen && (
        <CharacterSheetFrame
          title="Лист «Запретные земли»"
          src={`${assetsBaseUrl}/extensions/forbidden-lands-sheet/index.html`}
          extensionId="forbidden-lands-sheet"
          role="gm"
          metaKey="com.forbiddenlands.sheet/state"
          perClientSelection
          mergeListKey="chars"
          state={session.extensionState['forbidden-lands-sheet'] ?? null}
          onChange={(next) => void setExtensionState('forbidden-lands-sheet', next)}
          onClose={() => toggleModulePanel('forbidden-lands-sheet', false)}
          width={920}
          height={720}
          storageKey="vtt.gm.panel.forbidden-lands"
          defaultPosition={{ x: 240, y: 40 }}
        />
      )}

      {flDiceOpen && (
        <FlDicePanel
          onSendChat={sendChat}
          onClose={() => toggleModulePanel('fl-dice', false)}
          storageKey="vtt.gm.panel.fl-dice"
        />
      )}

      {agonSheetOpen && (
        <CharacterSheetFrame
          title="Агон — лист героя"
          src={`${assetsBaseUrl}/extensions/agon-sheet/index.html`}
          extensionId="agon-sheet"
          role="gm"
          metaKey="com.agon.sheet/state"
          perClientSelection
          mergeListKey="chars"
          state={session.extensionState['agon-sheet'] ?? null}
          onChange={(next) => void setExtensionState('agon-sheet', next)}
          onClose={() => toggleModulePanel('agon-sheet', false)}
          width={1000}
          height={760}
          storageKey="vtt.gm.panel.agon-sheet"
          defaultPosition={{ x: 180, y: 20 }}
        />
      )}

      {rootSheetOpen && (
        <CharacterSheetFrame
          title="Корни — лист персонажа"
          src={`${assetsBaseUrl}/extensions/root-sheet/index.html`}
          extensionId="root-sheet"
          role="gm"
          allowPlayerWrite
          metaKey="com.root.sheet/state"
          perClientSelection
          mergeListKey="chars"
          state={session.extensionState['root-sheet'] ?? null}
          onChange={(next) => void setExtensionState('root-sheet', next)}
          onChat={sendChat}
          onClose={() => toggleModulePanel('root-sheet', false)}
          width={1000}
          height={760}
          storageKey="vtt.gm.panel.root-sheet"
          defaultPosition={{ x: 160, y: 18 }}
        />
      )}

      {rootRollOpen && (
        <RootRollPanel
          onSendChat={sendChat}
          onClose={() => toggleModulePanel('root-roll', false)}
          storageKey="vtt.gm.panel.root-roll"
        />
      )}

      {rootMovesOpen && (
        <RootMovesPanel
          state={session.extensionState['root-moves'] ?? null}
          onChange={(next) => void setExtensionState('root-moves', next)}
          sheetState={session.extensionState['root-sheet'] ?? null}
          onSheetChange={(next) => void setExtensionState('root-sheet', next)}
          onSendChat={sendChat}
          onClose={() => toggleModulePanel('root-moves', false)}
          storageKey="vtt.gm.panel.root-moves"
        />
      )}

      <ModuleDock
        modules={dockModules}
        open={modulePanels}
        baseUrl={assetsBaseUrl}
        onToggle={(extensionId) => toggleModulePanel(extensionId)}
      />

      {panels.extensions && (
        <ExtensionsPanel
          definitions={BUILT_IN_EXTENSIONS}
          values={extensions}
          role="gm"
          onToggle={toggleExtension}
          onClose={() => togglePanel('extensions')}
          storageKey="vtt.gm.panel.extensions.v2"
          defaultPosition={{ x: 380, y: 380 }}
        />
      )}

      <button
        type="button"
        onClick={() => togglePanel('extensions')}
        title="Расширения"
        aria-label="Расширения"
        className={`fixed bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border shadow-xl backdrop-blur-xl transition ${
          panels.extensions
            ? 'border-indigo-400/60 bg-indigo-500/30 text-indigo-100'
            : 'border-white/10 bg-[#14161f]/85 text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <PuzzleIcon size={18} />
      </button>

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 shadow-xl backdrop-blur">
          {notice}
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm text-red-100 shadow-xl backdrop-blur">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-200 transition hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
