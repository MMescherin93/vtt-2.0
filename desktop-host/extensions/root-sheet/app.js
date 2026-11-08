const STORAGE_KEY = 'root-sheet-v2'
const LEGACY_KEY = 'root-sheet-v1'
const MAX_CHARS = 30
const MAX_LIST = 40

const PLAYBOOKS = [
  '— выберите архетип —',
  'Авантюрист',
  'Судья',
  'Налётчик',
  'Следопыт',
  'Ронин',
  'Поджигатель',
  'Вор',
  'Ремесленник',
  'Скиталец',
  'Герой',
  'Летописец',
  'Изгнанник',
  'Посол',
  'Еретик',
  'Пират',
  'Наследник',
  'Сказитель',
  'Разбойник',
  'Искатель'
]

/** Старые названия архетипов из первой версии листа. */
const LEGACY_PLAYBOOKS = {
  'Искатель приключений': 'Авантюрист',
  Арбитр: 'Судья',
  Задира: 'Налётчик',
  Плут: 'Поджигатель',
  Мастер: 'Ремесленник',
  Бродяга: 'Скиталец',
  Чемпион: 'Герой',
  Посланник: 'Посол',
  Принц: 'Наследник',
  Рассказчик: 'Сказитель'
}

const SPECIES = [
  '— выберите вид —',
  'Барсук',
  'Бобр',
  'Голубая сойка',
  'Кошка',
  'Лиса',
  'Ястреб',
  'Ящерица',
  'Мышь',
  'Опоссум',
  'Выдра',
  'Сова',
  'Енот',
  'Кролик',
  'Белка',
  'Волк',
  'Птица',
  'Крот',
  'Крыса'
]

const STATS = [
  { id: 'charm', label: 'Шарм' },
  { id: 'cunning', label: 'Хитрость' },
  { id: 'finesse', label: 'Сноровка' },
  { id: 'luck', label: 'Удача' },
  { id: 'might', label: 'Мощь' }
]

const REPUTATION = [
  { id: 'denizens', label: 'Обитатели' },
  { id: 'marquisate', label: 'Маркиса де Коте' },
  { id: 'eyrie', label: 'Крылатые династии' },
  { id: 'alliance', label: 'Лесной союз' }
]

const TRACKS = [
  { id: 'injury', label: 'Травмы' },
  { id: 'exhaustion', label: 'Истощение' },
  { id: 'depletion', label: 'Затраты' }
]

const LIST_TYPES = {
  moves: { name: 'Название хода', text: 'Что делает ход' },
  connections: { name: 'Имя', text: 'Связь' },
  gear: { name: 'Предмет', text: 'Метки / эффект' }
}

const $ = (id) => document.getElementById(id)

