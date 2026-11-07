import { FIELDS } from './fields.js'

const STORAGE_KEY = 'agon-sheet-fields-v1'

const sheet = document.getElementById('sheet')
const fieldLayer = document.getElementById('fieldLayer')
const reset = document.getElementById('reset')

const values = loadValues()
let saveTimer = 0

function loadValues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveValues() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {
      // локальное сохранение не критично
    }
  }, 250)
}

function updateFontSize() {
  fieldLayer.style.fontSize = `${Math.max(7, Math.min(13, sheet.clientWidth / 82))}px`
}

function renderFields() {
  fieldLayer.innerHTML = ''
  updateFontSize()

  for (const field of FIELDS) {
    const element = document.createElement(field.kind === 'area' ? 'textarea' : 'input')
    element.className = `formField${field.kind === 'area' ? ' area' : ''}`
    element.dataset.name = field.name
    element.setAttribute('aria-label', field.label)
    element.style.left = `${field.x}%`
    element.style.top = `${field.y}%`
    element.style.width = `${field.w}%`
    element.style.height = `${field.h}%`

    if (field.kind === 'check') {
      element.type = 'checkbox'
      element.checked = Boolean(values[field.name])
      element.addEventListener('change', () => {
        values[field.name] = element.checked
        saveValues()
      })
    } else {
      if (field.kind === 'area') {
        element.rows = 3
        element.spellcheck = false
      } else {
        element.type = 'text'
        element.spellcheck = false
      }
      element.value = typeof values[field.name] === 'string' ? values[field.name] : ''
      element.addEventListener('input', () => {
        values[field.name] = element.value
        saveValues()
      })
    }

    fieldLayer.appendChild(element)
  }
}

reset.addEventListener('click', () => {
  if (!window.confirm('Сбросить все заполненные поля этого листа?')) return
  for (const key of Object.keys(values)) delete values[key]
  saveValues()
  renderFields()
})

new ResizeObserver(updateFontSize).observe(sheet)
window.addEventListener('resize', updateFontSize)
renderFields()
