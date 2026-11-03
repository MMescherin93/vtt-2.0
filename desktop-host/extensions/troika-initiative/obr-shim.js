/**
 * Адаптер Owlbear Rodeo SDK для VTT.
 *
 * Расширение «Стек инициативы Тройка» подключает @owlbear-rodeo/sdk по CDN.
 * Хост VTT подменяет только URL импорта при отдаче app.js (сам файл не меняется)
 * и отдаёт этот модуль. Он реализует ровно тот срез SDK, который использует
 * расширение, и связывает состояние сцены с сессией VTT через postMessage:
 *
 *   iframe  -> parent: hello, getMetadata, setMetadata
 *   parent  -> iframe: role, metadata, ready
 *
 * Метаданные сцены Owlbear представлены как { [META_KEY]: state }, поэтому
 * расширение видит привычную структуру.
 */

const EXT_ID = 'troika-initiative'
const META_KEY = 'com.troika.initiative/state'

const wrapState = (state) => ({ [META_KEY]: state })

function send(message) {
  try {
    window.parent.postMessage({ __vttExt: EXT_ID, ...message }, '*')
  } catch (error) {
    console.warn('[vtt-obr-shim] не удалось отправить сообщение:', error)
  }
}

let role = null
let state = null
let hasState = false
let ready = false

const roleResolvers = []
const readyCallbacks = []
const metadataCallbacks = []
const playerCallbacks = []
const requests = new Map()
let requestSeq = 0

function resolveReady() {
  if (ready) return
  ready = true
  readyCallbacks.splice(0).forEach((callback) => {
    try {
      callback()
    } catch (error) {
      console.warn('[vtt-obr-shim] onReady:', error)
    }
  })
}

function applyRole(value) {
  const next = value === 'GM' ? 'GM' : 'PLAYER'
  if (role === next) return
  role = next
  roleResolvers.splice(0).forEach((resolve) => resolve(next))
  playerCallbacks.forEach((callback) => {
    try {
      callback({ role: next })
    } catch (error) {
      console.warn('[vtt-obr-shim] player.onChange:', error)
    }
  })
  resolveReady()
}

function applyState(value) {
  state = value
  hasState = true
  metadataCallbacks.forEach((callback) => {
    try {
      callback(wrapState(value))
    } catch (error) {
      console.warn('[vtt-obr-shim] scene.onMetadataChange:', error)
    }
  })
}

function requestState() {
  return new Promise((resolve) => {
    const reqId = ++requestSeq
    requests.set(reqId, resolve)
    send({ type: 'getMetadata', reqId })
    setTimeout(() => {
      if (!requests.has(reqId)) return
      requests.delete(reqId)
      resolve(wrapState(hasState ? state : null))
    }, 3000)
  })
}

window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.__vttExt !== EXT_ID) return

  if (data.type === 'role') {
    applyRole(data.role)
    return
  }
  if (data.type === 'metadata') {
    applyState(data.state ?? null)
    if (data.reqId && requests.has(data.reqId)) {
      const resolve = requests.get(data.reqId)
      requests.delete(data.reqId)
      resolve(wrapState(data.state ?? null))
    }
    return
  }
  if (data.type === 'ready') resolveReady()
})

const scene = {
  getMetadata() {
    return hasState ? Promise.resolve(wrapState(state)) : requestState()
  },
  setMetadata(meta) {
    const value =
      meta && typeof meta === 'object' ? meta[META_KEY] ?? (meta.items && meta.items[META_KEY]) : undefined
    if (value !== undefined) {
      state = value
      hasState = true
      send({ type: 'setMetadata', state: value })
    }
    return Promise.resolve()
  },
  onMetadataChange(callback) {
    metadataCallbacks.push(callback)
    return () => {
      const index = metadataCallbacks.indexOf(callback)
      if (index >= 0) metadataCallbacks.splice(index, 1)
    }
  }
}

const player = {
  getRole() {
    if (role) return Promise.resolve(role)
    return new Promise((resolve) => {
      roleResolvers.push(resolve)
      send({ type: 'hello' })
    })
  },
  onChange(callback) {
    playerCallbacks.push(callback)
    if (role) {
      try {
        callback({ role })
      } catch (error) {
        console.warn('[vtt-obr-shim] player.onChange:', error)
      }
    }
    return () => {
      const index = playerCallbacks.indexOf(callback)
      if (index >= 0) playerCallbacks.splice(index, 1)
    }
  }
}

const OBR = {
  isAvailable: true,
  onReady(callback) {
    if (ready) {
      try {
        callback()
      } catch (error) {
        console.warn('[vtt-obr-shim] onReady:', error)
      }
      return
    }
    readyCallbacks.push(callback)
  },
  player,
  scene,
  // Заглушки на случай обращений к неиспользуемым частям SDK
  room: {},
  party: {},
  viewport: {},
  notification: { show: () => Promise.resolve() }
}

Object.defineProperty(OBR, 'isReady', { get: () => ready })

// Сообщаем хосту, что адаптер загружен и ждёт роль с состоянием
send({ type: 'hello' })

export default OBR