function makeId() {
  try {
    return `r_${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `r_${Math.random().toString(36).slice(2, 10)}`
  }
}

function clampNumber(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(min, Math.min(max, Math.round(number)))
}

function blankFields() {
  return {
    name: '',
    playbook: PLAYBOOKS[0],
    species: SPECIES[0],
    pronouns: '',
    look: '',
    drive: '',
    nature: '',
    stats: { charm: 0, cunning: 0, finesse: 0, luck: 0, might: 0 },
    injury: [false, false, false, false, false],
    exhaustion: [false, false, false, false, false],
    depletion: [false, false, false, false, false],
    reputation: { denizens: 0, marquisate: 0, eyrie: 0, alliance: 0 },
    moves: [],
    connections: [],
    gear: [],
    background: '',
    notes: ''
  }
}

function blankCharacter(fields) {
  return { id: makeId(), fields: normalizeFields(fields) }
}

function blankRoster() {
  const character = blankCharacter()
  return { version: 2, currentId: character.id, chars: [character] }
}

function normalizeList(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_LIST).map((item) => ({
    id: item && typeof item.id === 'string' ? item.id : makeId(),
    name: item && typeof item.name === 'string' ? item.name.slice(0, 120) : '',
    text: item && typeof item.text === 'string' ? item.text.slice(0, 1200) : ''
  }))
}

function readTrack(value) {
  if (!Array.isArray(value)) return [false, false, false, false, false]
  return Array.from({ length: 5 }, (_, index) => Boolean(value[index]))
}

function mapPlaybook(value) {
  if (typeof value !== 'string') return ''
  return LEGACY_PLAYBOOKS[value] ?? value
}

function normalizeFields(raw) {
  const base = blankFields()
  if (!raw || typeof raw !== 'object') return base

  for (const key of ['name', 'pronouns', 'look', 'drive', 'nature', 'background', 'notes']) {
    if (typeof raw[key] === 'string') {
      const limit = key === 'background' || key === 'notes' ? 6000 : 240
      base[key] = raw[key].slice(0, limit)
    }
  }

  const playbook = mapPlaybook(raw.playbook)
  if (PLAYBOOKS.includes(playbook)) base.playbook = playbook
  if (SPECIES.includes(raw.species)) base.species = raw.species

  for (const stat of STATS) {
    base.stats[stat.id] = clampNumber(raw.stats && raw.stats[stat.id], -1, 4)
  }

  // Старые листы хранили только два трека: harm (Урон) и depletion (Истощение).
  // Новый формат: injury / exhaustion / depletion (Травмы / Истощение / Затраты).
  const legacyTracks = raw.injury === undefined && raw.exhaustion === undefined
  base.injury = readTrack(legacyTracks ? raw.harm : raw.injury)
  base.exhaustion = readTrack(legacyTracks ? raw.depletion : raw.exhaustion)
  base.depletion = readTrack(legacyTracks ? undefined : raw.depletion)

  for (const rep of REPUTATION) {
    base.reputation[rep.id] = clampNumber(raw.reputation && raw.reputation[rep.id], -3, 3)
  }

  for (const kind of Object.keys(LIST_TYPES)) base[kind] = normalizeList(raw[kind])
  return base
}

function normalizeRoster(raw) {
  if (!raw || typeof raw !== 'object') return blankRoster()

  if (Array.isArray(raw.chars)) {
    const seen = new Set()
    const chars = []
    for (const item of raw.chars.slice(0, MAX_CHARS)) {
      if (!item || typeof item !== 'object') continue
      let id = typeof item.id === 'string' && item.id ? item.id.slice(0, 80) : makeId()
      while (seen.has(id)) id = makeId()
      seen.add(id)
      const fields = item.fields && typeof item.fields === 'object' ? item.fields : item
      chars.push({ id, fields: normalizeFields(fields) })
    }
    if (chars.length === 0) return blankRoster()

    let currentId = typeof raw.currentId === 'string' ? raw.currentId : ''
    if (!chars.some((character) => character.id === currentId)) currentId = chars[0].id
    return { version: 2, currentId, chars }
  }

  // Первая версия хранила один лист без списка персонажей.
  if (Object.keys(raw).length > 0) {
    const character = blankCharacter(raw)
    return { version: 2, currentId: character.id, chars: [character] }
  }

  return blankRoster()
}

let roster = blankRoster()
let state = roster.chars[0].fields
let saveTimer = 0
let remoteConnected = false
let lastSentJson = null
let dirty = false

function currentChar() {
  return roster.chars.find((character) => character.id === roster.currentId) || roster.chars[0] || null
}

function ensureRoster() {
  if (!Array.isArray(roster.chars) || roster.chars.length === 0) {
    roster = blankRoster()
  }
  if (roster.chars.length > MAX_CHARS) roster.chars = roster.chars.slice(0, MAX_CHARS)
  if (!roster.chars.some((character) => character.id === roster.currentId)) {
    roster.currentId = roster.chars[0].id
  }
}

function charLabel(character, index) {
  const name = String(character.fields.name || '').trim()
  return name || `Бродяга ${index + 1}`
}

function sendTitle() {
  if (window.parent === window) return
  const character = currentChar()
  const name = character ? String(character.fields.name || '').trim().slice(0, 80) : ''
  const title = name ? `Корни — ${name}` : 'Корни — лист персонажа'
  try {
    window.parent.postMessage({ __vttExt: 'root-sheet', type: 'title', title }, '*')
  } catch {
    // окно может быть уже закрыто
  }
}

function snapshot() {
  const character = currentChar()
  if (character) character.fields = state
  return {
    version: 2,
    currentId: roster.currentId,
    chars: roster.chars
  }
}

function loadRoster() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY)
    return raw ? normalizeRoster(JSON.parse(raw)) : blankRoster()
  } catch {
    return blankRoster()
  }
}

function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const payload = snapshot()
    let json
    try {
      json = JSON.stringify(payload)
    } catch {
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, json)
    } catch {
      // локальный резерв не критичен
    }

    if (!remoteConnected) {
      dirty = false
      $('status').textContent = 'сохранено локально'
      return
    }
    if (json === lastSentJson) {
      dirty = false
      return
    }
    lastSentJson = json
    dirty = false
    $('status').textContent = 'общее · сохраняется…'
    try {
      window.parent.postMessage({ __vttExt: 'root-sheet', type: 'setMetadata', state: payload }, '*')
    } catch {
      $('status').textContent = 'не удалось отправить'
    }
  }, 200)
}

function markChanged() {
  dirty = true
  $('status').textContent = 'есть изменения…'
  save()
}

function postChat(text) {
  try {
    window.parent.postMessage({ __vttExt: 'root-sheet', type: 'chat', text }, '*')
  } catch {
    // чат может быть недоступен
  }
}

function fillOptions() {
  $('playbook').innerHTML = PLAYBOOKS.map((value) => `<option value="${value}">${value}</option>`).join('')
  $('species').innerHTML = SPECIES.map((value) => `<option value="${value}">${value}</option>`).join('')
}

function renderCharSelect() {
  const select = $('charSelect')
  if (!select) return
  ensureRoster()
  select.innerHTML = roster.chars
    .map(
      (character, index) =>
        `<option value="${character.id}">${escapeHtml(charLabel(character, index))}</option>`
    )
    .join('')
  select.value = roster.currentId
  sendTitle()
}

function bindIdentity() {
  for (const element of document.querySelectorAll('[data-key]')) {
    element.addEventListener('input', () => {
      state[element.dataset.key] = element.value
      if (element.dataset.key === 'name') renderCharSelect()
      markChanged()
    })
  }
}

function renderIdentity() {
  for (const element of document.querySelectorAll('[data-key]')) {
    const key = element.dataset.key
    element.value = state[key] ?? ''
  }
}

function renderStats() {
  $('stats').innerHTML = STATS.map(
    (stat) => `
      <div class="stat" data-stat="${stat.id}">
        <label>${stat.label}</label>
        <input type="number" min="-1" max="4" value="${state.stats[stat.id]}" aria-label="${stat.label}">
        <button type="button" data-roll="${stat.id}">Бросок</button>
      </div>`
  ).join('')

  for (const input of $('stats').querySelectorAll('input[data-stat]')) {
    input.addEventListener('input', () => {
      const stat = input.closest('.stat').dataset.stat
      state.stats[stat] = clampNumber(input.value, -1, 4)
      input.value = state.stats[stat]
      markChanged()
    })
  }

  for (const button of $('stats').querySelectorAll('[data-roll]')) {
    button.addEventListener('click', () => rollStat(button.dataset.roll))
  }
}

function renderTracks() {
  $('tracks').innerHTML = TRACKS.map(
    (track) => `
      <div class="track">
        <h4>${track.label}</h4>
        <div class="trackBoxes">
          ${state[track.id]
            .map(
              (checked, index) =>
                `<input type="checkbox" data-track="${track.id}" data-index="${index}" ${checked ? 'checked' : ''} aria-label="${track.label} ${index + 1}">`
            )
            .join('')}
        </div>
      </div>`
  ).join('')

  for (const input of $('tracks').querySelectorAll('[data-track]')) {
    input.addEventListener('change', () => {
      state[input.dataset.track][Number(input.dataset.index)] = input.checked
      markChanged()
    })
  }
}

function renderReputation() {
  $('reputation').innerHTML = REPUTATION.map(
    (rep) => `
      <label class="repRow">
        <span>${rep.label}</span>
        <input type="number" min="-3" max="3" value="${state.reputation[rep.id]}" data-rep="${rep.id}" aria-label="Репутация: ${rep.label}">
      </label>`
  ).join('')

  for (const input of $('reputation').querySelectorAll('[data-rep]')) {
    input.addEventListener('change', () => {
      state.reputation[input.dataset.rep] = clampNumber(input.value, -3, 3)
      input.value = state.reputation[input.dataset.rep]
      markChanged()
    })
  }
}

function renderList(kind) {
  const container = $(kind)
  const meta = LIST_TYPES[kind]
  if (!container) return
  if (!state[kind].length) {
    container.innerHTML = `<div class="empty">Пока пусто. Добавьте запись.</div>`
    return
  }

  container.innerHTML = state[kind]
    .map(
      (item, index) => `
        <div class="listRow" data-index="${index}">
          <input value="${escapeHtml(item.name)}" placeholder="${meta.name}" data-list-name="${kind}">
          <textarea rows="1" placeholder="${meta.text}" data-list-text="${kind}">${escapeHtml(item.text)}</textarea>
          <button type="button" class="remove" data-remove="${kind}" title="Удалить">×</button>
        </div>`
    )
    .join('')

  for (const input of container.querySelectorAll(`[data-list-name="${kind}"]`)) {
    input.addEventListener('input', () => {
      const index = Number(input.closest('.listRow').dataset.index)
      state[kind][index].name = input.value
      markChanged()
    })
  }
  for (const input of container.querySelectorAll(`[data-list-text="${kind}"]`)) {
    input.addEventListener('input', () => {
      const index = Number(input.closest('.listRow').dataset.index)
      state[kind][index].text = input.value
      markChanged()
    })
  }
  for (const button of container.querySelectorAll(`[data-remove="${kind}"]`)) {
    button.addEventListener('click', () => {
      const index = Number(button.closest('.listRow').dataset.index)
      state[kind].splice(index, 1)
      markChanged()
      renderList(kind)
    })
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function rollStat(statId) {
  const stat = STATS.find((item) => item.id === statId)
  if (!stat) return
  const d1 = d6()
  const d2 = d6()
  const modifier = state.stats[statId] ?? 0
  const total = d1 + d2 + modifier
  const outcome = total >= 10 ? '10+' : total >= 7 ? '7–9' : '6−'
  const modifierText = modifier === 0 ? '' : modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`
  const text = `Корни · ${stat.label}: [${d1}, ${d2}]${modifierText} = ${total} — ${outcome}`
  $('lastRoll').classList.remove('hidden')
  $('lastRoll').innerHTML = `${escapeHtml(text)} <span class="outcome">${outcome}</span>`
  postChat(text)
}

function d6() {
  try {
    const buffer = new Uint8Array(1)
    crypto.getRandomValues(buffer)
    return (buffer[0] % 6) + 1
  } catch {
    return Math.floor(Math.random() * 6) + 1
  }
}

function renderAll() {
  renderIdentity()
  renderStats()
  renderTracks()
  renderReputation()
  for (const kind of Object.keys(LIST_TYPES)) renderList(kind)
}

function showCharacter(id, options = {}) {
  ensureRoster()
  roster.currentId = roster.chars.some((character) => character.id === id) ? id : roster.chars[0].id
  state = currentChar().fields
  renderAll()
  renderCharSelect()
  if (options.save !== false) save()
}

function addCharacter() {
  ensureRoster()
  if (roster.chars.length >= MAX_CHARS) return
  const character = blankCharacter()
  roster.chars.push(character)
  showCharacter(character.id)
  $('status').textContent = 'создан новый бродяга'
  window.setTimeout(() => {
    const input = document.querySelector('[data-key="name"]')
    if (input) input.focus()
  }, 60)
}

function deleteCharacter() {
  ensureRoster()
  const character = currentChar()
  if (!character) return
  const label = charLabel(character, roster.chars.indexOf(character))
  const question =
    roster.chars.length === 1
      ? `Удалить лист «${label}»? Вместо него будет создан пустой.`
      : `Удалить лист «${label}»?`
  if (!window.confirm(question)) return

  roster.chars = roster.chars.filter((item) => item.id !== character.id)
  if (roster.chars.length === 0) roster.chars.push(blankCharacter())
  showCharacter(roster.chars[0].id)
  $('status').textContent = 'лист удалён'
}

function applyRemote(raw) {
  const next = normalizeRoster(raw)
  const json = JSON.stringify(next)
  if (json === lastSentJson || json === JSON.stringify(snapshot())) return

  if (dirty) {
    const local = currentChar()
    const incoming = local ? next.chars.find((character) => character.id === local.id) : null
    if (incoming) incoming.fields = { ...incoming.fields, ...state }
  }

  // currentId уже подставлен хостом под локальный выбор клиента
  // (perClientSelection), поэтому доверяем ему.
  roster = next
  ensureRoster()
  state = currentChar().fields
  renderAll()
  renderCharSelect()
}

window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.__vttExt !== 'root-sheet') return
  if (data.type === 'metadata') {
    remoteConnected = true
    if (data.state !== null && data.state !== undefined) applyRemote(data.state)
    $('status').textContent = 'общее · сохранено'
  }
})

