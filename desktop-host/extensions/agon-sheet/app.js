import { DIE_VALUES, FIELDS, PORTRAIT } from './fields.js'

/* --------------------------------------------------------------------------
   Лист героя «Агон»: несколько листов, общее состояние, портрет.
   -------------------------------------------------------------------------- */

const STORAGE_KEY = 'agon-sheet-state-v2'
const LEGACY_KEY = 'agon-sheet-fields-v1'
const SHEET_META_KEY = 'com.agon.sheet/state'
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm'
const TIMEOUT_MS = 4000
const MAX_STATE = 1_450_000
const MAX_PORTRAIT = 400_000
const MAX_CHARS = 30
const DIE_SET = new Set(DIE_VALUES)
const SELECT_NAMES = new Set(FIELDS.filter((field) => field.kind === 'select').map((field) => field.name))

const sheet = document.getElementById('sheet')
const fieldLayer = document.getElementById('fieldLayer')
const charSelect = document.getElementById('charSelect')
const portrait = document.getElementById('portrait')
const portraitImage = document.getElementById('portraitImage')
const portraitEmpty = document.getElementById('portraitEmpty')
const portraitInput = document.getElementById('portraitInput')
const portraitRemove = document.getElementById('portraitRemove')
const toastEl = document.getElementById('toast')

let state = { currentId: null, chars: [] }
let values = null
let dirty = false
let saveTimer = 0
let selectTimer = 0
let toastTimer = 0
let lastSentJson = null
let lastRemoteJson = null
let saving = false
let OBR = null
let mode = { obr: false }
let checkEls = new Map()
let fieldEls = new Map()
let selectEls = new Map()

/* ── Утилиты ─────────────────────────────────────────────────────────── */

function makeId() {
  return 'agon_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function toast(text) {
  toastEl.textContent = text
  toastEl.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2800)
}

function withTimeout(promise, ms, fallback) {
  const safe = Promise.resolve(promise).then(
    (value) => value,
    () => fallback
  )
  return Promise.race([safe, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))])
}

function normalizeDie(value) {
  const text = String(value ?? '').replace(/[^0-9]/g, '')
  return DIE_SET.has(text) ? text : '6'
}

function sanitizeImage(value) {
  if (typeof value !== 'string') return ''
  if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)) return ''
  if (value.length > MAX_PORTRAIT) return ''
  return value
}

function isCheck(field) {
  return field.kind === 'check'
}

function isSelect(field) {
  return field.kind === 'select'
}

/* ── Модель ──────────────────────────────────────────────────────────── */

function defaultFields() {
  const fields = {}
  for (const field of FIELDS) {
    if (isCheck(field)) fields[field.name] = false
    else if (isSelect(field)) fields[field.name] = '6'
    else fields[field.name] = ''
  }
  fields.portrait = ''
  return fields
}

function normalizeFields(raw) {
  const base = defaultFields()
  if (!raw || typeof raw !== 'object') return base

  for (const key of Object.keys(base)) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (key === 'portrait') {
      base[key] = sanitizeImage(value)
    } else if (typeof base[key] === 'boolean') {
      base[key] = value === true
    } else if (SELECT_NAMES.has(key)) {
      base[key] = normalizeDie(value)
    } else {
      base[key] = typeof value === 'string' ? value.slice(0, 600) : ''
    }
  }
  return base
}

function newCharacter(fields) {
  return { id: makeId(), fields: normalizeFields(fields) }
}

function currentChar() {
  return state.chars.find((char) => char.id === state.currentId) || state.chars[0] || null
}

function ensureState() {
  if (!Array.isArray(state.chars) || state.chars.length === 0) {
    state.chars = [newCharacter()]
  }
  if (state.chars.length > MAX_CHARS) state.chars = state.chars.slice(0, MAX_CHARS)
  if (!state.chars.some((char) => char.id === state.currentId)) {
    state.currentId = state.chars[0].id
  }
  if (!values) {
    const char = currentChar()
    values = char ? char.fields : defaultFields()
  }
}

function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null
  const list = Array.isArray(raw.chars) ? raw.chars : null
  if (!list) return null

  const seen = new Set()
  const chars = []
  for (const item of list.slice(0, MAX_CHARS)) {
    if (!item || typeof item !== 'object') continue
    let id = typeof item.id === 'string' && item.id ? item.id.slice(0, 80) : makeId()
    while (seen.has(id)) id = makeId()
    seen.add(id)
    chars.push({ id, fields: normalizeFields(item.fields) })
  }
  if (chars.length === 0) return null

  let currentId = typeof raw.currentId === 'string' ? raw.currentId : ''
  if (!chars.some((char) => char.id === currentId)) currentId = chars[0].id
  return { currentId, chars }
}

