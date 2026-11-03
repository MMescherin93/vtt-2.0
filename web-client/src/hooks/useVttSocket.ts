import { useEffect } from 'react'
import type {
  ChatMessageData,
  DiceRollResultData,
  Drawing,
  FogOfWarData,
  PlayerInfo,
  Session,
  Token,
  TokenPatch
} from '@vtt/shared'
import { SESSION_ID, socket } from '../socket'
import { useClientStore } from '../store/useClientStore'

/**
 * Подключение игрока к хосту: вход, восстановление после обрыва связи,
 * приём событий сессии (ТЗ: «Обработка отключений», «Сохранение состояния клиента»).
 */
export function useVttSocket(): void {
  useEffect(() => {
    const store = useClientStore.getState()

    if (!SESSION_ID) {
      store.setJoinError('В ссылке нет идентификатора сессии. Попросите Мастера прислать ссылку.')
      store.setStatus('error')
      return
    }

    store.setStatus('connecting')

    const onConnect = (): void => {
      useClientStore.getState().setStatus('connected')
      const { playerName } = useClientStore.getState()
      if (playerName) {
        // Автоматический вход, в том числе после переподключения
        useClientStore.getState().join(playerName)
      }
    }
    const onDisconnect = (): void => {
      // Во время переподключения стол остаётся на экране: состояние клиента
      // (камера, инструменты, сессия) сохраняется локально (ТЗ, «Обработка отключений»)
      useClientStore.getState().setStatus('disconnected')
    }
    const onConnectError = (error: Error): void => {
      useClientStore.getState().setStatus('error')
      useClientStore.getState().setJoinError(error.message)
    }

    const onSession = (session: Session): void => store.setSession(session)
    const onPlayers = (players: PlayerInfo[]): void => store.setPlayers(players)
    const onTokenUpdate = (patch: TokenPatch): void => store.patchToken(patch)
    const onTokenAdd = (token: Token): void => store.addToken(token)
    const onTokenRemove = (data: { tokenId: string }): void => store.removeToken(data.tokenId)
    const onFog = (fog: FogOfWarData): void => store.setFog(fog)
    const onDrawing = (drawing: Drawing): void => store.addDrawing(drawing)
    const onChat = (message: ChatMessageData): void => store.addChat(message)
    const onDice = (roll: DiceRollResultData): void => store.addRoll(roll)
    const onExtension = (data: { extensionId: string; state: unknown }): void =>
      store.setExtensionState(data.extensionId, data.state)
    const onError = (data: { message: string }): void => store.setNotice(data.message)
    const onClosed = (data: { reason: string }): void => {
      store.setClosed(data.reason)
      socket.disconnect()
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('session:update', onSession)
    socket.on('players:update', onPlayers)
    socket.on('token:update', onTokenUpdate)
    socket.on('token:add', onTokenAdd)
    socket.on('token:remove', onTokenRemove)
    socket.on('fog:update', onFog)
    socket.on('drawing:add', onDrawing)
    socket.on('chat:message', onChat)
    socket.on('dice:roll', onDice)
    socket.on('extension:update', onExtension)
    socket.on('error:message', onError)
    socket.on('session:closed', onClosed)

    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('session:update', onSession)
      socket.off('players:update', onPlayers)
      socket.off('token:update', onTokenUpdate)
      socket.off('token:add', onTokenAdd)
      socket.off('token:remove', onTokenRemove)
      socket.off('fog:update', onFog)
      socket.off('drawing:add', onDrawing)
      socket.off('chat:message', onChat)
      socket.off('dice:roll', onDice)
      socket.off('extension:update', onExtension)
      socket.off('error:message', onError)
      socket.off('session:closed', onClosed)
      socket.disconnect()
    }
  }, [])
}
