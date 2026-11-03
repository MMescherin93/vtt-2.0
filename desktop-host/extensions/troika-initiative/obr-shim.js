/**
 * Адаптер Owlbear Rodeo SDK для VTT.
 *
 * Расширения «Стек инициативы» и «Лист персонажа» подключают
 * @owlbear-rodeo/sdk по CDN. Хост VTT подменяет только URL импорта при отдаче
 * app.js (сам файл не меняется) и отдаёт этот модуль. Он реализует ровно тот
 * срез SDK, который используют расширения, и связывает метаданные сцены
 * с сессией VTT через postMessage:
 *
 *   iframe  -> parent: hello, getMetadata, setMetadata
 *   parent  -> iframe: config, role, metadata, ready
 *
 * Метаданные Owlbear представлены как { [metaKey]: state }, где metaKey
 * приходит от хоста (у каждого модуля свой).
 */

/** id модуля определяется по пути: /extensions/<id>/obr-shim.js */
function detectExtensionId() {
  try {
    const match = window.location.pathname.match(/\/extensions\/([^/]+)\//)
    if (match) return match[1]
  } catch {
    /* не в браузере */
  }
  return 'troika-initiative'
}

const EXT_ID = detectExtensionId()
let metaKey = `com.troika.${EXT_ID.replace(/^troika-/, '')}/state`

const wrapState = (state) => ({ [metaKey]: state })

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
/** Последнее отправленное состояние — чтобы не дублировать запись room+scene */
let lastSentJson = null

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
  try {
    // Если пришло чужое состояние, разрешаем отправить такое же ещё раз
    if (JSON.stringify(value) !== lastSentJson) lastSentJson = null
  } catch {
    lastSentJson = null
  }
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
  if (data.type === 'config' && typeof data.metaKey === 'string' && data.metaKey) {
    metaKey = data.metaKey
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
      meta && typeof meta === 'object'
        ? meta[metaKey] ?? (meta.items && meta.items[metaKey])
        : undefined
    if (value === undefined) return Promise.resolve()

    let json = null
    try {
      json = JSON.stringify(value)
    } catch {
      json = null
    }
    // Расширения могут писать и в room, и в scene — дубликат не отправляем
    if (json !== null && json === lastSentJson) return Promise.resolve()

    state = value
    hasState = true
    if (json !== null) lastSentJson = json
    send({ type: 'setMetadata', state: value })
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

/**
 * В Owlbear Rodeo метаданные комнаты и сцены — разные хранилища.
 * В VTT общее состояние сессии одно, поэтому room — это тот же scene.
 */
const room = {
  getMetadata: () => scene.getMetadata(),
  setMetadata: (meta) => scene.setMetadata(meta),
  onMetadataChange: (callback) => scene.onMetadataChange(callback)
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
  room,
  // Заглушки на случай обращений к неиспользуемым частям SDK
  party: {},
  viewport: {},
  notification: { show: () => Promise.resolve() }
}

Object.defineProperty(OBR, 'isReady', { get: () => ready })

// Сообщаем хосту, что адаптер загружен и ждёт роль с состоянием
send({ type: 'hello' })

export default OBR
