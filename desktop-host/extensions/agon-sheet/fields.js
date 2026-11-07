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
const check = (name, label, x, y, w = 6.6, h = 6.6) => ({
  name,
  label,
  kind: 'check',
  ...pct(x, y, w, h)
})
const line = (name, label, x, y, w) => text(name, label, x, y - 13, w, 12)

const fields = [
  text('epithet', 'Эпитет', 139.6, 84.4, 118.3, 24.7),
  text('epithetDie', 'Кубик', 282.5, 84.4, 9, 24.6),
  text('name', 'Имя', 139.6, 118.6, 118.3, 24.6),
  text('nameDie', 'Кубик', 282.5, 118.6, 9, 24.6),
  text('origin', 'Происхождение и пол', 139.6, 152.8, 118.3, 24.6),
  text('originDie', 'Кубик', 282.5, 152.8, 9, 24.6),
  text('patron', 'Покровитель', 139.6, 187.0, 118.3, 24.6),
  text('patronDie', 'Кубик', 282.5, 187.0, 9, 24.6),

  text('artsDie', 'Кубик Искусства и риторики', 407, 84.4, 18, 24.7),
  text('bloodDie', 'Кубик Крови и доблести', 407, 118.6, 18, 24.6),
  text('craftDie', 'Кубик Ремесла и разума', 407, 152.8, 18, 24.6),
  text('resolveDie', 'Кубик Решимости и силы духа', 407, 187.0, 18, 24.6),

  // «Обязательства» — восемь линий из PDF
  line('obligation1', 'Обязательство 1', 447.7, 95.7, 166.7),
  line('obligation2', 'Обязательство 2', 447.7, 117.1, 166.7),
  line('obligation3', 'Обязательство 3', 447.7, 138.5, 166.7),
  line('obligation4', 'Обязательство 4', 447.7, 159.8, 166.7),
  line('obligation5', 'Обязательство 5', 447.7, 181.2, 166.7),
  line('obligation6', 'Обязательство 6', 447.7, 202.6, 166.7),
  line('obligation7', 'Обязательство 7', 447.7, 224.0, 166.7),
  line('obligation8', 'Обязательство 8', 447.7, 245.3, 166.7),

  // «Облик и особенности» — четыре линии из PDF
  line('style1', 'Облик и особенности 1', 69.3, 336.7, 335.0),
  line('style2', 'Облик и особенности 2', 69.3, 357.1, 335.0),
  line('style3', 'Облик и особенности 3', 69.3, 378.5, 335.0),
  line('style4', 'Облик и особенности 4', 69.3, 399.8, 335.0),

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

// Пафос / Агония / Судьба
const pathosY = [84.3, 100.4, 116.4, 132.4, 148.4]
const agonyY = [174.1]
const fateY = [199.7, 214.1, 228.5, 242.9, 257.3, 271.6, 286.0, 300.4, 314.8, 329.2, 343.5, 357.9]
pathosY.forEach((y, index) => fields.push(check(`pathos${index + 1}`, `Пафос ${index + 1}`, 427.3, y, 6.6, 6.6)))
agonyY.forEach((y, index) => fields.push(check(`agony${index + 1}`, `Агония ${index + 1}`, 427.3, y, 6.6, 6.6)))
fateY.forEach((y, index) => fields.push(check(`fate${index + 1}`, `Судьба ${index + 1}`, 427.3, y, 6.6, 6.6)))

// Подвиги и добыча: 12 линий и 13 клеток из PDF
const deedY = [
  81.7, 103.0, 124.3, 145.6, 166.9, 188.2, 209.6, 230.9, 252.7, 274.0, 295.3,
  316.6, 338.0
]
deedY.forEach((y, index) => {
  fields.push(check(`deed${index + 1}`, `Подвиг ${index + 1}`, 627.8, y, 7.5, 7.5))
  if (index < 12) {
    fields.push(line(`deedText${index + 1}`, `Подвиг или добыча ${index + 1}`, 623.0, 95.7 + index * 21.4, 166.7))
  }
})

// Награды
const rewardY = [385.1, 402.2, 419.3, 449.1]
rewardY.forEach((y, index) => fields.push(check(`reward${index + 1}`, `Награда ${index + 1}`, 632, y, 5.8, 5.8)))

export const FIELDS = fields
