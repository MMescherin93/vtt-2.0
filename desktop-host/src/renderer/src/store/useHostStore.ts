import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DrawingInput,
  FogOfWarData,
  PlayerInfo,
  Session,
  SessionSummary,
  Token
} from '@vtt/shared'
import type {
  HostServerEvent,
  InviteInfo,
  ServerStatus,
  SessionPatch,
  TokenPatchInput
} from '../../../shared/ipc'
import type { DrawStyle, FogTool, Tool } from '@vtt/shared/ui'

export type HostScreen = 'sessions' | 'table'

export interface HostPanels {
  chat: boolean
  dice: boolean
  tokens: boolean
  map: boolean
  invite: boolean
  players: boolean
}

interface HostState {
  status: ServerStatus | null
  sessions: SessionSummary[]
  session: Session | null
  players: PlayerInfo[]
  screen: HostScreen
  busy: boolean
  error: string | null
  notice: string | null
  invite: InviteInfo | null

  tool: Tool
  drawStyle: DrawStyle
  fogTool: FogTool
  fogBrushSize: number
  showFogPreview: boolean
  selectedTokenId: string | null
  panels: HostPanels

  setStatus: (status: ServerStatus) => void
  setScreen: (screen: HostScreen) => void
  setError: (message: string | null) => void
  setNotice: (message: string | null) => void
  applyServerEvent: (event: HostServerEvent) => void