function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const fields = normalizeFields(parsed)
    const char = { id: makeId(), fields }
    return { currentId: char.id, chars: [char] }
  } catch {
    return null
  }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function cacheLocal(json) {
  try {
    localStorage.setItem(STORAGE_KEY, json)
  } catch {
    /* локальный кэш не критичен */
  }
}

/* ── Шкала листа ─────────────────────────────────────────────────────── */

function updateScale() {
  const width = sheet.clientWidth
  if (width > 0) sheet.style.setProperty('--u', `${width}px`)
}

/* ── Отрисовка полей ─────────────────────────────────────────────────── */

function place(element, field) {
  element.style.left = `${field.x}%`
  element.style.top = `${field.y}%`
  element.style.width = `${field.w}%`
  element.style.height = `${field.h}%`
}

function renderTextField(field) {
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'formField textField'
  input.dataset.name = field.name
  input.setAttribute('aria-label', field.label)
  input.title = field.label
  input.autocomplete = 'off'
  input.spellcheck = false
  input.maxLength = 600
  place(input, field)
  input.value = typeof values[field.name] === 'string' ? values[field.name] : ''

  input.addEventListener('input', () => {
    values[field.name] = input.value
    if (field.name === 'name') scheduleSelectRefresh()
    markDirty()
  })
  input.addEventListener('blur', () => {
    scheduleSave(0)
  })

  fieldLayer.appendChild(input)
  fieldEls.set(field.name, input)
}

function renderSelectField(field) {
  const element = document.createElement('select')
  element.className = 'formField dieSelect'
  element.dataset.name = field.name
  element.setAttribute('aria-label', field.label)
  element.title = field.label
  place(element, field)

  for (const value of DIE_VALUES) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    element.appendChild(option)
  }
  element.value = normalizeDie(values[field.name])
  element.addEventListener('change', () => {
    values[field.name] = element.value
    markDirty()
  })

  fieldLayer.appendChild(element)
  selectEls.set(field.name, element)
}

function renderCheckField(field) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.className = 'formField checkField'
  input.dataset.name = field.name
  input.dataset.shape = field.shape
  input.dataset.group = field.group
  input.setAttribute('aria-label', field.label)
  input.title = field.label
  place(input, field)
  input.checked = Boolean(values[field.name])

  input.addEventListener('change', () => {
    values[field.name] = input.checked

    if (input.checked && field.group === 'orange') {
      let cleared = 0
      for (const other of FIELDS) {
        if (!isCheck(other) || other.group !== 'pink') continue
        if (values[other.name]) cleared += 1
        values[other.name] = false
        const element = checkEls.get(other.name)
        if (element) element.checked = false
      }
      if (cleared > 0) toast('Рубеж имени отмечен — шкала Славы очищена')
    }

    markDirty()
  })

  fieldLayer.appendChild(input)
  checkEls.set(field.name, input)
}

function renderPortrait() {
  const url = typeof values.portrait === 'string' ? values.portrait : ''
  portrait.style.left = `${PORTRAIT.x}%`
  portrait.style.top = `${PORTRAIT.y}%`
  portrait.style.width = `${PORTRAIT.w}%`
  portrait.style.height = `${PORTRAIT.h}%`

  if (url) {
    portraitImage.src = url
    portrait.classList.add('has-image')
    portrait.setAttribute('aria-label', 'Изображение героя. Нажмите, чтобы заменить')
  } else {
    portraitImage.removeAttribute('src')
    portrait.classList.remove('has-image')
    portrait.setAttribute('aria-label', 'Загрузить изображение героя')
  }
}

function renderAll() {
  if (!values) return
  fieldLayer.innerHTML = ''
  checkEls = new Map()
  fieldEls = new Map()
  selectEls = new Map()

  for (const field of FIELDS) {
    if (isCheck(field)) renderCheckField(field)
    else if (isSelect(field)) renderSelectField(field)
    else renderTextField(field)
  }

  renderPortrait()
  updateScale()
}

/* ── Список героев ───────────────────────────────────────────────────── */

function charLabel(char, index) {
  const name = (char.fields.name || '').trim()
  return name || `Герой ${index + 1}`
}

function renderSelect() {
  ensureState()
  charSelect.innerHTML = ''
  state.chars.forEach((char, index) => {
    const option = document.createElement('option')
    option.value = char.id
    option.textContent = charLabel(char, index)
    charSelect.appendChild(option)
  })
  charSelect.value = state.currentId
}

function scheduleSelectRefresh() {
  window.clearTimeout(selectTimer)
  selectTimer = window.setTimeout(renderSelect, 300)
}

function showCharacter(id, options = {}) {
  ensureState()
  const exists = state.chars.some((char) => char.id === id)
  state.currentId = exists ? id : state.chars[0].id
  const char = currentChar()
  values = char ? char.fields : defaultFields()
  renderAll()
  renderSelect()
  if (options.save !== false) scheduleSave(0)
}

