import { CATALOG } from './catalog.js'

/**
 * Hero Kids — лист персонажа и карточки снаряжения.
 *
 * Модуль живёт в iframe и общается с хостом через postMessage:
 * hello -> role + metadata, изменения -> setMetadata (только Мастер),
 * броски -> chat. Игрок видит только героев и никогда не пишет состояние.
 */

const EXT_ID = 'herokids'
const LOCAL_KEY = 'herokids-state-v1'
const SELECT_KEY = 'herokids-selected-v1'
const MAX_CHARS = 24
const MAX_CARDS = 60
const MAX_PORTRAIT = 380_000

const POOLS = [
  { id: 'melee', label: 'Ближняя', title: 'Ближняя атака (Сила)', stat: 'Сила', icon: 'icons/stat-melee.png' },
  { id: 'ranged', label: 'Дальняя', title: 'Дальняя атака (Ловкость)', stat: 'Ловкость', icon: 'icons/stat-ranged.png' },
  { id: 'magic', label: 'Магия', title: 'Магия (Интеллект)', stat: 'Интеллект', icon: 'icons/stat-magic.png' },
  { id: 'armor', label: 'Броня', title: 'Броня', stat: 'Броня', icon: 'icons/stat-armor.png' }
]
const POOL_BY_ID = Object.fromEntries(POOLS.map((p) => [p.id, p]))

const HEALTH_LABELS = {
  1: ['Нокаут'],
  2: ['Нокаут', 'Рана'],
  3: ['Нокаут', 'Рана', 'Синяк'],
  4: ['Нокаут', 'Рана', 'Синяк', 'Ссадина']
}

const KIND_LABELS = { hero: 'герой', monster: 'монстр' }
const CARD_KINDS = { equipment: 'снаряжение', item: 'предмет', gift: 'дар' }
const CARD_NOTES = {
  equipment: 'Только один элемент снаряжения может быть активен во время боя.',
  item: 'Можно использовать в свой ход как действие. Пропадает после использования.',
  gift: 'Можно использовать в любое время, даже во время хода противника.'
}

const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]))
const SKILLS = CATALOG.filter((item) => item.category === 'skill')
const ITEMS = CATALOG.filter((item) => item.category === 'item')
/** Зелья всегда два на листе — в общий инвентарь их не добавляем. */
const INVENTORY_ITEMS = ITEMS.filter((item) => item.id !== 'potion')
const ABILITIES = CATALOG.filter((item) => item.category === 'ability')

const $ = (id) => document.getElementById(id)
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const round = (value) => Math.round(Number(value) || 0)

function uid(prefix) {
  try {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
  }
}

function text(value, max) {
  return String(value ?? '').slice(0, max)
}

/* ------------------------------------------------------------------ */
/* Состояние                                                          */
/* ------------------------------------------------------------------ */

function blankPools() {
  return { melee: 0, ranged: 0, magic: 0, armor: 0 }
}

function blankChar(kind = 'hero') {
  return {
    id: uid('h'),
    kind,
    name: '',
    archetype: kind === 'monster' ? 'Монстр' : 'Воин',
    portrait: '',
    pools: blankPools(),
    healthMax: kind === 'monster' ? 1 : 3,
    damage: 0,
    attack: '',
    action: '',
    ability: '',
    skills: [],
    items: [],
    potions: [true, true]
  }
}

function blankState() {
  return { version: 1, currentId: null, chars: [], cards: [] }
}

function blankCard() {
  return {
    id: uid('c'),
    title: 'Новая карточка',
    kind: 'item',
    art: '',
    flavor: '',
    effect: '',
    note: CARD_NOTES.item,
    assignedTo: []
  }
}

function normalizeChar(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const kind = src.kind === 'monster' ? 'monster' : 'hero'
  const healthMax = kind === 'hero' ? 3 : clamp(round(src.healthMax) || 1, 1, 4)
  const pools = blankPools()
  for (const pool of POOLS) pools[pool.id] = clamp(round(src.pools && src.pools[pool.id]), 0, 3)

  const skills = Array.isArray(src.skills)
    ? src.skills.filter((id, index, list) => CATALOG_BY_ID.get(id)?.category === 'skill' && list.indexOf(id) === index).slice(0, 1)
    : []

  const rawItems = Array.isArray(src.items) ? src.items : []
  const potionRow = rawItems.find((item) => item && item.id === 'potion')
  const potionCount = potionRow ? clamp(round(potionRow.count), 0, 2) : 2
  const potions = Array.isArray(src.potions)
    ? [Boolean(src.potions[0]), Boolean(src.potions[1])]
    : [potionCount > 0, potionCount > 1]

  const items = rawItems
    .map((item) => ({
      id: item && typeof item.id === 'string' ? item.id : '',
      count: clamp(round(item && item.count) || 1, 1, 99)
    }))
    .filter((item) => item.id !== 'potion' && CATALOG_BY_ID.get(item.id)?.category === 'item')
    .slice(0, 1)

  const portrait = typeof src.portrait === 'string' ? src.portrait : ''
  const safePortrait =
    portrait.startsWith('data:image/') && portrait.length <= MAX_PORTRAIT
      ? portrait
      : /^[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(portrait)
        ? portrait
        : ''

  return {
    id: typeof src.id === 'string' && src.id ? src.id.slice(0, 40) : uid('h'),
    kind,
    name: text(src.name, 40),
    archetype: text(src.archetype, 30) || (kind === 'monster' ? 'Монстр' : 'Воин'),
    portrait: safePortrait,
    pools,
    healthMax,
    damage: clamp(round(src.damage), 0, healthMax),
    attack: text(src.attack, 400),
    action: text(src.action, 400),
    ability: text(src.ability, 400),
    skills,
    items,
    potions
  }
}

function normalizeCard(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const kind = Object.prototype.hasOwnProperty.call(CARD_KINDS, src.kind) ? src.kind : 'equipment'
  const art =
    typeof src.art === 'string' &&
    src.art.startsWith('data:image/') &&
    src.art.length <= MAX_PORTRAIT
      ? src.art
      : ''
  const assignedTo = Array.isArray(src.assignedTo)
    ? src.assignedTo
        .filter((id, index, list) => typeof id === 'string' && id && list.indexOf(id) === index)
        .slice(0, MAX_CHARS)
    : []
  return {
    id: typeof src.id === 'string' && src.id ? src.id.slice(0, 40) : uid('c'),
    title: text(src.title, 40) || 'Без названия',
    kind,
    art,
    flavor: text(src.flavor, 90),
    effect: text(src.effect, 260),
    note: text(src.note, 200) || CARD_NOTES[kind],
    assignedTo
  }
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return null
  const rawChars = Array.isArray(raw.chars) ? raw.chars.slice(0, MAX_CHARS) : []
  const chars = rawChars.map(normalizeChar)
  const cards = Array.isArray(raw.cards) ? raw.cards.slice(0, MAX_CARDS).map(normalizeCard) : []

  // Миграция старого поля equipment: карточка становится выданной герою.
  for (const rawChar of rawChars) {
    const legacy = rawChar && typeof rawChar.equipment === 'string' ? rawChar.equipment : ''
    if (!legacy) continue
    const id = typeof rawChar.id === 'string' ? rawChar.id : ''
    const card = cards.find((item) => item.id === legacy)
    if (card && id && !card.assignedTo.includes(id)) card.assignedTo.push(id)
  }

  const alive = new Set(chars.map((char) => char.id))
  for (const card of cards) card.assignedTo = card.assignedTo.filter((id) => alive.has(id))

  let currentId = typeof raw.currentId === 'string' ? raw.currentId : null
  if (currentId && !alive.has(currentId)) currentId = null
  return { version: 1, currentId, chars, cards }
}

let state = blankState()
let role = window.parent === window ? 'gm' : 'player'
let remote = false
let selectedId = readSelect()
let editMode = false
let saveTimer = null
let lastSentJson = null
let statusText = 'локально'

function readSelect() {
  try {
    return localStorage.getItem(SELECT_KEY) || ''
  } catch {
    return ''
  }
}

function writeSelect(id) {
  selectedId = id
  try {
    localStorage.setItem(SELECT_KEY, id)
  } catch {
    /* приватный режим */
  }
}

function isGm() {
  return role === 'gm'
}

function allowedChars() {
  const all = state.chars
  return isGm() ? all : all.filter((char) => char.kind === 'hero')
}

function currentChar() {
  const list = allowedChars()
  return list.find((char) => char.id === selectedId) || list[0] || null
}

function charById(id) {
  return state.chars.find((char) => char.id === id) || null
}

function cardById(id) {
  return state.cards.find((card) => card.id === id) || null
}

/** Игроку показываем только карточки, выданные его текущему герою. */
function visibleCards(char = currentChar()) {
  if (isGm()) return state.cards
  if (!char) return []
  return state.cards.filter((card) => card.assignedTo.includes(char.id))
}

function ensureSelection() {
  const list = allowedChars()
  if (list.length === 0) return
  if (!list.some((char) => char.id === selectedId)) {
    writeSelect(list[0].id)
  }
}

function ensureState() {
  if (state.chars.length === 0 && isGm()) {
    const char = blankChar('hero')
    char.name = 'Новый герой'
    state.chars.push(char)
    state.currentId = char.id
    writeSelect(char.id)
  }
  ensureSelection()
  if (state.chars.length > 0 && (!state.currentId || !state.chars.some((char) => char.id === state.currentId))) {
    state.currentId = state.chars[0] ? state.chars[0].id : null
  }
}

/* ------------------------------------------------------------------ */
/* Связь с хостом                                                     */
/* ------------------------------------------------------------------ */

function post(message) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ __vttExt: EXT_ID, ...message }, '*')
    }
  } catch {
    /* не в iframe */
  }
}