try {
  window.parent.postMessage({ __vttExt: 'root-sheet', type: 'hello' }, '*')
} catch {
  // автономный режим
}

fillOptions()
bindIdentity()
roster = loadRoster()
ensureRoster()
state = currentChar().fields
renderAll()
renderCharSelect()
window.setTimeout(sendTitle, 400)

for (const button of document.querySelectorAll('[data-add]')) {
  button.addEventListener('click', () => {
    const kind = button.dataset.add
    if (!state[kind] || state[kind].length >= MAX_LIST) return
    state[kind].push({ id: makeId(), name: '', text: '' })
    markChanged()
    renderList(kind)
  })
}

$('charSelect').addEventListener('change', () => showCharacter($('charSelect').value))
$('newChar').addEventListener('click', addCharacter)
$('deleteChar').addEventListener('click', deleteCharacter)

$('reset').addEventListener('click', () => {
  if (!window.confirm('Сбросить поля текущего листа?')) return
  const character = currentChar()
  if (!character) return
  state = blankFields()
  character.fields = state
  lastSentJson = null
  renderAll()
  renderCharSelect()
  save()
  $('lastRoll').classList.add('hidden')
  $('status').textContent = 'лист сброшен'
})

window.addEventListener('pagehide', () => {
  if (dirty) save()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && dirty) save()
})
