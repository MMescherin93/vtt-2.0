import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs'
import { FIELDS, PAGE_HEIGHT, PAGE_WIDTH } from './fields.js'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url
).href

const PDF_FILE = 'pdfs/empty.pdf'
const STORAGE_KEY = 'bitd-sheets-fields-v1'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

const viewer = document.getElementById('viewer')
const canvas = document.getElementById('pdfCanvas')
const pageWrap = document.getElementById('pageWrap')
const fieldLayer = document.getElementById('fieldLayer')
const pageLabel = document.getElementById('pageLabel')
const zoomLabel = document.getElementById('zoomLabel')
const status = document.getElementById('status')
const error = document.getElementById('error')
const prev = document.getElementById('prevPage')
const next = document.getElementById('nextPage')
const zoomOut = document.getElementById('zoomOut')
const zoomIn = document.getElementById('zoomIn')
const fitButton = document.getElementById('fitWidth')

let doc = null
let pageNumber = 1
let scale = 1
let fitWidth = true
let loadToken = 0
let renderToken = 0
let renderTask = null
let saveTimer = 0

const values = loadValues()

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

function setError(message) {
  error.textContent = message
  error.classList.toggle('hidden', !message)
}

function updateControls() {
  const pages = doc?.numPages ?? 0
  pageLabel.textContent = `${pageNumber} / ${pages || 1}`
  prev.disabled = pageNumber <= 1
  next.disabled = !pages || pageNumber >= pages
  if (zoomLabel) zoomLabel.textContent = fitWidth ? 'по ширине' : `${Math.round(scale * 100)}%`
  fitButton.classList.toggle('active', fitWidth)
  status.textContent = 'PDF · пустой бланк'
}

function renderFields() {
  fieldLayer.innerHTML = ''
  const pageFields = FIELDS.filter((field) => field.page === pageNumber - 1)
  if (!pageFields.length) return

  const pixelScale = Math.max(0.2, canvas.clientWidth / PAGE_WIDTH)
  fieldLayer.style.fontSize = `${Math.max(7, Math.min(15, pixelScale * 10))}px`

  for (const field of pageFields) {
    const input = document.createElement('input')
    input.dataset.name = field.name
    input.className = 'formField'
    input.style.left = `${(field.x / PAGE_WIDTH) * 100}%`
    input.style.top = `${(field.y / PAGE_HEIGHT) * 100}%`
    input.style.width = `${(field.w / PAGE_WIDTH) * 100}%`
    input.style.height = `${(field.h / PAGE_HEIGHT) * 100}%`

    if (field.kind === 'check') {
      input.type = 'checkbox'
      input.checked = Boolean(values[field.name])
      input.addEventListener('change', () => {
        values[field.name] = input.checked
        saveValues()
      })
    } else {
      input.type = 'text'
      input.value = typeof values[field.name] === 'string' ? values[field.name] : ''
      input.spellcheck = false
      input.addEventListener('input', () => {
        values[field.name] = input.value
        saveValues()
      })
    }

    fieldLayer.appendChild(input)
  }
}

async function render() {
  const token = ++renderToken
  renderTask?.cancel()
  renderTask = null
  if (!doc) return

  try {
    const page = await doc.getPage(pageNumber)
    if (token !== renderToken) return
    const base = page.getViewport({ scale: 1 })
    const targetWidth = Math.max(240, viewer.clientWidth - 28)
    const fitted = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetWidth / base.width))
    const nextScale = fitWidth ? fitted : scale
    const dpr = window.devicePixelRatio || 1
    const viewport = page.getViewport({ scale: nextScale * dpr })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
    pageWrap.style.width = canvas.style.width
    pageWrap.style.height = canvas.style.height
    renderTask = page.render({ canvas, viewport })
    await renderTask.promise
    if (token === renderToken) {
      setError('')
      renderFields()
    }
  } catch (reason) {
    if ((reason && reason.name) === 'RenderingCancelledException') return
    if (token === renderToken) setError('Не удалось отобразить PDF')
  } finally {
    if (token === renderToken) updateControls()
  }
}

async function load() {
  const token = ++loadToken
  renderTask?.cancel()
  renderTask = null
  setError('')
  try {
    if (doc) {
      await doc.destroy()
      doc = null
    }
    const task = pdfjs.getDocument({ url: PDF_FILE })
    const loaded = await task.promise
    if (token !== loadToken) {
      await loaded.destroy()
      return
    }
    doc = loaded
    pageNumber = 1
    fitWidth = true
    scale = 1
    updateControls()
    await render()
  } catch (reason) {
    if (token === loadToken) {
      console.error('[bitd-pdf]', reason)
      doc = null
      setError('Не удалось открыть PDF. Проверьте, что файл доступен.')
      updateControls()
    }
  }
}

prev.addEventListener('click', () => {
  if (!doc || pageNumber <= 1) return
  pageNumber -= 1
  updateControls()
  void render()
})

next.addEventListener('click', () => {
  if (!doc || pageNumber >= doc.numPages) return
  pageNumber += 1
  updateControls()
  void render()
})

zoomOut.addEventListener('click', () => {
  fitWidth = false
  scale = Math.max(MIN_ZOOM, scale / 1.2)
  void render()
})

zoomIn.addEventListener('click', () => {
  fitWidth = false
  scale = Math.min(MAX_ZOOM, scale * 1.2)
  void render()
})

fitButton.addEventListener('click', () => {
  fitWidth = true
  void render()
})

let resizeTimer = 0
window.addEventListener('resize', () => {
  if (!fitWidth) return
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => void render(), 120)
})

void load()