  refreshSessions: () => Promise<void>
  openSession: (sessionId: string) => Promise<void>
  createSession: (name: string, description: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  closeSession: () => Promise<void>

  setTool: (tool: Tool) => void
  setDrawStyle: (style: Partial<DrawStyle>) => void
  setFogTool: (tool: FogTool) => void
  setFogBrushSize: (size: number) => void
  toggleFogPreview: () => void
  setSelectedToken: (tokenId: string | null) => void
  togglePanel: (panel: keyof HostPanels) => void

  updateSessionPatch: (patch: SessionPatch) => Promise<void>
  uploadMap: (file: File) => Promise<void>
  clearMap: () => Promise<void>

  moveToken: (tokenId: string, x: number, y: number) => void
  transformToken: (
    tokenId: string,
    data: { x: number; y: number; width: number; height: number; rotation: number }
  ) => void
  updateToken: (patch: TokenPatchInput) => Promise<void>
  removeToken: (tokenId: string) => Promise<void>
  addTokenFromFile: (file: File, x: number, y: number) => Promise<void>
  addQuickToken: (name: string, x?: number, y?: number) => Promise<Token | null>

  addDrawing: (drawing: DrawingInput) => void
  changeFog: (fog: FogOfWarData) => void
  sendChat: (text: string) => void
  rollDice: (dice: string[]) => void
  refreshInvite: () => Promise<void>
}

function patchToken(
  session: Session | null,
  tokenId: string,
  patch: Partial<Token>
): Session | null {
  if (!session) return null
  return {
    ...session,
    tokens: session.tokens.map((token) => (token.id === tokenId ? { ...token, ...patch } : token))
  }
}

const DRAW_COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f8fafc']

type PersistedHostUi = Pick<
  HostState,
  'tool' | 'drawStyle' | 'fogTool' | 'fogBrushSize' | 'showFogPreview' | 'panels'
>

export const useHostStore = create<HostState>()(
  persist<HostState, [], [], PersistedHostUi>(
    (set, get) => ({
      status: null,
      sessions: [],
      session: null,
      players: [],
      screen: 'sessions',
      busy: false,
      error: null,
      notice: null,
      invite: null,

      tool: 'select',
      drawStyle: { color: DRAW_COLORS[3]!, size: 6 },
      fogTool: 'brush',
      fogBrushSize: 140,
      showFogPreview: true,
      selectedTokenId: null,
      panels: {
        chat: true,
        dice: false,
        tokens: true,
        map: false,
        invite: false,
        players: false
      },

      setStatus: (status) => set({ status }),
      setScreen: (screen) => set({ screen }),
      setError: (error) => set({ error }),
      setNotice: (notice) => set({ notice }),

      applyServerEvent: (event) => {
        const { session } = get()
        switch (event.type) {
          case 'session:update':
            set({
              session: event.session,
              screen: event.session ? 'table' : 'sessions',
              selectedTokenId: event.session ? get().selectedTokenId : null
            })
            break
          case 'players:update':
            set({ players: event.players })
            break
          case 'token:add':
            if (!session) break
            set({
              session: session.tokens.some((token) => token.id === event.token.id)
                ? session
                : { ...session, tokens: [...session.tokens, event.token] }
            })
            break
          case 'token:update':
            set({ session: patchToken(session, event.patch.tokenId, event.patch) })
            break
          case 'token:remove':
            if (!session) break
            set({
              session: {
                ...session,
                tokens: session.tokens.filter((token) => token.id !== event.tokenId)
              },
              selectedTokenId:
                get().selectedTokenId === event.tokenId ? null : get().selectedTokenId
            })
            break
          case 'fog:update':
            if (!session) break
            set({ session: { ...session, fogOfWar: event.fog } })
            break
          case 'drawing:add':
            if (!session) break
            if (session.drawings.some((drawing) => drawing.id === event.drawing.id)) break
            set({ session: { ...session, drawings: [...session.drawings, event.drawing] } })
            break
          case 'chat:message':
            if (!session) break
            set({ session: { ...session, chatLog: [...session.chatLog, event.message] } })
            break
          case 'dice:roll':
            if (!session) break
            set({ session: { ...session, rollLog: [...session.rollLog, event.roll] } })
            break
          case 'session:closed':
            set({ session: null, screen: 'sessions', players: [] })
            void get().refreshSessions()
            break
        }
      },

      refreshSessions: async () => {
        try {
          const sessions = await window.hostApi.listSessions()
          set({ sessions })
        } catch (error) {
          set({ error: `Не удалось получить список сессий: ${String(error)}` })
        }
      },

      openSession: async (sessionId) => {
        set({ busy: true, error: null })
        try {
          const session = await window.hostApi.activateSession(sessionId)
          if (session) {
            set({ session, screen: 'table', selectedTokenId: null })
            void get().refreshInvite()
          }
        } catch (error) {
          set({ error: `Не удалось открыть сессию: ${String(error)}` })
        } finally {
          set({ busy: false })
        }
      },

      createSession: async (name, description) => {
        set({ busy: true, error: null })
        try {
          const session = await window.hostApi.createSession({ name, description })
          set({ session, screen: 'table', selectedTokenId: null })
          await get().refreshSessions()
          void get().refreshInvite()
        } catch (error) {
          set({ error: `Не удалось создать сессию: ${String(error)}` })
        } finally {
          set({ busy: false })
        }
      },

      deleteSession: async (sessionId) => {
        set({ busy: true, error: null })
        try {
          await window.hostApi.deleteSession(sessionId)
          if (get().session?.id === sessionId) {
            set({ session: null, screen: 'sessions' })
          }
          await get().refreshSessions()
        } catch (error) {
          set({ error: `Не удалось удалить сессию: ${String(error)}` })
        } finally {
          set({ busy: false })
        }
      },

      closeSession: async () => {
        await window.hostApi.activateSession(null)
        set({ session: null, screen: 'sessions', players: [] })
        await get().refreshSessions()
      },

      setTool: (tool) => set({ tool }),
      setDrawStyle: (style) => set({ drawStyle: { ...get().drawStyle, ...style } }),
      setFogTool: (fogTool) => set({ fogTool }),
      setFogBrushSize: (fogBrushSize) => set({ fogBrushSize }),
      toggleFogPreview: () => set({ showFogPreview: !get().showFogPreview }),
      setSelectedToken: (selectedTokenId) => set({ selectedTokenId }),
      togglePanel: (panel) => set({ panels: { ...get().panels, [panel]: !get().panels[panel] } }),

      updateSessionPatch: async (patch) => {
        try {
          await window.hostApi.updateSession(patch)
        } catch (error) {
          set({ error: `Не удалось сохранить настройки: ${String(error)}` })
        }
      },

      uploadMap: async (file) => {
        set({ error: null })
        try {
          const data = await file.arrayBuffer()
          const asset = await window.hostApi.addAsset({ fileName: file.name, data, kind: 'map' })
          if (!asset) return
          await window.hostApi.updateSession({
            map: { imageUrl: asset.relativePath, width: asset.width, height: asset.height }
          })
          set({ notice: `Карта «${file.name}» загружена` })
        } catch (error) {
          set({ error: `Не удалось загрузить карту: ${String(error)}` })
        }
      },

      clearMap: async () => {
        await window.hostApi.updateSession({ clearMap: true })
      },

      moveToken: (tokenId, x, y) => {
        set({ session: patchToken(get().session, tokenId, { x, y }) })
        void window.hostApi.updateToken({ tokenId, x, y })
      },

      transformToken: (tokenId, data) => {
        set({ session: patchToken(get().session, tokenId, data) })
        void window.hostApi.updateToken({ tokenId, ...data })
      },

      updateToken: async (patch) => {
        await window.hostApi.updateToken(patch)
      },

      removeToken: async (tokenId) => {
        await window.hostApi.removeToken(tokenId)
      },

      addTokenFromFile: async (file, x, y) => {
        const session = get().session
        if (!session) return
        set({ error: null })
        try {
          const data = await file.arrayBuffer()
          const name = file.name.replace(/\.[^.]+$/, '')
          await window.hostApi.addToken({
            name,
            x,
            y,
            size: session.settings.gridSize,
            image: { fileName: file.name, data }
          })
        } catch (error) {
          set({ error: `Не удалось добавить токен: ${String(error)}` })
        }
      },

      addQuickToken: async (name, x, y) => {
        const session = get().session
        if (!session) return null
        const centerX = x ?? (session.map.width ? session.map.width / 2 : 960)
        const centerY = y ?? (session.map.height ? session.map.height / 2 : 540)
        try {
          return await window.hostApi.addToken({
            name: name || 'Токен',
            x: centerX,
            y: centerY,
            size: session.settings.gridSize
          })
        } catch (error) {
          set({ error: `Не удалось добавить токен: ${String(error)}` })
          return null
        }
      },

      addDrawing: (drawing) => {
        void window.hostApi.addDrawing(drawing)
      },

      changeFog: (fog) => {
        set({ session: get().session ? { ...get().session!, fogOfWar: fog } : null })
        void window.hostApi.updateFog(fog)
      },

      sendChat: (text) => {
        void window.hostApi.sendChat(text)
      },

      rollDice: (dice) => {
        void window.hostApi.rollDice(dice)
      },

      refreshInvite: async () => {
        const invite = await window.hostApi.getInvite()
        set({ invite })
      }
    }),
    {
      name: 'vtt.gm.ui',
      partialize: (state) => ({
        tool: state.tool,
        drawStyle: state.drawStyle,
        fogTool: state.fogTool,
        fogBrushSize: state.fogBrushSize,
        showFogPreview: state.showFogPreview,
        panels: state.panels
      })
    }
  )
)
