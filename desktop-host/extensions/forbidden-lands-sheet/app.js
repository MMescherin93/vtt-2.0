import { FIELDS } from './fields.js'

/**
 * «Запретные земли» — лист персонажа.
 *
 * Состояние: { currentId, chars: [{ id, fields }] } — как у «Тройки» и AZAG,
 * поэтому мост умеет хранить у каждого клиента свой выбранный лист и
 * объединять правки разных листов.
 */

const META_KEY = 'com.forbiddenlands.sheet/state'
const LOCAL_KEY = 'forbidden-lands-sheet-v1'
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm'
const TIMEOUT_MS = 4000
const DESIGN_W = 1200
const DESIGN_H = 1694
const MAX_TEXT = 6000
const MAX_LINE = 240

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
  for (const field of FIELDS) {
    fields[field.name] =
      field.kind === 'checkbox' ? false : field.kind === 'track' ? '0' : ''
  }
  return fields
}

const newCharacter = (fields) => ({
  id: makeId(),
  fields: { ...blankFields(), ...(fields ?? {}) }
})

let state = { currentId: null, chars: [] }

function normalizeValue(field, value) {
  if (field.kind === 'checkbox') return Boolean(value)
  if (field.kind === 'track') {
    const number = Number(value)
    return String(Number.isFinite(number) ? Math.max(0, Math.min(field.max, number)) : 0)
  }
  return typeof value === 'string'
    ? value.slice(0, field.kind === 'area' ? MAX_TEXT : MAX_LINE)
    : ''
}

function normalizeFields(saved) {
  const fields = {}
  for (const field of FIELDS) {
    fields[field.name] = normalizeValue(
      field,
      saved && typeof saved === 'object' ? saved[field.name] : undefined
    )
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
  const name = char && char.fields ? char.fields['Имя'] : ''
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
    // ignore
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
      // try next
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
      // try next
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

function buildTrack(field) {
  const root = document.createElement('div')
  root.className = 'field track'
  root.style.left = `${field.x}px`
  root.style.top = `${field.y}px`
  root.style.width = `${field.w}px`
  root.style.height = `${field.h}px`
  root.dataset.value = '0'
  root.setAttribute('role', 'spinbutton')
  root.setAttribute('aria-label', field.name)
  root.setAttribute('aria-valuemin', '0')
  root.setAttribute('aria-valuemax', String(field.max))
  for (let index = 1; index <= field.max; index += 1) {
    const pip = document.createElement('button')
    pip.type = 'button'
    pip.className = 'pip'
    pip.dataset.value = String(index)
    pip.setAttribute('aria-label', `${field.name}: ${index}`)
    pip.addEventListener('click', (event) => {
      event.preventDefault()
      const next = root.dataset.value === String(index) ? String(index - 1) : String(index)
      setTrackValue(root, next, field.max)
      scheduleSave()
    })
    root.appendChild(pip)
  }
  return root
}

function setTrackValue(root, value, max) {
  const safe = Math.max(0, Math.min(max, Number(value) || 0))
  root.dataset.value = String(safe)
  root.setAttribute('aria-valuenow', String(safe))
  root.querySelectorAll('.pip').forEach((pip) => {
    pip.classList.toggle('on', Number(pip.dataset.value) <= safe)
  })
}

function buildFields() {
  for (const field of FIELDS) {
    let element
    if (field.kind === 'checkbox') {
      element = document.createElement('input')
      element.type = 'checkbox'
      element.className = 'field check'
    } else if (field.kind === 'track') {
      element = buildTrack(field)
    } else if (field.kind === 'area') {
      element = document.createElement('textarea')
      element.className = 'field area'
      element.maxLength = MAX_TEXT
      element.spellcheck = false
    } else if (field.kind === 'number') {
      element = document.createElement('input')
      element.type = 'number'
      element.min = '0'
      element.className = 'field number'
      element.spellcheck = false
    } else {
      element = document.createElement('input')
      element.type = 'text'
      element.className = 'field line'
      element.maxLength = MAX_LINE
      element.spellcheck = false
    }

    if (field.kind === 'track') {
      const container = document.querySelector(`[data-fields="${field.page}"]`)
      container?.appendChild(element)
    } else {
      const pad = field.kind === 'checkbox' ? 2 : 0
      element.style.left = `${field.x - pad}px`
      element.style.top = `${field.y - pad}px`
      element.style.width = `${field.w + pad * 2}px`
      element.style.height = `${field.h + pad * 2}px`
      if (field.kind !== 'checkbox') {
        element.style.fontSize = `${field.kind === 'area' ? 14 : Math.max(12, Math.min(18, field.h * 0.62))}px`
      }
      const container = document.querySelector(`[data-fields="${field.page}"]`)
      container?.appendChild(element)
    }

    element.setAttribute('aria-label', field.name)
    element.addEventListener('input', scheduleSave)
    element.addEventListener('change', scheduleSave)
    elements.set(field.name, element)
  }
}

function readForm() {
  const fields = {}
  for (const field of FIELDS) {
    const element = elements.get(field.name)
    if (field.kind === 'checkbox') fields[field.name] = element.checked
    else if (field.kind === 'track') fields[field.name] = element.dataset.value || '0'
    else fields[field.name] = element.value
  }
  return fields
}

function applyForm(fields) {
  for (const field of FIELDS) {
    const element = elements.get(field.name)
    const value = fields ? fields[field.name] : undefined
    if (field.kind === 'checkbox') {
      element.checked = Boolean(value)
    } else if (field.kind === 'track') {
      setTrackValue(element, value, field.max)
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
/* Персонажи и страницы                                               */
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
    : previous || state.chars[0].id
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

let currentPage = 0

function setPage(page) {
  currentPage = page
  document.querySelectorAll('.sheetPage').forEach((element) => {
    element.classList.toggle('active', Number(element.dataset.page) === page)
  })
  document.querySelectorAll('.pageTab').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.page) === page)
  })
  fitSheet()
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
    // apply anyway
  }
  state = next
  ensureState()
  renderSelect()
  if (!saveTimer) applyForm(currentChar().fields)
  defaultStatus()
}

