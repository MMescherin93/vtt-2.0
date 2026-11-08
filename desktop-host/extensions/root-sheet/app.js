const STORAGE_KEY = 'root-sheet-v1'
const MAX_LIST = 40

const PLAYBOOKS = [
  '— выберите плейбук —',
  'Искатель приключений',
  'Арбитр',
  'Задира',
  'Следопыт',
  'Ронин',
  'Плут',
  'Вор',
  'Мастер',
  'Бродяга',
  'Чемпион',
  'Летописец',
  'Посланник',
  'Изгнанник',
  'Еретик',
  'Пират',
  'Принц',
  'Рассказчик',
  'Налётчик',
  'Искатель'
]

const SPECIES = [
  '— выберите вид —',
  'Птица',
  'Кошка',
  'Лиса',
  'Ящерица',
  'Крот',
  'Мышь',
  'Выдра',
  'Кролик',
  'Енот',
  'Крыса',
  'Белка',
  'Волк'
]

const STATS = [
  { id: 'charm', label: 'Обаяние' },
  { id: 'cunning', label: 'Хитрость' },
  { id: 'finesse', label: 'Ловкость' },
  { id: 'luck', label: 'Удача' },
  { id: 'might', label: 'Мощь' }
]

const REPUTATION = [
  { id: 'marquisate', label: 'Маркиза де Кот' },
  { id: 'eyrie', label: 'Династии Скопа' },
  { id: 'alliance', label: 'Лесной союз' }
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

function blankState() {
  return {
    name: '',
    playbook: PLAYBOOKS[0],
    species: SPECIES[0],
    pronouns: '',
    look: '',
    drive: '',
    nature: '',
    stats: { charm: 0, cunning: 0, finesse: 0, luck: 0, might: 0 },
    harm: [false, false, false, false],
    depletion: [false, false, false, false],
    reputation: { marquisate: 0, eyrie: 0, alliance: 0 },
    moves: [],
    connections: [],
    gear: [],
    background: '',
    notes: ''
  }
}

function normalizeList(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_LIST).map((item) => ({
    id: item && typeof item.id === 'string' ? item.id : makeId(),
    name: item && typeof item.name === 'string' ? item.name.slice(0, 120) : '',
    text: item && typeof item.text === 'string' ? item.text.slice(0, 1200) : ''
  }))
}

function normalize(raw) {
  const base = blankState()
  if (!raw || typeof raw !== 'object') return base
  const next = { ...base }
  for (const key of ['name', 'pronouns', 'look', 'drive', 'nature', 'background', 'notes']) {
    if (typeof raw[key] === 'string') next[key] = raw[key].slice(0, key === 'background' || key === 'notes' ? 6000 : 240)
  }
  if (PLAYBOOKS.includes(raw.playbook)) next.playbook = raw.playbook
  if (SPECIES.includes(raw.species)) next.species = raw.species
  for (const stat of STATS) {
    next.stats[stat.id] = clampNumber(raw.stats && raw.stats[stat.id], -1, 4)
  }
  for (const key of ['harm', 'depletion']) {
    next[key] = Array.from({ length: 4 }, (_, index) => Boolean(raw[key] && raw[key][index]))
  }
  for (const rep of REPUTATION) {
    next.reputation[rep.id] = clampNumber(raw.reputation && raw.reputation[rep.id], -3, 3)
  }
  for (const kind of Object.keys(LIST_TYPES)) next[kind] = normalizeList(raw[kind])
  return next
}

let state = blankState()
let saveTimer = 0
let remoteConnected = false
let lastSentJson = null
let applyingRemote = false

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : blankState()
  } catch {
    return blankState()
  }
}

function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const json = JSON.stringify(state)
    try {
      localStorage.setItem(STORAGE_KEY, json)
    } catch {
      // локальный резерв не критичен
    }
    if (!remoteConnected) {
      $('status').textContent = 'сохранено локально'
      return
    }
    if (json === lastSentJson) return
    lastSentJson = json
    $('status').textContent = 'общее · сохраняется…'
    try {
      window.parent.postMessage({ __vttExt: 'root-sheet', type: 'setMetadata', state }, '*')
    } catch {
      $('status').textContent = 'не удалось отправить'
    }
  }, 200)
}

function markChanged() {
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

function bindIdentity() {
  for (const element of document.querySelectorAll('[data-key]')) {
    element.addEventListener('input', () => {
      state[element.dataset.key] = element.value
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
  const labels = { harm: 'Урон', depletion: 'Истощение' }
  $('tracks').innerHTML = Object.entries(labels)
    .map(
      ([key, label]) => `
        <div class="track">
          <h4>${label}</h4>
          <div class="trackBoxes">
            ${state[key]
              .map(
                (checked, index) =>
                  `<input type="checkbox" data-track="${key}" data-index="${index}" ${checked ? 'checked' : ''} aria-label="${label} ${index + 1}">`
              )
              .join('')}
          </div>
        </div>`
    )
    .join('')

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
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  const modifier = state.stats[statId] ?? 0
  const total = d1 + d2 + modifier
  const outcome = total >= 10 ? '10+' : total >= 7 ? '7–9' : '6−'
  const modifierText = modifier === 0 ? '' : modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`
  const text = `Корни · ${stat.label}: [${d1}, ${d2}]${modifierText} = ${total} — ${outcome}`
  $('lastRoll').classList.remove('hidden')
  $('lastRoll').innerHTML = `${escapeHtml(text)} <span class="outcome">${outcome}</span>`
  postChat(text)
}

function renderAll() {
  renderIdentity()
  renderStats()
  renderTracks()
  renderReputation()
  for (const kind of Object.keys(LIST_TYPES)) renderList(kind)
}

function applyRemote(raw) {
  const next = normalize(raw)
  const json = JSON.stringify(next)
  if (json === lastSentJson || json === JSON.stringify(state)) return
  applyingRemote = true
  state = next
  renderAll()
  applyingRemote = false
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
state = load()
renderAll()

for (const button of document.querySelectorAll('[data-add]')) {
  button.addEventListener('click', () => {
    const kind = button.dataset.add
    if (!state[kind] || state[kind].length >= MAX_LIST) return
    state[kind].push({ id: makeId(), name: '', text: '' })
    markChanged()
    renderList(kind)
  })
}

$('reset').addEventListener('click', () => {
  if (!window.confirm('Сбросить лист персонажа?')) return
  state = blankState()
  lastSentJson = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  renderAll()
  save()
  $('lastRoll').classList.add('hidden')
  $('status').textContent = 'лист сброшен'
})