function sayHello() {
  post({ type: 'hello' })
}

function setStatus(value) {
  statusText = value
  const el = $('status')
  if (el) el.textContent = value
}

function applyRole(next) {
  role = next === 'GM' ? 'gm' : 'player'
  if (!isGm()) editMode = false
  document.body.classList.toggle('is-gm', isGm())
  ensureState()
  renderAll()
}

function applyRemote(raw) {
  remote = true
  const next = normalizeState(raw)
  if (!next) {
    setStatus('общее · сохранено')
    return
  }
  let json = ''
  try {
    json = JSON.stringify(next)
  } catch {
    json = ''
  }
  const echo = json !== '' && json === lastSentJson
  state = next
  ensureSelection()
  setStatus('общее · сохранено')
  if (echo) return
  if (isEditing()) {
    renderDock()
    return
  }
  renderAll()
}

window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.__vttExt !== EXT_ID) return
  if (data.type === 'role') {
    applyRole(data.role)
    return
  }
  if (data.type === 'metadata') {
    applyRemote(data.state)
    return
  }
  if (data.type === 'ready') {
    setStatus(remote ? 'общее · сохранено' : 'локально')
  }
})

function isEditing() {
  const active = document.activeElement
  if (!active) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
}

/* ------------------------------------------------------------------ */
/* Сохранение                                                         */
/* ------------------------------------------------------------------ */

function serialize() {
  const char = currentChar()
  if (char) state.currentId = char.id
  return state
}

function saveLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    /* переполнение — не критично */
  }
}

function scheduleSave() {
  if (!isGm()) return
  saveLocal()
  setStatus('есть изменения…')
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (!isGm()) return
    const payload = serialize()
    let json = ''
    try {
      json = JSON.stringify(payload)
    } catch {
      return
    }
    if (json === lastSentJson) {
      setStatus(remote ? 'общее · сохранено' : 'сохранено локально')
      return
    }
    if (!remote) {
      setStatus('сохранено локально')
      return
    }
    post({ type: 'setMetadata', state: payload })
    lastSentJson = json
    setStatus('общее · сохраняется…')
  }, 250)
}

/* ------------------------------------------------------------------ */
/* Рендер листа                                                       */
/* ------------------------------------------------------------------ */

function renderAll() {
  ensureSelection()
  document.body.classList.toggle('is-gm', isGm())
  const modeBtn = $('modeBtn')
  if (modeBtn) modeBtn.classList.toggle('active', isGm() && editMode)
  const pill = $('rolePill')
  if (pill) pill.textContent = isGm() ? 'Мастер' : 'Игрок'
  const hint = $('hintText')
  const char = currentChar()
  if (hint) {
    if (char && char.damage >= char.healthMax) {
      hint.textContent = 'Нокаут — герой не может действовать, пока его не вылечат'
    } else {
      hint.textContent = isGm()
        ? 'Мастер: создаёт листы, отмечает урон, выбирает навыки и предметы'
        : 'поля только для чтения · доступны броски, проверки и предметы'
    }
  }
  renderSheet()
  renderDock()
}

function renderSheet() {
  const char = currentChar()
  const sheet = $('sheet')
  const nameInput = $('nameInput')
  const classInput = $('classInput')
  if (!char) {
    sheet.classList.add('monster')
    nameInput.value = ''
    classInput.value = ''
    $('pools').innerHTML = ''
    $('health').innerHTML = ''
    $('inventory').innerHTML = ''
    $('portraitImg').removeAttribute('src')
    $('portraitFrame').classList.add('empty')
    for (const block of ['blockAttack', 'blockAction', 'blockAbility']) $(block).innerHTML = ''
    return
  }

  sheet.classList.toggle('monster', char.kind === 'monster')
  sheet.classList.toggle('editing', isGm() && editMode)
  nameInput.value = char.name
  classInput.value = char.archetype
  nameInput.readOnly = !isGm()
  classInput.readOnly = !isGm()
  nameInput.placeholder = char.kind === 'monster' ? 'Имя монстра' : 'Имя героя'
  classInput.placeholder = char.kind === 'monster' ? 'Тип' : 'Класс'

  const portrait = $('portraitImg')
  const frame = $('portraitFrame')
  if (char.portrait) {
    portrait.src = char.portrait
    frame.classList.remove('empty')
  } else {
    portrait.removeAttribute('src')
    frame.classList.add('empty')
  }
  frame.classList.toggle('gm', isGm())
  frame.title = isGm() ? 'Нажмите, чтобы загрузить рисунок' : 'Портрет'

  renderPools(char)
  renderHealth(char)
  renderBlocks(char)
  renderInventory(char)
}

function renderPools(char) {
  const root = $('pools')
  root.innerHTML = ''
  const mode = isGm() && editMode ? 'edit' : 'play'
  for (const pool of POOLS) {
    const row = document.createElement('div')
    row.className = `pool ${pool.id === 'melee' ? 'r1' : pool.id === 'ranged' ? 'r2' : pool.id === 'magic' ? 'r3' : 'r4'} ${mode}${isGm() ? ' gm' : ''}`
    row.title = pool.title
    for (let i = 0; i < 3; i += 1) {
      const die = document.createElement('div')
      const filled = i < char.pools[pool.id]
      die.className = `die ${filled ? 'filled' : 'dim'}`
      for (let pip = 0; pip < 6; pip += 1) die.appendChild(document.createElement('i'))
      die.title = filled ? 'Кубик в пуле' : 'Кубик не выбран'
      die.addEventListener('click', () => {
        if (isGm()) {
          const next = i + 1 === char.pools[pool.id] ? i : i + 1
          char.pools[pool.id] = next
          scheduleSave()
          renderPools(char)
          renderDock()
          return
        }
        if (filled) rollPool(pool.id)
      })
      row.appendChild(die)
    }
    root.appendChild(row)
  }
}

function renderHealth(char) {
  const root = $('health')
  root.innerHTML = ''
  root.className = `health ${char.healthMax === 4 ? 'four' : ''} ${isGm() ? 'gm' : ''}`
  const labels = HEALTH_LABELS[char.healthMax] || HEALTH_LABELS[3]
  for (let i = 0; i < char.healthMax; i += 1) {
    const box = document.createElement('div')
    const hurt = i >= char.healthMax - char.damage
    box.className = `hp ${hurt ? 'hurt' : ''}`
    box.title = isGm() ? 'Отметить урон' : labels[i]
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = labels[i]
    box.appendChild(label)
    if (isGm()) {
      box.addEventListener('click', () => {
        const target = char.healthMax - i
        char.damage = target === char.damage ? target - 1 : target
        char.damage = clamp(char.damage, 0, char.healthMax)
        scheduleSave()
        renderAll()
      })
    }
    root.appendChild(box)
  }
}

function renderBlocks(char) {
  const editable = isGm() && editMode
  const blocks = [
    ['blockAttack', 'attack', 'Обычная атака'],
    ['blockAction', 'action', 'Особое действие'],
    ['blockAbility', 'ability', 'Способность']
  ]
  for (const [id, key, placeholder] of blocks) {
    const root = $(id)
    root.innerHTML = ''
    if (editable) {
      const area = document.createElement('textarea')
      area.value = char[key]
      area.placeholder = placeholder
      area.maxLength = 400
      area.addEventListener('input', () => {
        char[key] = area.value.slice(0, 400)
        scheduleSave()
      })
      root.appendChild(area)
    } else {
      const value = char[key]
      if (value) {
        root.textContent = value
      } else {
        const span = document.createElement('span')
        span.className = 'placeholder'
        span.textContent = '—'
        root.appendChild(span)
      }
    }
  }
}

function makeInvSlot(className, icon, title) {
  const slot = document.createElement('button')
  slot.type = 'button'
  slot.className = `slot ${className}`
  slot.title = title
  if (icon) {
    const img = document.createElement('img')
    img.src = icon
    img.alt = ''
    slot.appendChild(img)
  }
  return slot
}

function makeAddSlot(kind) {
  const slot = document.createElement('button')
  slot.type = 'button'
  slot.className = 'slot add edit-only'
  slot.textContent = '+'
  slot.title = kind === 'item' ? 'Добавить предмет' : 'Добавить навык'
  slot.addEventListener('click', (event) => {
    event.stopPropagation()
    openInvPopover(kind, slot)
  })
  return slot
}

