import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ChatMessageData,
  DiceRollResultData,
  Drawing,
  DrawingInput,
  FogOfWarData,
  PlayerInfo,
  Session,
  Token,
  TokenPatch
} from '@vtt/shared'
import { newId } from '@vtt/shared/utils'
import {
  BUILT_IN_EXTENSIONS,
  defaultExtensionValues,
  type ExtensionValues
} from '@vtt/shared/plugins'
import type { DrawStyle, MapFocusRequest, Tool } from '@vtt/shared/ui'
import { SESSION_ID, socket } from '../socket'

export type ClientStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

const NAME_STORAGE_KEY = 'vtt.playerName'

interface ClientState {
  session: Session | null
  players: PlayerInfo[]
  status: ClientStatus
  joined: boolean
  selfId: string
  playerName: string
  joinError: string | null
  closedReason: string | null
  notice: string | null

  tool: Tool
  drawStyle: DrawStyle
  selectedTokenId: string | null
  panels: { chat: boolean; dice: boolean; extensions: boolean }
  /** Включённость расширений (см. shared/plugins) */
  extensions: ExtensionValues
  /** Карта, которая сейчас в центре экрана (мини-индикатор) */
  activeMapId: string | null
  /** Запрос перелёта камеры к карте */
  focusRequest: MapFocusRequest | null

  setStatus: (status: ClientStatus) => void
  setJoined: (joined: boolean, selfId?: string) => void
  setPlayerName: (name: string) => void
  join: (name: string) => void
  setSession: (session: Session | null) => void
  setPlayers: (players: PlayerInfo[]) => void
  setClosed: (reason: string) => void
  setJoinError: (message: string | null) => void
  setNotice: (message: string | null) => void

  patchToken: (patch: TokenPatch) => void
  addToken: (token: Token) => void
  removeToken: (tokenId: string) => void
  setFog: (fog: FogOfWarData) => void
  addDrawing: (drawing: Drawing) => void
  addChat: (message: ChatMessageData) => void
  addRoll: (roll: DiceRollResultData) => void
  setExtensionState: (extensionId: string, state: unknown) => void

  moveToken: (tokenId: string, x: number, y: number) => void
  transformToken: (
    tokenId: string,
    data: { x: number; y: number; width: number; height: number; rotation: number }
  ) => void
  sendDrawing: (drawing: DrawingInput) => void
  sendChat: (text: string) => void
  requestRoll: (dice: string[]) => void

  setTool: (tool: Tool) => void
  setDrawStyle: (style: Partial<DrawStyle>) => void
  setSelectedToken: (tokenId: string | null) => void
  togglePanel: (panel: 'chat' | 'dice' | 'extensions') => void
  toggleExtension: (extensionId: string, enabled: boolean) => void
  setActiveMap: (mapId: string | null) => void
  focusMap: (mapId: string) => void
}

function withTokenPatch(session: Session | null, patch: TokenPatch): Session | null {
  if (!session) return null
  return {
    ...session,
    tokens: session.tokens.map((token) =>
      token.id === patch.tokenId
        ? {
            ...token,
            x: patch.x ?? token.x,
            y: patch.y ?? token.y,
            width: patch.width ?? token.width,
            height: patch.height ?? token.height,
            rotation: patch.rotation ?? token.rotation
          }
        : token
    )
  }
}

type PersistedClientUi = Pick<ClientState, 'tool' | 'drawStyle' | 'panels' | 'extensions'>