/* ------------------------------------------------------------------ */
/* Склейка с VTT / Owlbear                                            */
/* ------------------------------------------------------------------ */

async function connect() {
  try {
    const module = await withTimeout(import(SDK_URL).catch(() => null), TIMEOUT_MS, null)
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
        // optional
      }
    }
    defaultStatus()
  } catch {
    setStatus('локальный режим')
  }
}

/* ------------------------------------------------------------------ */
/* Масштаб                                                            */
/* ------------------------------------------------------------------ */

let currentScale = 1

function fitScale() {
  const wrap = $('sheetWrap')
  return Math.max(0.35, Math.min(1.5, Math.max(200, wrap.clientWidth - 28) / DESIGN_W))
}

function fitSheet() {
  const frame = $('sheetFrame')
  if (!frame) return
  const scale = fitScale()
  currentScale = scale
  frame.style.width = `${DESIGN_W * scale}px`
  frame.style.height = `${DESIGN_H * scale}px`
  document.querySelectorAll('.sheetPage').forEach((page) => {
    page.style.transform = `scale(${scale})`
    page.style.display = Number(page.dataset.page) === currentPage ? 'block' : 'none'
  })
}

/* ------------------------------------------------------------------ */
/* Запуск                                                             */
/* ------------------------------------------------------------------ */

async function init() {
  buildFields()
  fitSheet()

  $('btnNew').addEventListener('click', addCharacter)
  $('btnDelete').addEventListener('click', deleteCharacter)
  $('charSelect').addEventListener('change', (event) => selectCharacter(event.target.value))
  document.querySelectorAll('.pageTab').forEach((button) => {
    button.addEventListener('click', () => setPage(Number(button.dataset.page)))
  })
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
  if (isObr && !remote && local) {
    lastSavedJson = JSON.stringify(state)
    await saveRemote()
  }
  applyCurrent()
  defaultStatus()
}

init().catch((error) => {
  console.error('[forbidden-lands-sheet] ошибка запуска:', error)
  setStatus('ошибка загрузки')
})