function makeMoreSlot(count) {
  const slot = document.createElement('button')
  slot.type = 'button'
  slot.className = 'slot'
  slot.textContent = `+${count}`
  slot.title = 'Показать всё'
  slot.addEventListener('click', () => openSkillsTab())
  return slot
}

function renderInventory(char) {
  const root = $('inventory')
  root.innerHTML = ''
  root.classList.toggle('editing', isGm() && editMode)
  root.title = isGm() && editMode ? 'Нажмите на поле, чтобы выбрать навык или предмет' : ''
  if (char.kind === 'monster') return

  const row = document.createElement('div')
  row.className = 'inv-line'

  for (let i = 0; i < 2; i += 1) {
    const available = char.potions[i] !== false
    const slot = makeInvSlot(
      `potion ${available ? '' : 'used'}`,
      'icons/item-potion.png',
      available ? 'Зелье (в наличии) — нажмите, чтобы потратить' : 'Зелье потрачено — нажмите, чтобы вернуть'
    )
    slot.addEventListener('click', () => togglePotion(i))
    row.appendChild(slot)
  }

  const item = char.items[0] ? CATALOG_BY_ID.get(char.items[0].id) : null
  const itemSlot = makeInvSlot(
    `item ${item ? '' : 'empty'}`,
    item ? item.file : '',
    item ? `${item.title} — заменить` : 'Выбрать предмет'
  )
  if (!item) itemSlot.textContent = isGm() ? '+' : '—'
  itemSlot.addEventListener('click', () => {
    if (isGm()) {
      openInvPopover('item', itemSlot)
      return
    }
    if (item) openItem(item.id)
  })
  row.appendChild(itemSlot)

  const skillId = char.kind === 'monster' ? '' : char.skills[0]
  const skill = skillId ? CATALOG_BY_ID.get(skillId) : null
  const skillSlot = makeInvSlot(
    `skill ${skill ? '' : 'empty'}`,
    skill ? skill.file : '',
    skill ? `${skill.title} — заменить` : 'Выбрать навык'
  )
  if (!skill) skillSlot.textContent = isGm() ? '+' : '—'
  skillSlot.addEventListener('click', () => {
    if (isGm()) {
      openInvPopover('skill', skillSlot)
      return
    }
    if (skill) openCheck({ skill })
  })
  row.appendChild(skillSlot)

  root.appendChild(row)
}

function togglePotion(index) {
  const char = currentChar()
  if (!char) return
  if (!isGm()) {
    postChat(`🎒 Hero Kids · ${char.name || 'Герой'} · использует зелье`)
    toast('Зелье отметит Мастер')
    return
  }
  char.potions[index] = char.potions[index] === false
  scheduleSave()
  renderInventory(char)
  const left = char.potions.filter(Boolean).length
  postChat(`🧪 Hero Kids · ${char.name || 'Герой'} · зелья: ${left}/2`)
}

function renderSheetStatus() {
  const char = currentChar()
  if (!char) return
  const status = $('status')
  if (status) status.title = `Урон ${char.damage} из ${char.healthMax}`
}

/* ------------------------------------------------------------------ */
/* Док                                                                */
/* ------------------------------------------------------------------ */

function renderDock() {
  const select = $('charSelect')
  const list = allowedChars()
  const char = currentChar()
  select.innerHTML = ''
  if (list.length === 0) {
    const option = document.createElement('option')
    option.textContent = 'Нет листов'
    select.appendChild(option)
    select.disabled = true
  } else {
    select.disabled = false
    for (const item of list) {
      const option = document.createElement('option')
      const name = item.name || (item.kind === 'monster' ? 'Монстр' : 'Герой')
      option.value = item.id
      option.textContent = `${name} · ${item.archetype || KIND_LABELS[item.kind]}`
      select.appendChild(option)
    }
    select.value = char ? char.id : list[0].id
  }

  renderRolls(char)
}

function rollCount(poolId, char) {
  if (!char) return 0
  return clamp(round(char.pools[poolId]), 0, 10)
}

function renderRolls(char) {
  const root = $('rolls')
  root.innerHTML = ''
  if (!char) return
  for (const pool of POOLS) {
    const count = rollCount(pool.id, char)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `roll ${pool.id === 'melee' ? 'primary' : ''} ${count === 0 ? 'off' : ''}`
    button.title = `${pool.title}: ${count}к6`
    button.innerHTML = `
      <span class="coin"><img src="${pool.icon}" alt=""></span>
      <span>${pool.label}</span>
      <span class="num">${count}</span>
    `
    if (count > 0) button.addEventListener('click', () => rollPool(pool.id))
    root.appendChild(button)
  }

  if (!char || char.kind !== 'monster') {
    const check = document.createElement('button')
    check.type = 'button'
    check.className = 'roll'
    check.title = 'Проверка способности: 1 + пул + навык'
    check.innerHTML = '<span class="coin" style="font-size:22px">🎯</span><span>Проверка</span>'
    check.addEventListener('click', () => openCheck())
    root.appendChild(check)
  }

  const initiative = document.createElement('button')
  initiative.type = 'button'
  initiative.className = 'roll'
  initiative.title = 'Инициатива: 1к6'
  initiative.innerHTML = '<span class="coin" style="font-size:22px">🎲</span><span>Инициатива</span>'
  initiative.addEventListener('click', rollInitiative)
  root.appendChild(initiative)
}

/* ------------------------------------------------------------------ */
/* Настройки                                                          */
/* ------------------------------------------------------------------ */

let settingsChar = null
let draftPools = blankPools()

function openSettings() {
  const char = currentChar()
  if (!char || !isGm()) return
  settingsChar = char
  $('settingsTitle').textContent = char.kind === 'monster' ? 'Настройки монстра' : 'Настройки героя'
  $('setName').value = char.name
  $('setArchetype').value = char.archetype
  $('setKind').value = char.kind
  $('setHealth').value = char.kind === 'hero' ? '3' : String(char.healthMax)
  $('setHealth').disabled = char.kind === 'hero'
  draftPools = { ...char.pools }
  renderPoolEditor()
  renderSettingsInventory()
  $('settingsModal').classList.remove('hidden')
  setTimeout(() => $('setName').focus(), 30)
}

function renderPoolEditor() {
  const root = $('poolEditor')
  root.innerHTML = ''
  for (const pool of POOLS) {
    const box = document.createElement('div')
    box.className = 'pe'
    const name = document.createElement('div')
    name.className = 'name'
    name.textContent = pool.label
    const stepper = document.createElement('div')
    stepper.className = 'stepper'
    const minus = document.createElement('button')
    minus.type = 'button'
    minus.textContent = '−'
    const value = document.createElement('b')
    value.textContent = String(draftPools[pool.id])
    const plus = document.createElement('button')
    plus.type = 'button'
    plus.textContent = '+'
    minus.addEventListener('click', () => {
      draftPools[pool.id] = clamp(draftPools[pool.id] - 1, 0, 3)
      value.textContent = String(draftPools[pool.id])
      renderBuildHint()
    })
    plus.addEventListener('click', () => {
      draftPools[pool.id] = clamp(draftPools[pool.id] + 1, 0, 3)
      value.textContent = String(draftPools[pool.id])
      renderBuildHint()
    })
    stepper.append(minus, value, plus)
    box.append(name, stepper)
    root.appendChild(box)
  }
  renderBuildHint()
}

function buildCost(pools) {
  const ranged = pools.ranged ? pools.ranged + 1 : 0
  const magic = pools.magic ? pools.magic + 1 : 0
  return pools.melee + pools.armor + ranged + magic
}

function renderBuildHint() {
  const hint = $('buildHint')
  const cost = buildCost(draftPools)
  hint.textContent = `${cost} / 4 кубика`
  hint.classList.toggle('bad', cost !== 4)
}

function renderInvPreview(element, itemId) {
  element.innerHTML = ''
  const item = itemId ? CATALOG_BY_ID.get(itemId) : null
  if (item) {
    element.classList.remove('empty')
    const img = document.createElement('img')
    img.src = item.file
    img.alt = item.title
    element.appendChild(img)
  } else {
    element.classList.add('empty')
  }
}

function renderSettingsInventory() {
  const char = settingsChar
  if (!char) return

  const skillSelect = $('skillSelect')
  skillSelect.innerHTML = ''
  const noSkill = document.createElement('option')
  noSkill.value = ''
  noSkill.textContent = '— нет навыка —'
  skillSelect.appendChild(noSkill)
  for (const skill of SKILLS) {
    const option = document.createElement('option')
    option.value = skill.id
    option.textContent = skill.title
    skillSelect.appendChild(option)
  }
  skillSelect.value = char.kind === 'monster' ? '' : char.skills[0] || ''
  skillSelect.disabled = char.kind === 'monster'

  const itemSelect = $('itemSelect')
  itemSelect.innerHTML = ''
  const noItem = document.createElement('option')
  noItem.value = ''
  noItem.textContent = '— нет предмета —'
  itemSelect.appendChild(noItem)
  for (const item of INVENTORY_ITEMS) {
    const option = document.createElement('option')
    option.value = item.id
    option.textContent = item.title
    itemSelect.appendChild(option)
  }
  itemSelect.value = char.items[0] ? char.items[0].id : ''

  renderInvPreview($('skillPreview'), char.kind === 'monster' ? null : char.skills[0])
  renderInvPreview($('itemPreview'), char.items[0] ? char.items[0].id : null)
}