export const useClientStore = create<ClientState>()(
  persist<ClientState, [], [], PersistedClientUi>(
    (set, get) => ({
      session: null,
      players: [],
      status: 'idle',
      joined: false,
      selfId: '',
      playerName: localStorage.getItem(NAME_STORAGE_KEY) ?? '',
      joinError: null,
      closedReason: null,
      notice: null,

      tool: 'select',
      drawStyle: { color: '#38bdf8', size: 6 },
      selectedTokenId: null,
      panels: { chat: true, dice: false, extensions: false },
      extensions: defaultExtensionValues(BUILT_IN_EXTENSIONS),
      activeMapId: null,
      focusRequest: null,

      setStatus: (status) => set({ status }),
      setJoined: (joined, selfId) =>
        set({
          joined,
          selfId: selfId ?? get().selfId,
          closedReason: joined ? null : get().closedReason
        }),
      setPlayerName: (playerName) => set({ playerName }),
      join: (name) => {
        const playerName = name.trim().slice(0, 32) || 'Игрок'
        set({ playerName, joinError: null })
        try {
          localStorage.setItem(NAME_STORAGE_KEY, playerName)
        } catch {
          // localStorage может быть недоступен
        }
        if (!SESSION_ID) {
          set({ joinError: 'В ссылке нет идентификатора сессии' })
          return
        }
        if (!socket.connected) {
          socket.connect()
          return
        }
        socket.emit('client:join', { sessionId: SESSION_ID, playerName }, (ack) => {
          if (ack.ok) {
            set({ joined: true, selfId: socket.id ?? '', closedReason: null })
          } else {
            set({ joinError: ack.error ?? 'Не удалось подключиться к сессии', joined: false })
          }
        })
      },
      setSession: (session) => set({ session }),
      setExtensionState: (extensionId, state) => {
        const session = get().session
        if (!session) return
        set({
          session: {
            ...session,
            extensionState: { ...session.extensionState, [extensionId]: state }
          }
        })
      },
      setPlayers: (players) => set({ players }),
      setClosed: (reason) =>
        set({ closedReason: reason, joined: false, session: null, players: [] }),
      setJoinError: (joinError) => set({ joinError }),
      setNotice: (notice) => set({ notice }),

      patchToken: (patch) => set({ session: withTokenPatch(get().session, patch) }),
      addToken: (token) => {
        const session = get().session
        if (!session) return
        if (session.tokens.some((item) => item.id === token.id)) return
        set({ session: { ...session, tokens: [...session.tokens, token] } })
      },
      removeToken: (tokenId) => {
        const session = get().session
        if (!session) return
        set({
          session: { ...session, tokens: session.tokens.filter((token) => token.id !== tokenId) },
          selectedTokenId: get().selectedTokenId === tokenId ? null : get().selectedTokenId
        })
      },
      setFog: (fog) => {
        const session = get().session
        if (!session) return
        set({ session: { ...session, fogOfWar: fog } })
      },
      addDrawing: (drawing) => {
        const session = get().session
        if (!session) return
        if (session.drawings.some((item) => item.id === drawing.id)) return
        set({ session: { ...session, drawings: [...session.drawings, drawing] } })
      },
      addChat: (message) => {
        const session = get().session
        if (!session) return
        set({
          session: {
            ...session,
            chatLog: [...session.chatLog, { ...message, id: newId('msg') }]
          }
        })
      },
      addRoll: (roll) => {
        const session = get().session
        if (!session) return
        set({
          session: {
            ...session,
            rollLog: [...session.rollLog, { ...roll, id: newId('roll') }]
          }
        })
      },

      moveToken: (tokenId, x, y) => {
        set({ session: withTokenPatch(get().session, { tokenId, x, y }) })
        socket.emit('token:move', { tokenId, x, y })
      },
      transformToken: (tokenId, data) => {
        set({ session: withTokenPatch(get().session, { tokenId, ...data }) })
        socket.emit('token:update', { tokenId, ...data })
      },
      sendDrawing: (drawing) => {
        socket.emit('drawing:add', drawing)
      },
      sendChat: (text) => {
        const value = text.trim()
        if (!value) return
        socket.emit('chat:send', { text: value })
      },
      requestRoll: (dice) => {
        if (dice.length === 0) return
        socket.emit('dice:roll', { dice })
      },

      setTool: (tool) => set({ tool }),
      setDrawStyle: (style) => set({ drawStyle: { ...get().drawStyle, ...style } }),
      setSelectedToken: (selectedTokenId) => set({ selectedTokenId }),
      togglePanel: (panel) => set({ panels: { ...get().panels, [panel]: !get().panels[panel] } }),
      setActiveMap: (activeMapId) => set({ activeMapId }),
      focusMap: (mapId) =>
        set((state) => ({
          focusRequest: { mapId, seq: (state.focusRequest?.seq ?? 0) + 1 }
        })),

      toggleExtension: (extensionId, enabled) => {
        const extensions = { ...get().extensions, [extensionId]: enabled }
        const patch: Partial<ClientState> = { extensions }
        const tool = get().tool
        if (extensionId === 'drawing' && !enabled && (tool === 'draw' || tool === 'erase')) {
          patch.tool = 'select'
        }
        if (extensionId === 'chat' && !enabled) {
          patch.panels = { ...get().panels, chat: false }
        }
        if (extensionId === 'dice' && !enabled) {
          patch.panels = { ...get().panels, dice: false }
        }
        set(patch)
      }
    }),
    {
      name: 'vtt.player.ui',
      partialize: (state) => ({
        tool: state.tool,
        drawStyle: state.drawStyle,
        panels: state.panels,
        extensions: state.extensions
      })
    }
  )
)