function addCharacter() {
  ensureState()
  const char = newCharacter()
  state.chars.push(char)
  showCharacter(char.id)
  toast('Создан новый герой')
  window.setTimeout(() => {
    const input = fieldEls.get('name')
    if (input) input.focus()
  }, 60)
}

function deleteCurrent() {
  ensureState()
  const char = currentChar()
  if (!char) return
  const label = charLabel(char, state.chars.indexOf(char))
  const question =
    state.chars.length === 1
      ? `Удалить героя «${label}»? Вместо него будет создан пустой лист.`
      : `Удалить героя «${label}»?`
  if (!window.confirm(question)) return

  state.chars = state.chars.filter((item) => item.id !== char.id)
  if (state.chars.length === 0) state.chars.push(newCharacter())
  showCharacter(state.chars[0].id)
  toast('Герой удалён')
}

function resetCurrent() {
  ensureState()
  const char = currentChar()
  if (!char) return
  if (!window.confirm('Сбросить все поля текущего героя? Изображение тоже будет удалено.')) return
  char.fields = defaultFields()
  values = char.fields
  renderAll()
  markDirty()
  toast('Поля листа очищены')
}

/* ── Сохранение ──────────────────────────────────────────────────────── */

function markDirty() {
  dirty = true
  scheduleSave()
}

function scheduleSave(delay = 300) {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveNow()
  }, delay)
}

async function saveNow() {
  if (!values) return
  ensureState()
  const char = currentChar()
  if (!char) return
  char.fields = values

  let payload
  let json
  try {
    payload = JSON.parse(JSON.stringify(state))
    json = JSON.stringify(payload)
  } catch {
    return
  }

  if (json === lastSentJson) {
    dirty = false
    renderSelect()
    return
  }

  if (json.length > MAX_STATE) {
    toast('Слишком много данных: уменьшите изображение или удалите лишние листы')
    return
  }

  if (saving) {
    scheduleSave(120)
    return
  }

  saving = true
  lastSentJson = json
  dirty = false
  // В общей сессии источник истины — сервер; большой кэш с портретами
  // не пишем в localStorage, чтобы не упираться в квоту.
  if (!mode.obr || json.length < 600_000) cacheLocal(json)

  if (mode.obr && OBR) {
    try {
      await OBR.room.setMetadata({ [SHEET_META_KEY]: payload })
    } catch {
      lastSentJson = null
      dirty = true
      toast('Не удалось сохранить лист — проверьте соединение')
    }
  }

  saving = false
  renderSelect()
}

/* ── Общее состояние ─────────────────────────────────────────────────── */

async function loadSdk() {
  if (window.parent === window) return null
  try {
    const module = await withTimeout(import(SDK_URL).catch(() => null), TIMEOUT_MS, null)
    if (!module) return null
    const sdk = module.default || module
    return sdk && sdk.room && sdk.scene ? sdk : null
  } catch {
    return null
  }
}

function waitReady(sdk) {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    try {
      if (sdk.isReady) {
        finish()
        return
      }
      sdk.onReady(finish)
    } catch {
      finish()
      return
    }
    window.setTimeout(finish, 1800)
  })
}

async function getRemoteMeta() {
  if (!OBR) return null
  try {
    const meta = await withTimeout(OBR.room.getMetadata(), TIMEOUT_MS, null)
    if (!meta || typeof meta !== 'object') return null
    return meta[SHEET_META_KEY] ?? (meta.items && meta.items[SHEET_META_KEY]) ?? null
  } catch {
    return null
  }
}

function applyRemoteState(raw) {
  const sanitized = sanitizeState(raw)
  if (!sanitized) return

  let json = null
  try {
    json = JSON.stringify(sanitized)
  } catch {
    json = null
  }
  // Это эхо нашего же сохранения — не перерисовываем форму и не сбрасываем курсор.
  if (json !== null && (json === lastRemoteJson || json === lastSentJson)) return
  lastRemoteJson = json

  const previousId = state.currentId
  if (dirty && values) {
    const local = currentChar()
    const incoming = local ? sanitized.chars.find((char) => char.id === local.id) : null
    if (incoming) incoming.fields = { ...incoming.fields, ...values }
  }

  state = sanitized
  ensureState()
  const char = currentChar()
  values = char ? char.fields : defaultFields()

  const active = document.activeElement
  const editingText =
    active &&
    fieldLayer.contains(active) &&
    ((active.tagName === 'INPUT' && active.type === 'text') || active.tagName === 'SELECT')
  const currentChanged = state.currentId !== previousId
  if (editingText && !currentChanged) {
    // Не перерисовываем поле под курсором, но обновляем список и портрет.
    renderSelect()
    renderPortrait()
  } else {
    renderAll()
    renderSelect()
  }
}