function setSkillFromSettings() {
  const char = settingsChar
  if (!char || !isGm()) return
  const id = $('skillSelect').value
  char.skills = id ? [id] : []
  scheduleSave()
  renderSettingsInventory()
  renderSheet()
}

function setItemFromSettings() {
  const char = settingsChar
  if (!char || !isGm()) return
  const id = $('itemSelect').value
  char.items = id ? [{ id, count: 1 }] : []
  scheduleSave()
  renderSettingsInventory()
  renderSheet()
}

/* Выбор одного навыка или предмета прямо с карточки */
let invMode = 'item'

function openInvPopover(kind, anchor) {
  const char = currentChar()
  if (!char || !isGm()) return
  invMode = kind === 'skill' ? 'skill' : 'item'
  const select = $('invSelect')
  select.innerHTML = ''

  const none = document.createElement('option')
  none.value = ''
  none.textContent = invMode === 'item' ? '— убрать предмет —' : '— убрать навык —'
  select.appendChild(none)

  if (invMode === 'item') {
    for (const item of INVENTORY_ITEMS) {
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = item.title
      select.appendChild(option)
    }
    select.value = char.items[0] ? char.items[0].id : ''
  } else {
    for (const skill of SKILLS) {
      const option = document.createElement('option')
      option.value = skill.id
      option.textContent = skill.title
      select.appendChild(option)
    }
    select.value = char.skills[0] || ''
  }

  $('invTitle').textContent = invMode === 'item' ? 'Предмет' : 'Навык'
  $('invPopover').classList.remove('hidden')
  const rect = anchor.getBoundingClientRect()
  const width = 250
  const height = 140
  const left = Math.min(window.innerWidth - width - 10, Math.max(8, rect.left))
  const top = Math.min(window.innerHeight - height - 10, rect.bottom + 6)
  $('invPopover').style.left = `${left}px`
  $('invPopover').style.top = `${top}px`
}

function closeInvPopover() {
  $('invPopover').classList.add('hidden')
}

function addFromInvPopover() {
  const char = currentChar()
  const id = $('invSelect').value
  if (!char || !isGm()) return
  if (invMode === 'item') {
    char.items = id ? [{ id, count: 1 }] : []
  } else {
    char.skills = id ? [id] : []
  }
  scheduleSave()
  renderInventory(char)
  if (!$('settingsModal').classList.contains('hidden')) renderSettingsInventory()
  closeInvPopover()
}

function saveSettings() {
  const char = settingsChar
  if (!char) return
  char.name = text($('setName').value, 40)
  char.kind = $('setKind').value === 'monster' ? 'monster' : 'hero'
  char.archetype =
    text($('setArchetype').value, 30) || (char.kind === 'monster' ? 'Монстр' : 'Воин')
  char.healthMax =
    char.kind === 'hero' ? 3 : clamp(round($('setHealth').value) || 1, 1, 4)
  char.damage = clamp(char.damage, 0, char.healthMax)
  char.pools = { ...draftPools }
  if (char.kind === 'monster') char.skills = []
  closeModal($('settingsModal'))
  scheduleSave()
  renderAll()
  setStatus(isGm() ? 'лист обновлён' : statusText)
}

function addChar(kind) {
  if (!isGm()) return
  const char = blankChar(kind)
  char.name = kind === 'monster' ? 'Новый монстр' : 'Новый герой'
  if (kind === 'monster') {
    char.archetype = 'Монстр'
    char.pools = { melee: 1, ranged: 0, magic: 0, armor: 1 }
    char.attack = 'Атака по соседней цели.'
  }
  state.chars.push(char)
  writeSelect(char.id)
  state.currentId = char.id
  scheduleSave()
  renderAll()
  openSettings()
}

function duplicateChar() {
  const char = currentChar()
  if (!char || !isGm()) return
  const copy = normalizeChar(JSON.parse(JSON.stringify(char)))
  copy.id = uid('h')
  copy.name = `${char.name || 'Без имени'} (копия)`.slice(0, 40)
  state.chars.push(copy)
  writeSelect(copy.id)
  state.currentId = copy.id
  scheduleSave()
  renderAll()
  toast('Лист скопирован')
}

function deleteChar() {
  const char = currentChar()
  if (!char || !isGm()) return
  if (!window.confirm(`Удалить лист «${char.name || 'Без имени'}»?`)) return
  state.chars = state.chars.filter((item) => item.id !== char.id)
  for (const card of state.cards) {
    card.assignedTo = card.assignedTo.filter((id) => id !== char.id)
  }
  state.currentId = state.chars[0] ? state.chars[0].id : null
  writeSelect(state.currentId || '')
  scheduleSave()
  renderAll()
  toast('Лист удалён')
}

/* ------------------------------------------------------------------ */
/* Портрет                                                            */
/* ------------------------------------------------------------------ */

function pickPortrait() {
  if (!isGm()) return
  $('portraitFile').click()
}

function loadPortraitFile(file) {
  if (!file || !isGm()) return
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast('Нужен PNG, JPEG или WebP')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('Файл больше 10 МБ')
    return
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    const size = 384
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, size / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    let data = canvas.toDataURL('image/jpeg', 0.82)
    if (data.length > MAX_PORTRAIT) {
      canvas.width = Math.round(canvas.width * 0.7)
      canvas.height = Math.round(canvas.height * 0.7)
      const ctx2 = canvas.getContext('2d')
      if (ctx2) {
        ctx2.drawImage(image, 0, 0, canvas.width, canvas.height)
        data = canvas.toDataURL('image/jpeg', 0.72)
      }
    }
    const char = currentChar()
    if (!char) return
    char.portrait = data
    scheduleSave()
    renderSheet()
    toast('Портрет обновлён')
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    toast('Не удалось прочитать картинку')
  }
  image.src = url
}

/* ------------------------------------------------------------------ */
/* Библиотека                                                         */
/* ------------------------------------------------------------------ */

let libTab = 'skill'
let libSearch = ''

function openLibrary() {
  if (!isGm()) return
  $('libraryModal').classList.remove('hidden')
  renderLibrary()
}

function renderLibrary() {
  const tabs = $('libTabs')
  tabs.innerHTML = ''
  const items = [
    ['skill', 'Навыки'],
    ['item', 'Предметы'],
    ['ability', 'Способности']
  ]
  for (const [id, label] of items) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = libTab === id ? 'active' : ''
    button.addEventListener('click', () => {
      libTab = id
      renderLibrary()
    })
    tabs.appendChild(button)
  }
  $('libSearch').value = libSearch

  const grid = $('libGrid')
  grid.innerHTML = ''
  const source = libTab === 'skill' ? SKILLS : libTab === 'item' ? INVENTORY_ITEMS : ABILITIES
  const query = libSearch.trim().toLowerCase()
  const char = currentChar()
  const filtered = source.filter((item) => {
    if (!query) return true
    return `${item.title} ${item.description}`.toLowerCase().includes(query)
  })
  for (const item of filtered) {
    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = 'lib-item'
    if (char && libTab === 'skill' && char.skills.includes(item.id)) cell.classList.add('added')
    if (char && libTab === 'item' && char.items.some((entry) => entry.id === item.id)) cell.classList.add('added')
    cell.title = `${item.description} (стр. ${item.page})`
    const ico = document.createElement('span')
    ico.className = 'ico'
    const img = document.createElement('img')
    img.src = item.file
    img.alt = ''
    ico.appendChild(img)
    const label = document.createElement('span')
    label.textContent = item.title
    cell.append(ico, label)
    cell.addEventListener('click', () => addFromLibrary(item))
    grid.appendChild(cell)
  }
  if (filtered.length === 0) grid.innerHTML = '<p class="muted">Ничего не найдено.</p>'
}

function addFromLibrary(item) {
  const char = currentChar()
  if (!char || !isGm()) return
  if (char.kind === 'monster' && item.category === 'skill') {
    toast('У монстра нет навыков — только способности и предметы')
    return
  }
  if (item.category === 'skill') {
    char.skills = [item.id]
    toast(`Навык «${item.title}» выбран`)
  } else if (item.category === 'item' && item.id !== 'potion') {
    char.items = [{ id: item.id, count: 1 }]
    toast(`Предмет «${item.title}» выбран`)
  } else if (item.category === 'ability') {
    const line = `${item.title}. ${item.description}`
    if (!char.ability.includes(item.title)) {
      char.ability = (char.ability ? `${char.ability}\n` : '') + line
    }
    toast(`Способность «${item.title}» добавлена в текст`)
  }
  scheduleSave()
  renderSheet()
  renderLibrary()
}

/* ------------------------------------------------------------------ */
/* Предмет                                                            */
/* ------------------------------------------------------------------ */

let itemId = null

