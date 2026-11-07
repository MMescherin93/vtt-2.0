/* Поля листа «Агон». Координаты — проценты от PDF-страницы. */
const pw = 841.89
const ph = 595.28
const pct = (x, y, w, h) => ({
  x: (x / pw) * 100,
  y: (y / ph) * 100,
  w: (w / pw) * 100,
  h: (h / ph) * 100
})

const text = (name, label, x, y, w, h = 20) => ({
  name,
  label,
  kind: 'text',
  ...pct(x, y, w, h)
})
const check = (name, label, x, y, w = 7, h = 7) => ({
  name,
  label,
  kind: 'check',
  ...pct(x, y, w, h)
})

const fields = [
  text('epithet', 'Эпитет', 139.6, 84.4, 118.3, 24.7),
  text('epithetDie', 'Кубик эпитета', 284, 84.4, 20, 24.7),
  text('name', 'Имя', 139.6, 118.6, 118.3, 24.6),
  text('nameDie', 'Кубик имени', 284, 118.6, 20, 24.6),
  text('origin', 'Происхождение и пол', 139.6, 152.8, 118.3, 24.6),
  text('originDie', 'Кубик происхождения', 284, 152.8, 20, 24.6),
  text('lineage', 'Из рода', 291.6, 152.3, 96.1, 25.6),
  text('patron', 'Покровитель', 139.6, 187.0, 118.3, 24.6),
  text('patronDie', 'Кубик покровителя', 284, 187.0, 20, 24.6),
  text('ability', 'Способность', 291.6, 187.0, 96.1, 25.6),

  text('artsDie', 'Кубик Искусства и риторики', 407, 84.4, 18, 24.7),
  text('bloodDie', 'Кубик Крови и доблести', 407, 118.6, 18, 24.6),
  text('craftDie', 'Кубик Ремесла и разума', 407, 152.8, 18, 24.6),
  text('resolveDie', 'Кубик Решимости и силы духа', 407, 187.0, 18, 24.6),

  text('obligation1', 'Обязательство 1', 448.2, 95.7, 166.2, 14),
  text('obligation2', 'Обязательство 2', 448.2, 117.1, 166.2, 14),
  text('obligation3', 'Обязательство 3', 448.2, 138.5, 166.2, 14),
  text('obligation4', 'Обязательство 4', 448.2, 159.8, 166.2, 14),

  text('style1', 'Облик и особенности 1', 80, 330, 250, 14),
  text('style2', 'Облик и особенности 2', 80, 365, 250, 14),
  text('style3', 'Облик и особенности 3', 80, 400, 250, 14),
  text('style4', 'Облик и особенности 4', 80, 435, 250, 14),
  text('style5', 'Облик и особенности 5', 80, 470, 250, 14),
  text('style6', 'Облик и особенности 6', 80, 505, 250, 14),

  { name: 'story', label: 'Расскажи о своём подвиге', kind: 'area', ...pct(80, 530, 300, 50) },
  text('virtue1', 'Проницательность', 80, 565, 125, 12),
  text('virtue2', 'Храбрость', 215, 565, 125, 12),
  text('virtue3', 'Милосердие', 380, 565, 125, 12),
  text('virtue4', 'Страсть', 545, 565, 125, 12)
]

// Слава: 40 клеток в двух рядах (точные координаты из PDF)
const gloryX = [
  300.5, 315.6, 330.6, 345.7, 360.8, 378.3, 393.4, 408.0, 423.1, 438.1, 455.7,
  470.8, 485.8, 500.9, 516.0, 533.5, 548.6, 563.7, 578.8, 593.9
]
for (let row = 0; row < 2; row += 1) {
  for (let i = 0; i < gloryX.length; i += 1) {
    fields.push(check(`glory${row * 20 + i + 1}`, `Слава ${row * 20 + i + 1}`, gloryX[i], row ? 51.2 : 38.7, 6.2, 6.2))
  }
}

// Милость богов: 24 отметки, по две на каждого из 12 богов
const favorX = [143.6, 229.2, 314.9, 400.6]
const favorY = [223.7, 237.5, 257.9, 271.7, 292.1, 305.9]
let favorIndex = 0
for (const y of favorY) {
  for (const x of favorX) {
    favorIndex += 1
    fields.push(check(`favor${favorIndex}`, `Милость бога ${favorIndex}`, x, y, 6.6, 6.0))
  }
}

// Пафос / Агония / Судьба: вертикальные отметки в центральной колонке
const pathosY = [84.3, 100.4, 116.4, 132.4, 148.4]
const agonyY = [174.1]
const fateY = [199.7, 214.1, 228.5, 242.9, 257.3, 271.6, 286.0, 300.4]
pathosY.forEach((y, index) => fields.push(check(`pathos${index + 1}`, `Пафос ${index + 1}`, 427.3, y, 6.6, 6.6)))
agonyY.forEach((y, index) => fields.push(check(`agony${index + 1}`, `Агония ${index + 1}`, 427.3, y, 6.6, 6.6)))
fateY.forEach((y, index) => fields.push(check(`fate${index + 1}`, `Судьба ${index + 1}`, 427.3, y, 6.6, 6.6)))

// Подвиги и добыча: чекбоксы и строки справа
for (let i = 0; i < 13; i += 1) {
  const y = 81.7 + i * 21.3
  fields.push(check(`deed${i + 1}`, `Подвиг ${i + 1}`, 627.8, y, 7.5, 7.5))
  fields.push(text(`deedText${i + 1}`, `Подвиг или добыча ${i + 1}`, 641, y - 1, 148, 14))
}

// Награды
for (let i = 0; i < 4; i += 1) {
  fields.push(check(`reward${i + 1}`, `Награда ${i + 1}`, 632, 385.1 + i * 17.1, 5.8, 5.8))
}

export const FIELDS = fields
