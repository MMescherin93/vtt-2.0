import { FIELDS } from './fields.generated.js'

/**
 * AZAG — редактируемый лист персонажа.
 *
 * Внутри VTT модуль получает состояние из метаданных сессии через
 * obr-shim.js и сохраняет изменения туда же. Открытый отдельно в браузере —
 * работает на localStorage.
 *
 * Формат состояния: { currentId, chars: [{ id, fields }] } — как у листа
 * «Тройки», поэтому мост умеет держать у каждого пользователя свой лист
 * и объединять правки разных листов.
 */

const META_KEY = 'com.azag.sheet/state'
const LOCAL_KEY = 'azag-sheet-v1'
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm'
const TIMEOUT_MS = 4000
const DESIGN_W = 1123.2
const DESIGN_H = 793.6
const MAX_TEXT = 4000
const MAX_LINE = 220

const $ = (id) => document.getElementById(id)

function withTimeout(promise, ms, fallback) {
  const safe = Promise.resolve(promise).then(
    (value) => value,
    () => fallback
  )
  return Promise.race([
    safe,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

function makeId() {
  try {
    return `c_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `c_${Math.random().toString(36).slice(2, 10)}`
  }
}

/* ------------------------------------------------------------------ */
/* Состояние                                                          */
/* ------------------------------------------------------------------ */

const blankFields = () => {
  const fields = {}
  for (const field of FIELDS) fields[field.name] = field.kind === 'checkbox' ? false : ''
  return fields
}

const newCharacter = (fields) => ({
  id: makeId(),
  fields: { ...blankFields(), ...(fields ?? {}) }
})

let state = { currentId: null, chars: [] }

function normalizeFields(saved) {
  const fields = {}
  for (const field of FIELDS) {
    const value = saved && typeof saved === 'object' ? saved[field.name] : undefined
    if (field.kind === 'checkbox') {
      fields[field.name] = Boolean(value)
    } else {
      fields[field.name] =
        typeof value === 'string' ? value.slice(0, field.multiline ? MAX_TEXT : MAX_LINE) : ''
    }
  }
  return fields
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.chars) || raw.chars.length === 0) return null
  const chars = raw.chars.slice(0, 50).map((char) => ({
    id: char && typeof char.id === 'string' && char.id ? char.id : makeId(),
    fields: normalizeFields(char && char.fields)
  }))
  return {
    currentId: typeof raw.currentId === 'string' ? raw.currentId : chars[0].id,
    chars
  }
}

function ensureState() {
  if (!Array.isArray(state.chars) || state.chars.length === 0) {
    const first = newCharacter()
    state = { currentId: first.id, chars: [first] }
  }
  if (!state.chars.some((char) => char.id === state.currentId)) {
    state.currentId = state.chars[0].id
  }
}

function currentChar() {
  ensureState()
  return state.chars.find((char) => char.id === state.currentId) ?? state.chars[0]
}

function charLabel(char) {
  const name = char && char.fields ? char.fields['chr name'] : ''
  return (typeof name === 'string' && name.trim()) || 'Без имени'
}

/* ------------------------------------------------------------------ */
/* Хранилище                                                          */
/* ------------------------------------------------------------------ */

let OBR = null
let isObr = false
let lastSavedJson = null
let saveTimer = null

function setStatus(text) {
  const status = $('status')
  if (status) status.textContent = text
}

function defaultStatus() {
  setStatus(isObr ? 'общее · сохранено' : 'сохранено локально')
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? sanitize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    /* переполнение или приватный режим */
  }
}

async function getRemote() {
  if (!isObr || !OBR) return null
  for (const name of ['room', 'scene']) {
    const source = OBR[name]
    if (!source || typeof source.getMetadata !== 'function') continue
    try {
      const meta = await withTimeout(source.getMetadata(), TIMEOUT_MS, null)
      const raw = meta && (meta[META_KEY] || (meta.items && meta.items[META_KEY]))
      const parsed = raw ? sanitize(raw) : null
      if (parsed) return parsed
    } catch {
      /* пробуем следующий источник */
    }
  }
  return null
}

async function saveRemote() {
  if (!isObr || !OBR) return false
  const payload = JSON.parse(JSON.stringify(state))
  let saved = false
  for (const name of ['room', 'scene']) {
    const source = OBR[name]
    if (!source || typeof source.setMetadata !== 'function') continue
    try {
      await withTimeout(source.setMetadata({ [META_KEY]: payload }), TIMEOUT_MS, null)
      saved = true
    } catch {
      /* второй источник может сработать */
    }
  }
  return saved
}

async function saveState() {
  lastSavedJson = JSON.stringify(state)
  writeLocal()
  if (isObr) {
    const saved = await saveRemote()
    setStatus(saved ? 'общее · сохранено' : 'локально (нет связи)')
  } else {
    defaultStatus()
  }
}

/* ------------------------------------------------------------------ */
/* Поля                                                               */
/* ------------------------------------------------------------------ */

const elements = new Map()

function buildFields() {
  const root = $('fields')
  for (const field of FIELDS) {
    let element
    if (field.kind === 'checkbox') {
      element = document.createElement('input')
      element.type = 'checkbox'
      element.className = 'field check'
    } else if (field.multiline) {
      element = document.createElement('textarea')
      element.className = 'field area'
      element.maxLength = MAX_TEXT
      element.spellcheck = false
    } else {
      element = document.createElement('input')
      element.type = 'text'
      element.className = 'field line'
      element.maxLength = MAX_LINE
      element.spellcheck = false
    }

    const pad = field.kind === 'checkbox' ? 2 : 0
    element.style.left = `${field.x - pad}px`
    element.style.top = `${field.y - pad}px`
    element.style.width = `${field.w + pad * 2}px`
    element.style.height = `${field.h + pad * 2}px`
    if (field.kind === 'text') {
      element.style.fontSize = `${field.multiline ? 15 : Math.max(11, Math.min(17, field.h * 0.62))}px`
    }

    element.setAttribute('aria-label', field.name)
    element.addEventListener('input', scheduleSave)
    element.addEventListener('change', scheduleSave)

    elements.set(field.name, element)
    root.appendChild(element)
  }
}

function readForm() {
  const fields = {}
  for (const field of FIELDS) {
    const element = elements.get(field.name)
    fields[field.name] = field.kind === 'checkbox' ? element.checked : element.value
  }
  return fields
}

function applyForm(fields) {
  for (const field of FIELDS) {
    const element = elements.get(field.name)
    const value = fields ? fields[field.name] : undefined
    if (field.kind === 'checkbox') {
      element.checked = Boolean(value)
    } else {
      element.value = typeof value === 'string' ? value : ''
    }
  }
}

function commitCurrent() {
  const char = currentChar()
  char.fields = readForm()
  return char
}

function scheduleSave() {
  setStatus('сохранение…')
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    commitCurrent()
    await saveState()
    renderSelect()
  }, 250)
}

/* ------------------------------------------------------------------ */
/* Персонажи                                                          */
/* ------------------------------------------------------------------ */

function renderSelect() {
  const select = $('charSelect')
  if (!select) return
  const previous = select.value
  select.innerHTML = ''
  state.chars.forEach((char, index) => {
    const option = document.createElement('option')
    option.value = char.id
    option.textContent = `${index + 1}. ${charLabel(char)}`
    select.appendChild(option)
  })
  select.value = state.chars.some((char) => char.id === state.currentId)
    ? state.currentId
    : (previous || state.chars[0].id)
}

function applyCurrent() {
  applyForm(currentChar().fields)
  renderSelect()
}

function addCharacter() {
  commitCurrent()
  const char = newCharacter()
  state.chars.push(char)
  state.currentId = char.id
  applyCurrent()
  void saveState()
  toast('Создан новый персонаж')
}

function deleteCharacter() {
  commitCurrent()
  const char = currentChar()
  if (!window.confirm(`Удалить персонажа «${charLabel(char)}»?`)) return

  state.chars = state.chars.filter((item) => item.id !== char.id)
  if (state.chars.length === 0) state.chars.push(newCharacter())
  state.currentId = state.chars[0].id
  applyCurrent()
  void saveState()
  toast('Персонаж удалён')
}

function selectCharacter(id) {
  if (!state.chars.some((char) => char.id === id)) return
  commitCurrent()
  state.currentId = id
  applyCurrent()
  void saveState()
}

/* ------------------------------------------------------------------ */
/* Уведомление                                                        */
/* ------------------------------------------------------------------ */

let toastTimer = null

function toast(message) {
  const element = $('toast')
  if (!element) return
  element.textContent = message
  element.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => element.classList.add('hidden'), 2200)
}

/* ------------------------------------------------------------------ */
/* Внешние обновления                                                 */
/* ------------------------------------------------------------------ */

function handleRemote(meta) {
  const raw = meta && (meta[META_KEY] || (meta.items && meta.items[META_KEY]))
  if (!raw) return
  const next = sanitize(raw)
  if (!next) return

  try {
    const incoming = JSON.stringify(next)
    if (lastSavedJson && incoming === lastSavedJson) return
    lastSavedJson = incoming
  } catch {
    /* сравнение не удалось — просто применим */
  }

  state = next
  ensureState()
  renderSelect()

  // Не перетираем поле, которое пользователь прямо сейчас правит
  if (!saveTimer) applyForm(currentChar().fields)
  defaultStatus()
}

/* ------------------------------------------------------------------ */
/* Склейка с VTT / Owlbear                                            */
/* ------------------------------------------------------------------ */

async function connect() {
  try {
    const module = await withTimeout(
      import(SDK_URL).catch(() => null),
      TIMEOUT_MS,
      null
    )
    const sdk = module ? module.default || module : null
    if (!sdk || !sdk.isAvailable) {
      setStatus('локальный режим')
      return
    }

    OBR = sdk
    isObr = true

    await withTimeout(
      new Promise((resolve) => {
        try {
          if (OBR.isReady) resolve()
          else OBR.onReady(resolve)
        } catch {
          resolve()
        }
      }),
      TIMEOUT_MS,
      null
    )

    for (const name of ['room', 'scene']) {
      try {
        if (OBR[name] && typeof OBR[name].onMetadataChange === 'function') {
          OBR[name].onMetadataChange(handleRemote)
        }
      } catch {
        /* подписка не обязательна */
      }
    }

    defaultStatus()
  } catch {
    setStatus('локальный режим')
  }
}

/* ------------------------------------------------------------------ */
/* Масштаб листа                                                      */
/* ------------------------------------------------------------------ */

let zoom = null // null — вписать по ширине
let currentScale = 1

function fitScale() {
  const wrap = $('sheetWrap')
  return Math.max(0.45, Math.min(1.7, Math.max(200, wrap.clientWidth - 32) / DESIGN_W))
}

function fitSheet() {
  const wrap = $('sheetWrap')
  const frame = $('sheetFrame')
  const sheet = $('sheet')
  if (!wrap || !frame || !sheet) return

  const scale = zoom ?? fitScale()
  currentScale = scale
  frame.style.width = `${DESIGN_W * scale}px`
  frame.style.height = `${DESIGN_H * scale}px`
  sheet.style.transform = `scale(${scale})`

  const label = $('zoomReset')
  if (label) label.textContent = `${Math.round(scale * 100)}%`
}

function setZoom(value) {
  zoom = value
  fitSheet()
}

/* ------------------------------------------------------------------ */
/* Запуск                                                             */
/* ------------------------------------------------------------------ */

async function init() {
  buildFields()
  fitSheet()

  $('btnNew').addEventListener('click', addCharacter)
  $('btnDelete').addEventListener('click', deleteCharacter)
  $('charSelect').addEventListener('change', (event) => {
    selectCharacter(event.target.value)
  })

  $('zoomIn').addEventListener('click', () => {
    setZoom(Math.min(2, Math.round((currentScale + 0.1) * 10) / 10))
  })
  $('zoomOut').addEventListener('click', () => {
    setZoom(Math.max(0.4, Math.round((currentScale - 0.1) * 10) / 10))
  })
  $('zoomReset').addEventListener('click', () => setZoom(null))

  new ResizeObserver(fitSheet).observe($('sheetWrap'))
  window.addEventListener('resize', fitSheet)

  await connect()

  const local = readLocal()
  let remote = null
  if (isObr) remote = await getRemote()

  if (remote) state = remote
  else if (local) state = local
  else state = { currentId: null, chars: [] }

  ensureState()

  // Если в сессии ещё ничего нет, а локальные листы есть — публикуем их
  if (isObr && !remote && local) {
    lastSavedJson = JSON.stringify(state)
    await saveRemote()
  }

  applyCurrent()
  defaultStatus()
}

init().catch((error) => {
  console.error('[azag-sheet] ошибка запуска:', error)
  setStatus('ошибка загрузки')
})