function openItem(id) {
  const char = currentChar()
  const entry = char && char.items.find((row) => row.id === id)
  const item = CATALOG_BY_ID.get(id)
  if (!entry || !item) return
  itemId = id
  $('itemTitle').textContent = item.title
  $('itemIcon').src = item.file
  $('itemDesc').textContent = item.description
  $('itemCount').textContent = String(entry.count)
  $('itemModal').classList.remove('hidden')
}

function changeItem(delta) {
  const char = currentChar()
  if (!char || !isGm()) return
  const entry = char.items.find((row) => row.id === itemId)
  if (!entry) return
  entry.count = clamp(entry.count + delta, 0, 99)
  if (entry.count <= 0) char.items = char.items.filter((row) => row.id !== itemId)
  scheduleSave()
  if (entry.count <= 0) {
    closeModal($('itemModal'))
  } else {
    $('itemCount').textContent = String(entry.count)
  }
  renderSheet()
}

function removeItem() {
  const char = currentChar()
  if (!char || !isGm()) return
  char.items = char.items.filter((row) => row.id !== itemId)
  scheduleSave()
  closeModal($('itemModal'))
  renderSheet()
}

function useItem() {
  const char = currentChar()
  const item = CATALOG_BY_ID.get(itemId)
  if (!char || !item) return
  postChat(`🎒 Hero Kids · ${char.name || 'Герой'} · использует «${item.title}»`)
  if (item.id === 'potion' && isGm()) {
    char.damage = 0
    scheduleSave()
    renderSheet()
    toast('Здоровье восстановлено до максимума')
  }
  if (isGm() && item.consumable) changeItem(-1)
  closeModal($('itemModal'))
}

/* ------------------------------------------------------------------ */
/* Проверка                                                           */
/* ------------------------------------------------------------------ */

let checkStat = 'melee'
let checkDC = 5
let checkBonus = false
let checkSkill = null

function openCheck(options = {}) {
  const char = currentChar()
  if (!char) return
  checkSkill = options.skill || null
  checkStat = checkSkill && checkSkill.stat ? checkSkill.stat : 'melee'
  checkDC = 5
  checkBonus = Boolean(checkSkill)
  $('checkModal').classList.remove('hidden')
  renderCheck()
}

function renderCheck() {
  const char = currentChar()
  if (!char) return
  const stats = $('checkStats')
  stats.innerHTML = ''
  for (const pool of POOLS.filter((item) => item.id !== 'armor')) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = checkStat === pool.id ? 'active' : ''
    button.innerHTML = `<img src="${pool.icon}" alt=""><span>${pool.stat}</span><small>${char.pools[pool.id]}к6</small>`
    button.addEventListener('click', () => {
      checkStat = pool.id
      renderCheck()
    })
    stats.appendChild(button)
  }

  const dc = $('checkDC')
  dc.innerHTML = ''
  for (const value of [4, 5, 6]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = checkDC === value ? 'active' : ''
    button.textContent = `${value} · ${value === 4 ? 'низкая' : value === 5 ? 'обычная' : 'высокая'}`
    button.addEventListener('click', () => {
      checkDC = value
      renderCheck()
    })
    dc.appendChild(button)
  }

  $('checkBonus').checked = checkBonus
  const info = $('checkSkillInfo')
  if (checkSkill) {
    info.innerHTML = ''
    const name = document.createElement('b')
    name.textContent = `${checkSkill.title}: `
    info.append(name, document.createTextNode(checkSkill.description))
    info.classList.remove('hidden')
  } else {
    info.classList.add('hidden')
  }
  const pool = char.pools[checkStat] || 0
  const dice = 1 + pool + (checkBonus ? 1 : 0)
  const skillText = checkSkill ? ` · ${checkSkill.title}` : ''
  $('checkPreview').textContent = `${POOLS.find((p) => p.id === checkStat).stat}${skillText}: 1 + ${pool}${checkBonus ? ' + 1' : ''} = ${dice}к6 · сложность ${checkDC}`
}

function startCheck() {
  const char = currentChar()
  if (!char) return
  const pool = char.pools[checkStat] || 0
  const dice = 1 + pool + (checkBonus ? 1 : 0)
  const skillText = checkSkill ? ` · ${checkSkill.title}` : ''
  const statLabel = POOLS.find((p) => p.id === checkStat).stat
  closeModal($('checkModal'))
  rollDice(dice, `Проверка ${statLabel}${skillText}`, (values) => {
    const max = Math.max(...values)
    const ok = max >= checkDC
    const text = `🎯 Hero Kids · ${char.name || 'Герой'} · Проверка ${statLabel}${skillText} (${dice}к6): ${values.join(', ')} → ${max} — ${ok ? 'УСПЕХ' : 'НЕ ВЫШЛО'} (сложность ${checkDC})`
    postChat(text)
    showDiceResult(values, `Максимум ${max} · сложность ${checkDC}`, ok ? 'УСПЕХ' : 'НЕ ВЫШЛО', ok)
  })
}

/* ------------------------------------------------------------------ */
/* Броски и 3D-кубики                                                 */
/* ------------------------------------------------------------------ */

let diceBox = null
let diceReady = false
let diceMode = null
let rolling = false
let dice2d = null

async function ensureDice() {
  if (diceMode === '2d') return false
  if (diceReady && diceBox) return true
  const DiceBox = window['dice-box-threejs']
  if (!DiceBox) {
    diceMode = '2d'
    return false
  }
  try {
    if (!diceBox) {
      diceBox = new DiceBox('#diceStage', {
        assetPath: '../dice3d/assets/',
        sounds: false,
        shadows: true,
        theme_surface: 'green-felt',
        theme_colorset: 'white',
        theme_material: 'plastic',
        light_intensity: 0.8,
        gravity_multiplier: 400,
        strength: 1,
        baseScale: 90
      })
    }
    if (!diceBox || typeof diceBox.initialize !== 'function') {
      diceMode = '2d'
      return false
    }
    await diceBox.initialize()
    diceReady = true
    diceMode = '3d'
    return true
  } catch {
    diceReady = false
    diceBox = null
    diceMode = '2d'
    return false
  }
}

function summarize(results) {
  const values = []
  let total = 0
  const walk = (node) => {
    if (node == null) return
    if (typeof node === 'number') {
      values.push(node)
      total += node
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node !== 'object') return
    if (Array.isArray(node.sets)) {
      node.sets.forEach(walk)
      return
    }
    if (Array.isArray(node.rolls)) {
      node.rolls.forEach(walk)
      return
    }
    if (typeof node.value === 'number') {
      values.push(node.value)
      total += node.value
      return
    }
    if (Array.isArray(node.dice)) {
      node.dice.forEach(walk)
      return
    }
    if (typeof node.total === 'number') total += node.total
  }
  walk(results)
  return { values, total }
}

function cryptoDie() {
  try {
    const buffer = new Uint8Array(1)
    crypto.getRandomValues(buffer)
    return (buffer[0] % 6) + 1
  } catch {
    return Math.floor(Math.random() * 6) + 1
  }
}

function openDice(label) {
  $('diceLabel').textContent = label
  $('diceResult').classList.add('hidden')
  $('diceOverlay').classList.remove('hidden')
  $('diceStage').style.display = 'block'
  $('diceDone').disabled = true
}

function closeDice() {
  if (rolling) return
  $('diceOverlay').classList.add('hidden')
}

function showDiceResult(values, sub, outcome, ok) {
  const result = $('diceResult')
  result.innerHTML = ''
  const numbers = document.createElement('div')
  numbers.className = 'values'
  numbers.textContent = values.join('  ')
  const subtitle = document.createElement('div')
  subtitle.className = 'sub'
  subtitle.textContent = sub
  result.append(numbers, subtitle)
  if (outcome) {
    const line = document.createElement('div')
    line.className = `outcome ${typeof ok === 'boolean' ? (ok ? 'ok' : 'bad') : ''}`
    line.textContent = outcome
    result.appendChild(line)
  }
  result.classList.remove('hidden')
  $('diceDone').disabled = false
}

function render2d(values) {
  $('diceStage').style.display = 'none'
  if (!dice2d) {
    dice2d = document.createElement('div')
    dice2d.className = 'dice-2d'
    $('diceOverlay').insertBefore(dice2d, $('diceResult'))
  }
  dice2d.innerHTML = ''
  for (const value of values) {
    const die = document.createElement('div')
    die.className = 'd'
    die.style.animationDelay = `${Math.random() * 0.2}s`
    const pips = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9]
    }[value] || []
    for (let i = 1; i <= 9; i += 1) {
      const pip = document.createElement('i')
      const row = Math.floor((i - 1) / 3) + 1
      const col = ((i - 1) % 3) + 1
      pip.style.gridArea = `${row} / ${col}`
      if (!pips.includes(i)) pip.style.visibility = 'hidden'
      die.appendChild(pip)
    }
    dice2d.appendChild(die)
  }
  dice2d.classList.remove('hidden')
}

