/* 3D-кубики для VTT: Three.js + Cannon через dice-box-threejs (MIT). */

const DiceBox = window['dice-box-threejs']
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100]

const stage = document.getElementById('stage')
const diceRow = document.getElementById('diceRow')
const countInput = document.getElementById('count')
const rerollButton = document.getElementById('reroll')
const statusLabel = document.getElementById('status')
const resultText = document.getElementById('resultText')
const historyList = document.getElementById('history')

let box = null
let rolling = false
let lastNotation = '1d20'
const history = []

const setStatus = (text) => {
  statusLabel.textContent = text
}

const setDisabled = (disabled) => {
  for (const button of diceRow.querySelectorAll('button')) button.disabled = disabled
  rerollButton.disabled = disabled
  countInput.disabled = disabled
}

const postChat = (text) => {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ __vttExt: 'dice3d', type: 'chat', text }, '*')
    }
  } catch {
    /* не в iframe */
  }
}

/** Приводит ответ dice-box к списку значений и сумме. */
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

function renderResult(notation, values, total) {
  if (values.length === 0) {
    resultText.textContent = `${notation}: без результата`
    return
  }
  const valuesText = values.join(' + ')
  const totalText = values.length > 1 ? ` = ${total}` : ''
  resultText.textContent = `${notation}: ${valuesText}${totalText}`
}

function addHistory(notation, values, total) {
  const valuesText = values.join(' + ')
  const totalText = values.length > 1 ? ` = ${total}` : ''
  history.unshift(`${notation}: ${valuesText}${totalText}`)
  if (history.length > 6) history.length = 6

  historyList.innerHTML = ''
  for (const line of history) {
    const item = document.createElement('li')
    item.textContent = line
    historyList.appendChild(item)
  }
}

async function roll(sides) {
  if (!box || rolling) return

  const count = Math.min(10, Math.max(1, Number(countInput.value) || 1))
  countInput.value = String(count)
  const notation = `${count}d${sides}`
  lastNotation = notation

  rolling = true
  setDisabled(true)
  setStatus('бросок…')

  try {
    const results = await box.roll(notation)
    const { values, total } = summarize(results)
    renderResult(notation, values, total)
    addHistory(notation, values, total)

    if (values.length > 0) {
      const valuesText = values.join(' + ')
      const totalText = values.length > 1 ? ` = ${total}` : ''
      postChat(`🎲 3D ${notation}: ${valuesText}${totalText}`)
    }
    setStatus('готово')
  } catch (error) {
    console.error('[dice3d] ошибка броска:', error)
    setStatus('ошибка броска')
  } finally {
    rolling = false
    setDisabled(false)
  }
}

function buildButtons() {
  for (const sides of DICE_SIDES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'die-btn'
    button.textContent = `d${sides}`
    button.title = `Бросить d${sides}`
    button.addEventListener('click', () => {
      void roll(sides)
    })
    diceRow.appendChild(button)
  }
}

async function init() {
  buildButtons()

  if (!DiceBox) {
    setStatus('движок не загрузился')
    setDisabled(true)
    return
  }

  setDisabled(true)
  setStatus('загрузка 3D-стола…')

  try {
    box = new DiceBox('#stage', {
      assetPath: './assets/',
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
    await box.initialize()
    setStatus('готово')
    setDisabled(false)
  } catch (error) {
    console.error('[dice3d] не удалось инициализировать стол:', error)
    setStatus('3D недоступно')
    setDisabled(true)
    return
  }

  rerollButton.addEventListener('click', () => {
    const sides = Number(lastNotation.split('d')[1]) || 20
    void roll(sides)
  })
}

init()