function subscribeRemote() {
  if (!OBR) return
  try {
    OBR.room.onMetadataChange((meta) => {
      const raw = meta && (meta[SHEET_META_KEY] || (meta.items && meta.items[SHEET_META_KEY]))
      if (raw !== undefined && raw !== null) applyRemoteState(raw)
    })
  } catch {
    /* без подписки лист продолжит работать локально */
  }
}

/* ── Портрет ─────────────────────────────────────────────────────────── */

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось прочитать изображение'))
    image.src = url
  })
}

async function compressPortrait(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Файл больше 12 МБ')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const naturalWidth = image.naturalWidth || 512
    const naturalHeight = image.naturalHeight || 512
    const side = Math.max(1, Math.min(naturalWidth, naturalHeight))
    const sx = (naturalWidth - side) / 2
    const sy = (naturalHeight - side) / 2

    const sizes = [
      [512, 0.84],
      [448, 0.82],
      [384, 0.8],
      [320, 0.76],
      [256, 0.72]
    ]

    let result = ''
    for (const [size, quality] of sizes) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas недоступен')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, size, size)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, sx, sy, side, side, 0, 0, size, size)
      result = canvas.toDataURL('image/jpeg', quality)
      if (result.length <= 90_000) break
    }
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function handlePortraitFile(file) {
  try {
    toast('Обрабатываю изображение…')
    const dataUrl = await compressPortrait(file)
    if (!dataUrl || dataUrl.length > MAX_PORTRAIT) {
      toast('Не удалось подготовить изображение')
      return
    }
    values.portrait = dataUrl
    renderPortrait()
    markDirty()
    toast('Изображение загружено')
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Не удалось загрузить изображение')
  }
}

function removePortrait() {
  if (!values.portrait) return
  values.portrait = ''
  renderPortrait()
  markDirty()
  toast('Изображение удалено')
}

function setupPortrait() {
  portrait.addEventListener('click', (event) => {
    if (event.target === portraitRemove) return
    portraitInput.click()
  })

  portrait.addEventListener('keydown', (event) => {
    if (event.target !== portrait) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    portraitInput.click()
  })

  portraitInput.addEventListener('change', () => {
    const file = portraitInput.files && portraitInput.files[0]
    if (file) void handlePortraitFile(file)
    portraitInput.value = ''
  })

  portraitRemove.addEventListener('click', (event) => {
    event.stopPropagation()
    removePortrait()
  })

  portrait.addEventListener('dragover', (event) => {
    event.preventDefault()
    portrait.classList.add('dragover')
  })
  portrait.addEventListener('dragleave', () => portrait.classList.remove('dragover'))
  portrait.addEventListener('drop', (event) => {
    event.preventDefault()
    portrait.classList.remove('dragover')
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (file) void handlePortraitFile(file)
  })
}

/* ── Запуск ──────────────────────────────────────────────────────────── */

function setupUi() {
  document.getElementById('btnNew').addEventListener('click', addCharacter)
  document.getElementById('btnDelete').addEventListener('click', deleteCurrent)
  document.getElementById('btnReset').addEventListener('click', resetCurrent)
  charSelect.addEventListener('change', () => showCharacter(charSelect.value))
  setupPortrait()

  window.addEventListener('resize', updateScale)
  new ResizeObserver(updateScale).observe(sheet)

  window.addEventListener('pagehide', () => {
    if (values) {
      try {
        cacheLocal(JSON.stringify(state))
      } catch {
        /* игнор */
      }
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) scheduleSave(0)
  })
}

async function init() {
  setupUi()
  updateScale()

  const sdk = await loadSdk()
  if (sdk) {
    OBR = sdk
    mode = { obr: true }
    await waitReady(sdk)
  }

  let initial = null
  let needsPublish = false
  let hasRemote = false

  if (mode.obr) {
    initial = await getRemoteMeta()
    hasRemote = Boolean(initial)
    if (!initial) {
      // В сессии ещё нет листа: переносим старую локальную версию один раз.
      initial = readLegacyState()
      if (initial) {
        try {
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          /* игнор */
        }
      }
      needsPublish = true
    }
  } else {
    initial = loadLocalState() || readLegacyState()
  }

  let sanitized = sanitizeState(initial)
  if (!sanitized) {
    const first = newCharacter()
    sanitized = { currentId: first.id, chars: [first] }
    if (mode.obr) needsPublish = true
  }

  state = sanitized
  ensureState()
  const char = currentChar()
  values = char ? char.fields : defaultFields()

  renderAll()
  renderSelect()
  updateScale()

  if (mode.obr) {
    if (needsPublish) {
      await saveNow()
    } else if (hasRemote) {
      try {
        lastRemoteJson = JSON.stringify(state)
      } catch {
        lastRemoteJson = null
      }
    }
    subscribeRemote()
  } else if (!loadLocalState()) {
    await saveNow()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void init()
})