async function rollDice(count, label, done) {
  if (rolling) return
  const char = currentChar()
  if (!char) return
  if (count < 1) {
    toast('В этом пуле нет кубиков')
    return
  }
  rolling = true
  openDice(label)
  setStatus('бросок…')

  let values = null
  try {
    if (await ensureDice()) {
      await new Promise((resolve) => setTimeout(resolve, 60))
      const result = await diceBox.roll(`${count}d6`)
      const summary = summarize(result)
      if (summary.values.length === count) values = summary.values
    }
  } catch (error) {
    console.warn('[herokids] 3D-кубики недоступны:', error)
    diceMode = '2d'
    diceReady = false
  }

  if (!values) {
    values = Array.from({ length: count }, cryptoDie)
    render2d(values)
    await new Promise((resolve) => setTimeout(resolve, 520))
  } else if (dice2d) {
    dice2d.classList.add('hidden')
  }

  rolling = false
  setStatus(remote ? 'общее · сохранено' : 'локально')
  done(values)
}

function closeDiceOverlay() {
  if (!rolling) $('diceOverlay').classList.add('hidden')
}

function rollPool(poolId) {
  const char = currentChar()
  if (!char) return
  const count = rollCount(poolId, char)
  if (count < 1) {
    toast('В этом пуле нет кубиков')
    return
  }
  const pool = POOL_BY_ID[poolId]
  if (char.damage >= char.healthMax) {
    toast('Герой в нокауте — нужен союзник или отдых')
    return
  }
  const label = pool.title
  rollDice(count, label, (values) => {
    const max = Math.max(...values)
    if (poolId === 'armor') {
      showDiceResult(values, `Максимум ${max}`, null)
    } else {
      showDiceResult(values, `Максимум ${max}`, 'Попадание, если у защиты меньше', null)
    }
    postChat(
      `🎲 Hero Kids · ${char.name || 'Герой'} · ${label} (${count}к6): ${values.join(', ')} → максимум ${max}`
    )
  })
}

function rollInitiative() {
  const char = currentChar()
  if (!char) return
  rollDice(1, 'Инициатива', (values) => {
    const value = values[0]
    showDiceResult(values, 'Инициатива героя', null)
    postChat(`🎲 Hero Kids · ${char.name || 'Герой'} · инициатива: ${value}`)
  })
}

function postChat(value) {
  const message = String(value).slice(0, 500)
  post({ type: 'chat', text: message })
  toast(message)
}

/* ------------------------------------------------------------------ */
/* Карточки снаряжения                                                */
/* ------------------------------------------------------------------ */

let activeCardId = null
let cardTab = 'items'

function openCards() {
  cardTab = 'items'
  $('cardsModal').classList.remove('hidden')
  const list = visibleCards()
  if (!activeCardId || !list.some((card) => card.id === activeCardId)) {
    activeCardId = list[0] ? list[0].id : null
  }
  renderCards()
}

function openSkillsTab() {
  cardTab = 'skills'
  $('cardsModal').classList.remove('hidden')
  renderCards()
}

function renderCards() {
  const list = visibleCards()
  if (activeCardId && !list.some((card) => card.id === activeCardId)) {
    activeCardId = list[0] ? list[0].id : null
  }
  const itemsTab = cardTab === 'items'
  $('cardsLayout').classList.toggle('hidden', !itemsTab)
  $('skillsLayout').classList.toggle('hidden', itemsTab)
  $('newCardBtn').classList.toggle('hidden', !itemsTab || !isGm())
  for (const button of $('cardsTabs').querySelectorAll('[data-tab]')) {
    button.classList.toggle('active', button.dataset.tab === cardTab)
  }
  if (!itemsTab) {
    renderSkillsLibrary()
    return
  }
  renderCardList()
  const card = activeCardId ? cardById(activeCardId) : null
  renderCardPreview(card)
  renderCardEditor(card)
}

function renderSkillsLibrary() {
  const char = currentChar()
  const skillsList = $('skillsList')
  const itemsList = $('itemsList')
  skillsList.innerHTML = ''
  itemsList.innerHTML = ''

  if (!char) {
    skillsList.innerHTML = '<p class="muted">Нет выбранного листа.</p>'
    itemsList.innerHTML = '<p class="muted">Нет выбранного листа.</p>'
    return
  }

  if (char.skills.length === 0) {
    skillsList.innerHTML = '<p class="muted">Навыки не выбраны.</p>'
  }
  for (const id of char.skills) {
    const skill = CATALOG_BY_ID.get(id)
    if (!skill) continue
    const row = document.createElement('div')
    row.className = 'skill-row'
    row.title = 'Бросок проверки'
    const ico = document.createElement('span')
    ico.className = 'ico'
    const img = document.createElement('img')
    img.src = skill.file
    img.alt = ''
    ico.appendChild(img)
    const textBox = document.createElement('div')
    const title = document.createElement('b')
    title.textContent = skill.title
    const description = document.createElement('p')
    description.textContent = skill.description
    textBox.append(title, description)
    row.append(ico, textBox)
    row.addEventListener('click', () => openCheck({ skill }))
    skillsList.appendChild(row)
  }

  if (char.items.length === 0) {
    itemsList.innerHTML = '<p class="muted">Инвентарь пуст.</p>'
  }
  for (const entry of char.items) {
    const item = CATALOG_BY_ID.get(entry.id)
    if (!item) continue
    const row = document.createElement('div')
    row.className = 'skill-row'
    const ico = document.createElement('span')
    ico.className = 'ico'
    const img = document.createElement('img')
    img.src = item.file
    img.alt = ''
    ico.appendChild(img)
    const textBox = document.createElement('div')
    const title = document.createElement('b')
    title.textContent = item.title
    const description = document.createElement('p')
    description.textContent = item.description
    textBox.append(title, description)
    const count = document.createElement('span')
    count.className = 'count'
    count.textContent = `×${entry.count}`
    row.append(ico, textBox, count)
    row.addEventListener('click', () => openItem(entry.id))
    itemsList.appendChild(row)
  }
}

function renderCardList() {
  const list = $('cardList')
  list.innerHTML = ''
  const source = visibleCards()
  if (source.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'muted'
    empty.textContent = isGm()
      ? 'Карточек пока нет.'
      : 'Мастер ещё не выдал снаряжение.'
    list.appendChild(empty)
  }
  for (const card of source) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = `card-row ${card.id === activeCardId ? 'active' : ''}`
    const thumb = document.createElement('span')
    thumb.className = 'thumb'
    if (card.art) {
      const img = document.createElement('img')
      img.src = card.art
      img.alt = ''
      thumb.appendChild(img)
    } else {
      thumb.classList.add('empty')
      thumb.textContent = '—'
    }
    const meta = document.createElement('span')
    meta.className = 'meta'
    const title = document.createElement('b')
    title.textContent = card.title
    const kind = document.createElement('span')
    kind.textContent = CARD_KINDS[card.kind]
    meta.append(title, kind)
    row.append(thumb, meta)
    row.addEventListener('click', () => {
      activeCardId = card.id
      renderCards()
    })
    list.appendChild(row)
  }
}

function renderCardPreview(card) {
  const root = $('cardPreview')
  root.innerHTML = ''
  if (!card) {
    root.classList.add('empty')
    root.textContent = 'Выберите карточку'
    return
  }
  root.classList.remove('empty')

  const head = document.createElement('div')
  head.className = 'head'
  const logo = document.createElement('img')
  logo.className = 'logo'
  logo.src = 'logo.png'
  logo.alt = "Hero Kids Creator's Guild"
  const title = document.createElement('div')
  title.className = 'title'
  title.textContent = card.title
  const kind = document.createElement('div')
  kind.className = 'type'
  kind.textContent = CARD_KINDS[card.kind]
  head.append(logo, title, kind)

  const body = document.createElement('div')
  body.className = 'body'
  const art = document.createElement('div')
  art.className = 'art'
  if (card.art) {
    const img = document.createElement('img')
    img.src = card.art
    img.alt = ''
    art.appendChild(img)
  } else {
    const empty = document.createElement('div')
    empty.className = 'art-empty'
    empty.textContent = 'Нет изображения'
    art.appendChild(empty)
  }
  const flavor = document.createElement('div')
  flavor.className = 'flavor'
  flavor.textContent = card.flavor
  const effect = document.createElement('div')
  effect.className = 'effect'
  effect.textContent = card.effect
  body.append(art, flavor, effect)

  const footer = document.createElement('div')
  footer.className = 'footer'
  footer.textContent = card.note

  root.append(head, body, footer)
}

