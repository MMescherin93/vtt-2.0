import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AddAssetInput,
  AddTokenInput,
  AssetResult,
  CreateSessionInput,
  HostApi,
  HostServerEvent,
  InviteInfo,
  ServerStatus,
  SessionPatch,
  TokenPatchInput
} from '../shared/ipc'
import { IPC } from '../shared/ipc'
import type {
  CombatState,
  DrawingInput,
  FogOfWarData,
  MapTextInput,
  MapTextPatch,
  NoteInput,
  NotePatch,
  PdfDocument,
  Session,
  SessionSummary,
  Token
} from '@vtt/shared'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.off(channel, listener)
  }
}

const hostApi: HostApi = {
  getServerStatus: () => ipcRenderer.invoke(IPC.serverStatusGet) as Promise<ServerStatus>,
  onServerStatus: (callback) => subscribe<ServerStatus>(IPC.serverStatusEvent, callback),
  onServerEvent: (callback) => subscribe<HostServerEvent>(IPC.serverEvent, callback),

  listSessions: () => ipcRenderer.invoke(IPC.sessionsList) as Promise<SessionSummary[]>,
  createSession: (input: CreateSessionInput) =>
    ipcRenderer.invoke(IPC.sessionsCreate, input) as Promise<Session>,
  deleteSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC.sessionsDelete, sessionId) as Promise<void>,
  activateSession: (sessionId: string | null) =>
    ipcRenderer.invoke(IPC.sessionsActivate, sessionId) as Promise<Session | null>,
  getActiveSession: () => ipcRenderer.invoke(IPC.sessionsActive) as Promise<Session | null>,
  updateSession: (patch: SessionPatch) =>
    ipcRenderer.invoke(IPC.sessionUpdate, patch) as Promise<Session | null>,

  addAsset: (input: AddAssetInput) =>
    ipcRenderer.invoke(IPC.sessionAddAsset, input) as Promise<AssetResult | null>,
  addToken: (input: AddTokenInput) =>
    ipcRenderer.invoke(IPC.tokenAdd, input) as Promise<Token | null>,
  updateToken: (patch: TokenPatchInput) =>
    ipcRenderer.invoke(IPC.tokenUpdate, patch) as Promise<void>,
  removeToken: (tokenId: string) => ipcRenderer.invoke(IPC.tokenRemove, tokenId) as Promise<void>,

  updateFog: (fog: FogOfWarData) => ipcRenderer.invoke(IPC.fogUpdate, fog) as Promise<void>,
  addDrawing: (drawing: DrawingInput) =>
    ipcRenderer.invoke(IPC.drawingAdd, drawing) as Promise<void>,
  addText: (input: MapTextInput) => ipcRenderer.invoke(IPC.textAdd, input) as Promise<void>,
  updateText: (patch: MapTextPatch) => ipcRenderer.invoke(IPC.textUpdate, patch) as Promise<void>,
  removeText: (textId: string) => ipcRenderer.invoke(IPC.textRemove, textId) as Promise<void>,
  pickPdf: () => ipcRenderer.invoke(IPC.pdfPick) as Promise<PdfDocument | null>,
  removePdf: (pdfId: string) => ipcRenderer.invoke(IPC.pdfRemove, pdfId) as Promise<boolean>,
  addNote: (note: NoteInput) => ipcRenderer.invoke(IPC.noteAdd, note) as Promise<void>,
  updateNote: (patch: NotePatch) => ipcRenderer.invoke(IPC.noteUpdate, patch) as Promise<void>,
  removeNote: (noteId: string) => ipcRenderer.invoke(IPC.noteRemove, noteId) as Promise<void>,
  sendChat: (text: string) => ipcRenderer.invoke(IPC.chatSend, text) as Promise<void>,
  rollDice: (dice: string[]) => ipcRenderer.invoke(IPC.diceRoll, dice) as Promise<void>,
  setExtensionState: (extensionId: string, state: unknown) =>
    ipcRenderer.invoke(IPC.extensionUpdate, extensionId, state) as Promise<void>,
  setCombat: (combat: CombatState | null) =>
    ipcRenderer.invoke(IPC.combatUpdate, combat) as Promise<void>,

  getInvite: () => ipcRenderer.invoke(IPC.inviteGet) as Promise<InviteInfo>,
  setTunnelUrl: (url: string | null) =>
    ipcRenderer.invoke(IPC.inviteSetTunnelUrl, url) as Promise<InviteInfo>,
  startTunnel: () => ipcRenderer.invoke(IPC.tunnelStart) as Promise<InviteInfo>,
  stopTunnel: () => ipcRenderer.invoke(IPC.tunnelStop) as Promise<InviteInfo>
}

contextBridge.exposeInMainWorld('hostApi', hostApi)
