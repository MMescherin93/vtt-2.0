import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url
).href

const SHEETS = [
  { id: 'empty', label: 'Пустой бланк команды', file: 'pdfs/empty.pdf' },
  { id: 'adepts', label: 'Адепты', file: 'pdfs/adepts.pdf' },
  { id: 'bravos', label: 'Бандиты', file: 'pdfs/bravos.pdf' },
  { id: 'hawkers', label: 'Барыги', file: 'pdfs/hawkers.pdf' },
  { id: 'assassins', label: 'Душегубы', file: 'pdfs/assassins.pdf' },
  { id: 'transporters', label: 'Перевозчики', file: 'pdfs/transporters.pdf' },
  { id: 'shadows', label: 'Тени', file: 'pdfs/shadows.pdf' }
]

const STORAGE_KEY = 'bitd-crews-selected'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

const select = document.getElementById('sheetSelect')
const viewer = document.getElementById('viewer')
const canvas = document.getElementById('pdfCanvas')
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

function setError(message) {
  error.textContent = message
  error.classList.toggle('hidden', !message)
}

function selectedSheet() {
  return SHEETS.find((sheet) => sheet.id === select.value) ?? SHEETS[0]
}

function updateControls() {
  const pages = doc?.numPages ?? 0
  pageLabel.textContent = `${pageNumber} / ${pages || 1}`
  prev.disabled = pageNumber <= 1
  next.disabled = !pages || pageNumber >= pages
  zoomLabel.textContent = fitWidth ? 'по ширине' : `${Math.round(scale * 100)}%`
  fitButton.classList.toggle('active', fitWidth)
  const index = SHEETS.indexOf(selectedSheet()) + 1
  status.textContent = `PDF · ${index} из ${SHEETS.length}`
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
    renderTask = page.render({ canvas, viewport })
    await renderTask.promise
    if (token === renderToken) setError('')
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
    const task = pdfjs.getDocument({ url: selectedSheet().file })
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
  } catch {
    if (token === loadToken) {
      doc = null
      setError('Не удалось открыть PDF. Проверьте, что файл доступен.')
      updateControls()
    }
  }
}

for (const sheet of SHEETS) {
  const option = document.createElement('option')
  option.value = sheet.id
  option.textContent = sheet.label
  select.appendChild(option)
}

let initial = SHEETS[0].id
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && SHEETS.some((sheet) => sheet.id === saved)) initial = saved
} catch {
  // ignore
}
select.value = initial

select.addEventListener('change', () => {
  try {
    localStorage.setItem(STORAGE_KEY, select.value)
  } catch {
    // ignore
  }
  void load()
})

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