function renderCardEditor(card) {
  const root = $('cardEditor')
  root.innerHTML = ''
  if (!card) return

  if (!isGm()) {
    const info = document.createElement('div')
    info.className = 'card-readonly'
    info.textContent = [card.flavor, card.effect || 'Описание не заполнено.', card.note]
      .filter(Boolean)
      .join('\n\n')
    root.appendChild(info)
    return
  }

  const row2 = document.createElement('div')
  row2.className = 'row2'
  const titleLabel = document.createElement('label')
  titleLabel.textContent = 'Название'
  const titleInput = document.createElement('input')
  titleInput.value = card.title
  titleInput.maxLength = 40
  titleInput.addEventListener('input', () => {
    card.title = text(titleInput.value, 40)
    scheduleSave()
    renderCardPreview(card)
    renderCardList()
  })
  titleLabel.appendChild(titleInput)
  const kindLabel = document.createElement('label')
  kindLabel.textContent = 'Тип'
  const kindSelect = document.createElement('select')
  for (const [value, label] of Object.entries(CARD_KINDS)) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    kindSelect.appendChild(option)
  }
  kindSelect.value = card.kind
  kindSelect.addEventListener('change', () => {
    card.kind = kindSelect.value
    if (!card.note || Object.values(CARD_NOTES).includes(card.note)) {
      card.note = CARD_NOTES[card.kind]
      renderCardEditor(card)
    }
    scheduleSave()
    renderCardPreview(card)
    renderCardList()
  })
  kindLabel.appendChild(kindSelect)
  row2.append(titleLabel, kindLabel)
  root.appendChild(row2)

  const artLabel = document.createElement('label')
  artLabel.textContent = 'Изображение (своё)'
  const artBox = document.createElement('div')
  artBox.className = `art-upload ${card.art ? '' : 'empty'}`
  artBox.title = 'Загрузить изображение'
  if (card.art) {
    const img = document.createElement('img')
    img.src = card.art
    img.alt = ''
    artBox.appendChild(img)
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'art-clear'
    clear.textContent = '×'
    clear.title = 'Убрать изображение'
    clear.addEventListener('click', (event) => {
      event.stopPropagation()
      card.art = ''
      scheduleSave()
      renderCardPreview(card)
      renderCardEditor(card)
      renderCardList()
    })
    artBox.appendChild(clear)
  }
  artBox.addEventListener('click', () => pickCardArt(card))
  artBox.addEventListener('dragover', (event) => {
    event.preventDefault()
    artBox.classList.add('drag')
  })
  artBox.addEventListener('dragleave', () => artBox.classList.remove('drag'))
  artBox.addEventListener('drop', (event) => {
    event.preventDefault()
    artBox.classList.remove('drag')
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (file) applyCardArt(card, file)
  })
  artLabel.appendChild(artBox)
  root.appendChild(artLabel)

  const assignLabel = document.createElement('label')
  assignLabel.textContent = 'Выдать героям'
  const assignBox = document.createElement('div')
  assignBox.className = 'bonuses'
  if (state.chars.length === 0) {
    const note = document.createElement('span')
    note.className = 'muted'
    note.textContent = 'Сначала создайте героя.'
    assignBox.appendChild(note)
  }
  for (const char of state.chars) {
    const wrap = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = card.assignedTo.includes(char.id)
    input.addEventListener('change', () => {
      if (input.checked) {
        if (!card.assignedTo.includes(char.id)) card.assignedTo.push(char.id)
      } else {
        card.assignedTo = card.assignedTo.filter((id) => id !== char.id)
      }
      scheduleSave()
      toast(input.checked ? 'Карточка выдана' : 'Карточка убрана')
    })
    const span = document.createElement('span')
    span.textContent = `${char.name || 'Без имени'} · ${char.kind === 'monster' ? 'монстр' : 'герой'}`
    wrap.append(input, span)
    assignBox.appendChild(wrap)
  }
  assignLabel.appendChild(assignBox)
  root.appendChild(assignLabel)

  const flavorLabel = document.createElement('label')
  flavorLabel.textContent = 'Вкусный текст'
  const flavorInput = document.createElement('input')
  flavorInput.value = card.flavor
  flavorInput.maxLength = 90
  flavorInput.addEventListener('input', () => {
    card.flavor = text(flavorInput.value, 90)
    scheduleSave()
    renderCardPreview(card)
  })
  flavorLabel.appendChild(flavorInput)
  root.appendChild(flavorLabel)

  const effectLabel = document.createElement('label')
  effectLabel.textContent = 'Эффект'
  const effectInput = document.createElement('textarea')
  effectInput.rows = 3
  effectInput.value = card.effect
  effectInput.maxLength = 260
  effectInput.addEventListener('input', () => {
    card.effect = text(effectInput.value, 260)
    scheduleSave()
    renderCardPreview(card)
  })
  effectLabel.appendChild(effectInput)
  root.appendChild(effectLabel)

  const noteLabel = document.createElement('label')
  noteLabel.textContent = 'Примечание'
  const noteInput = document.createElement('input')
  noteInput.value = card.note
  noteInput.maxLength = 200
  noteInput.addEventListener('input', () => {
    card.note = text(noteInput.value, 200)
    scheduleSave()
    renderCardPreview(card)
  })
  noteLabel.appendChild(noteInput)
  root.appendChild(noteLabel)

  const actions = document.createElement('div')
  actions.className = 'actions'
  const duplicate = document.createElement('button')
  duplicate.type = 'button'
  duplicate.className = 'ghost'
  duplicate.textContent = 'Дублировать'
  duplicate.addEventListener('click', () => {
    const copy = normalizeCard(JSON.parse(JSON.stringify(card)))
    copy.id = uid('c')
    copy.title = `${card.title} (копия)`.slice(0, 40)
    state.cards.push(copy)
    activeCardId = copy.id
    scheduleSave()
    renderCards()
  })
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'ghost'
  remove.textContent = 'Удалить'
  remove.addEventListener('click', () => {
    if (!window.confirm(`Удалить карточку «${card.title}»?`)) return
    state.cards = state.cards.filter((row) => row.id !== card.id)
    activeCardId = state.cards[0] ? state.cards[0].id : null
    scheduleSave()
    renderCards()
  })
  actions.append(duplicate, remove)
  root.appendChild(actions)
}

function newCard() {
  if (!isGm()) return
  const card = blankCard()
  state.cards.push(card)
  activeCardId = card.id
  cardTab = 'items'
  scheduleSave()
  renderCards()
}

function pickCardArt(card) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp'
  input.style.display = 'none'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files && input.files[0]
    if (file) applyCardArt(card, file)
    input.remove()
  })
  input.click()
}

function applyCardArt(card, file) {
  loadImage(file, (data) => {
    card.art = data
    scheduleSave()
    renderCardPreview(card)
    renderCardEditor(card)
    renderCardList()
  })
}

function loadImage(file, done) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast('Нужен PNG, JPEG или WebP')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('Файл больше 10 МБ')
    return
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 384 / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    done(canvas.toDataURL('image/jpeg', 0.82))
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    toast('Не удалось прочитать картинку')
  }
  image.src = url
}

/* ------------------------------------------------------------------ */
/* Модальные окна и меню                                              */
/* ------------------------------------------------------------------ */

function closeModal(element) {
  if (element) element.classList.add('hidden')
}

function openMenu(menu, anchor) {
  menu.classList.remove('hidden')
  const rect = anchor.getBoundingClientRect()
  menu.style.left = `${Math.min(window.innerWidth - 210, Math.max(8, rect.left))}px`
  menu.style.top = `${Math.min(window.innerHeight - 180, rect.bottom + 6)}px`
  menu.dataset.anchor = anchor.id
}

function closeMenus() {
  $('newMenu').classList.add('hidden')
  $('moreMenu').classList.add('hidden')
}

/* ------------------------------------------------------------------ */
/* Масштаб листа                                                      */
/* ------------------------------------------------------------------ */

function fitSheet() {
  const app = $('app')
  const stage = $('stage')
  const sheet = $('sheet')
  if (!app || !stage || !sheet) return
  const widthScale = Math.min(app.clientWidth - 24, 1123) / 1123
  const heightScale = (window.innerHeight - 150) / 792
  const scale = clamp(Math.min(widthScale, heightScale), 0.45, 1)
  sheet.style.setProperty('--sheet-scale', String(scale))
  stage.style.height = `${792 * scale}px`
}

/* ------------------------------------------------------------------ */
/* События                                                            */
/* ------------------------------------------------------------------ */

function bind() {
  $('charSelect').addEventListener('change', () => {
    const id = $('charSelect').value
    if (!id) return
    writeSelect(id)
    const char = charById(id)
    if (char && isGm()) state.currentId = char.id
    if (isGm()) scheduleSave()
    renderAll()
  })

  $('newBtn').addEventListener('click', (event) => {
    event.stopPropagation()
    openMenu($('newMenu'), $('newBtn'))
  })
  $('newMenu').addEventListener('click', (event) => {
    const kind = event.target.dataset && event.target.dataset.new
    if (!kind) return
    closeMenus()
    addChar(kind)
  })

  $('moreBtn').addEventListener('click', (event) => {
    event.stopPropagation()
    openMenu($('moreMenu'), $('moreBtn'))
  })
  $('moreMenu').addEventListener('click', (event) => {
    const action = event.target.dataset && event.target.dataset.more
    if (!action) return
    closeMenus()
    const char = currentChar()
    if (!char || !isGm()) return
    if (action === 'duplicate') duplicateChar()
    if (action === 'delete') deleteChar()
    if (action === 'rest') {
      char.damage = clamp(char.damage - 1, 0, char.healthMax)
      scheduleSave()
      renderAll()
      postChat(`💤 Hero Kids · ${char.name || 'Герой'} · отдых: урон ${char.damage}/${char.healthMax}`)
    }
    if (action === 'heal') {
      char.damage = 0
      scheduleSave()
      renderAll()
      postChat(`💤 Hero Kids · ${char.name || 'Герой'} · полностью вылечен`)
    }
  })

  $('modeBtn').addEventListener('click', () => {
    if (!isGm()) return
    editMode = !editMode
    $('modeBtn').classList.toggle('active', editMode)
    if (!editMode) scheduleSave()
    renderSheet()
  })
  $('editBtn').addEventListener('click', openSettings)
  $('libraryBtn').addEventListener('click', openLibrary)
  $('libraryItemsBtn').addEventListener('click', () => openCards())
  $('cardsTabs').addEventListener('click', (event) => {
    const tab = event.target && event.target.dataset ? event.target.dataset.tab : ''
    if (tab !== 'items' && tab !== 'skills') return
    cardTab = tab
    renderCards()
  })
  $('newCardBtn').addEventListener('click', newCard)

  $('settingsSave').addEventListener('click', saveSettings)
  $('setKind').addEventListener('change', () => {
    const hero = $('setKind').value === 'hero'
    $('setHealth').disabled = hero
    if (hero) $('setHealth').value = '3'
  })
  $('skillSelect').addEventListener('change', setSkillFromSettings)
  $('itemSelect').addEventListener('change', setItemFromSettings)

  $('portraitPick').addEventListener('click', pickPortrait)
  $('portraitClear').addEventListener('click', () => {
    const char = settingsChar
    if (!char) return
    char.portrait = ''
    scheduleSave()
    renderSheet()
  })
  $('portraitFile').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0]
    if (file) loadPortraitFile(file)
    event.target.value = ''
  })
  $('portraitFrame').addEventListener('click', () => {
    if (!isGm()) return
    if (editMode) pickPortrait()
  })
  $('portraitFrame').addEventListener('dragover', (event) => {
    if (!isGm()) return
    event.preventDefault()
    $('portraitFrame').classList.add('drag')
  })
  $('portraitFrame').addEventListener('dragleave', () => $('portraitFrame').classList.remove('drag'))
  $('portraitFrame').addEventListener('drop', (event) => {
    if (!isGm()) return
    event.preventDefault()
    $('portraitFrame').classList.remove('drag')
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (file) loadPortraitFile(file)
  })

  $('nameInput').addEventListener('input', () => {
    const char = currentChar()
    if (!char || !isGm()) return
    char.name = text($('nameInput').value, 40)
    const option = $('charSelect').selectedOptions[0]
    if (option) option.textContent = `${char.name || 'Без имени'} · ${char.archetype || KIND_LABELS[char.kind]}`
    scheduleSave()
  })

  $('classInput').addEventListener('input', () => {
    const char = currentChar()
    if (!char || !isGm()) return
    char.archetype = text($('classInput').value, 30)
    const option = $('charSelect').selectedOptions[0]
    if (option) option.textContent = `${char.name || 'Без имени'} · ${char.archetype || KIND_LABELS[char.kind]}`
    scheduleSave()
  })

  $('checkBonus').addEventListener('change', () => {
    checkBonus = $('checkBonus').checked
    renderCheck()
  })
  $('checkRoll').addEventListener('click', startCheck)
  $('itemPlus').addEventListener('click', () => changeItem(1))
  $('itemMinus').addEventListener('click', () => changeItem(-1))
  $('itemRemove').addEventListener('click', removeItem)
  $('itemUse').addEventListener('click', useItem)
  $('invClose').addEventListener('click', closeInvPopover)
  $('invAdd').addEventListener('click', addFromInvPopover)

  $('libSearch').addEventListener('input', () => {
    libSearch = $('libSearch').value
    renderLibrary()
  })

  $('diceDone').addEventListener('click', closeDiceOverlay)
  $('diceClose').addEventListener('click', closeDiceOverlay)
  $('diceOverlay').addEventListener('click', (event) => {
    if (event.target === $('diceOverlay')) closeDiceOverlay()
  })

  for (const button of document.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal, .drawer')
      if (modal) closeModal(modal)
    })
  }

  for (const modal of document.querySelectorAll('.modal, .drawer')) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal && modal.id !== 'diceOverlay') closeModal(modal)
    })
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu') && !event.target.closest('#newBtn') && !event.target.closest('#moreBtn')) {
      closeMenus()
    }
    if (
      !$('invPopover').classList.contains('hidden') &&
      !event.target.closest('#invPopover') &&
      !event.target.closest('.slot.add')
    ) {
      closeInvPopover()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    closeMenus()
    closeInvPopover()
    if (!$('diceOverlay').classList.contains('hidden')) closeDiceOverlay()
    for (const id of ['settingsModal', 'libraryModal', 'cardsModal', 'checkModal', 'itemModal']) {
      const modal = $(id)
      if (modal && !modal.classList.contains('hidden')) {
        closeModal(modal)
        return
      }
    }
  })

  window.addEventListener('resize', fitSheet)
  window.addEventListener('pagehide', () => {
    if (isGm()) saveLocal()
  })
}

/* ------------------------------------------------------------------ */
/* Запуск                                                             */
/* ------------------------------------------------------------------ */

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return normalizeState(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Демо-лист для ?demo=1 — удобно проверять вёрстку без хоста. */
function seedDemo() {
  const card = normalizeCard({
    title: 'Ржавый меч',
    kind: 'equipment',
    art: '',
    flavor: 'Нашёл на дне высохшего колодца.',
    effect: 'Оружие героя. Один раз за бой можно перебросить кубик атаки.',
    assignedTo: []
  })
  const hero = normalizeChar({
    name: 'Костя',
    archetype: 'Воин',
    kind: 'hero',
    portrait: 'portrait-warrior.png',
    pools: { melee: 2, ranged: 0, magic: 0, armor: 2 },
    healthMax: 3,
    damage: 2,
    attack: 'Сокрушающий удар. Атака по соседней цели. Если цель сбита с ног — +1 кубик.',
    action: 'Вихрь ударов. Разделите кубики ближней атаки между несколькими соседними целями.',
    ability: 'Командная работа. Все атаки против связанных боем целей проводятся с +1 кубиком.',
    skills: ['athletics', 'perception', 'stealth'],
    items: [
      { id: 'potion', count: 2 },
      { id: 'rope', count: 1 },
      { id: 'food', count: 1 }
    ]
  })
  card.assignedTo = [hero.id]
  state = { version: 1, currentId: hero.id, chars: [hero], cards: [card] }
  writeSelect(hero.id)
}

function seedMonster() {
  const monster = normalizeChar({
    name: 'Огромная крыса',
    archetype: 'Монстр',
    kind: 'monster',
    portrait: 'portrait-rat.png',
    pools: { melee: 1, ranged: 0, magic: 0, armor: 1 },
    healthMax: 1,
    attack: 'Жуткий укус. Атака, направленная на соседнюю цель.',
    action: 'Атака стаи. Если соседняя цель связана боем, вы можете атаковать её с 1 дополнительным кубиком ближней атаки.',
    ability: 'Трус. Вы можете переместиться на 2 клетки дальше обычного, если вас атаковали с момента вашего прошлого хода.'
  })
  state = { version: 1, currentId: monster.id, chars: [monster], cards: [] }
  writeSelect(monster.id)
}

async function init() {
  bind()
  fitSheet()

  const params = new URLSearchParams(window.location.search)
  const local = loadLocal()
  if (local) {
    state = local
    ensureState()
  } else if (params.get('demo') === 'monster') {
    seedMonster()
  } else if (params.get('demo')) {
    seedDemo()
  } else {
    ensureState()
  }

  if (role === 'gm') {
    document.body.classList.add('is-gm')
  }
  ensureSelection()
  renderAll()

  if (window.parent === window) {
    setStatus('локально')
  } else {
    sayHello()
    setTimeout(sayHello, 300)
    setTimeout(sayHello, 1200)
    setTimeout(() => {
      if (!remote) setStatus('нет связи с хостом')
    }, 4000)
  }

  const panel = params.get('panel')
  if (params.get('edit') && isGm()) {
    editMode = true
    renderAll()
  }
  if (panel === 'cards') setTimeout(() => openCards(), 300)
  if (panel === 'skills') setTimeout(() => openSkillsTab(), 300)
  if (panel === 'settings') setTimeout(() => openSettings(), 300)
  if (panel === 'library') setTimeout(() => openLibrary(), 300)
  if (panel === 'check') setTimeout(() => openCheck(), 300)
  const autoRoll = params.get('roll')
  if (autoRoll && POOL_BY_ID[autoRoll]) {
    setTimeout(() => rollPool(autoRoll), 900)
  }
  const inv = params.get('inv')
  if (inv === 'item' || inv === 'skill') {
    setTimeout(() => {
      const rect = $('inventory').getBoundingClientRect()
      openInvPopover(inv, { getBoundingClientRect: () => rect })
    }, 500)
  }
  if (params.get('used')) {
    setTimeout(() => {
      const char = currentChar()
      if (!char) return
      char.potions[0] = false
      renderInventory(char)
    }, 300)
  }
}

init().catch((error) => {
  console.error('[herokids] ошибка запуска:', error)
  const status = $('status')
  if (status) status.textContent = 'ошибка загрузки'
})
















