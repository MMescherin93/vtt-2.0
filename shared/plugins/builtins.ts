import type { ExtensionCategory, ExtensionDefinition } from './types'

/** Разделы каталога расширений (порядок отображения) */
export const EXTENSION_CATEGORIES: ExtensionCategory[] = [
  {
    id: 'basic',
    title: 'Базовые',
    description: 'Общие инструменты стола: кубики, чат, рисование, карта'
  },
  {
    id: 'troika',
    title: 'Тройка!',
    description: 'Модули для системы «Тройка!»: инициатива и листы персонажей'
  },
  {
    id: 'azag',
    title: 'AZAG',
    description: 'Модули для игры AZAG (Dank Dungeons)'
  },
  {
    id: 'forbidden-lands',
    title: 'Запретные земли',
    description: 'Модули для Forbidden Lands: лист персонажа и кубы'
  },
  {
    id: 'agon',
    title: 'Агон',
    description: 'Модули для системы «Агон»: лист героя, состязания и битвы'
  },
  {
    id: 'root',
    title: 'Корни',
    description: 'Модули для Root: The Roleplaying Game — листы бродяг, броски и ходы'
  },
  {
    id: 'library',
    title: 'Библиотека',
    description: 'PDF-документы, заметки и материалы кампании'
  }
]

/**
 * Встроенные расширения v1.0.
 * Новые модули добавляются сюда и в соответствующие точки интеграции
 * (тулбар, панель, слой карты) — без ветвлений в ядре.
 */
export const BUILT_IN_EXTENSIONS: ExtensionDefinition[] = [
  {
    id: 'dice',
    title: 'Кубики',
    description: 'Броски d4–d100, история и результат в чате',
    scope: 'both',
    defaultEnabled: true,
    category: 'basic'
  },
  {
    id: 'chat',
    title: 'Чат',
    description: 'Общий чат стола с именами отправителей и временем',
    scope: 'both',
    defaultEnabled: true,
    category: 'basic'
  },
  {
    id: 'drawing',
    title: 'Рисование',
    description: 'Карандаш и ластик: цвет, толщина, общая доска',
    scope: 'both',
    defaultEnabled: true,
    category: 'basic'
  },
  {
    id: 'fog',
    title: 'Туман войны',
    description: 'Кисть, ластик и область — управляет только Мастер',
    scope: 'gm',
    defaultEnabled: true,
    category: 'basic'
  },
  {
    id: 'token-labels',
    title: 'Подписи токенов',
    description: 'Показывать имена токенов на карте всем участникам',
    scope: 'both',
    defaultEnabled: true,
    category: 'basic'
  },
  {
    id: 'dice3d',
    title: '3D-кубики',
    description: 'Физические d4–d100 на 3D-столе: бросайте кубики, результат уходит в общий чат',
    scope: 'both',
    defaultEnabled: false,
    category: 'basic',
    icon: '/extensions/dice3d/icon.svg',
    panel: true
  },
  {
    id: 'token-stats',
    title: 'HP/AC и состояния',
    description:
      'Полосы здоровья, класс брони и маркеры состояний над токенами; настройка видимости для игроков',
    scope: 'gm',
    defaultEnabled: false,
    category: 'basic',
    icon: '/extensions/icons/token-stats.svg',
    panel: true
  },
  {
    id: 'initiative',
    title: 'Инициатива',
    description: 'Универсальный трекер боя: порядок ходов, раунды, HP и состояния',
    scope: 'both',
    defaultEnabled: false,
    category: 'basic',
    icon: '/extensions/icons/initiative.svg',
    panel: true
  },
  {
    id: 'pdf-viewer',
    title: 'PDF-библиотека',
    description: 'PDF-документы кампании: загрузка Мастером, просмотр у всех участников',
    scope: 'both',
    defaultEnabled: false,
    category: 'library',
    icon: '/extensions/icons/pdf.svg',
    panel: true
  },
  {
    id: 'notes',
    title: 'Заметки',
    description: 'Общий журнал кампании, заметки Мастера и личные заметки',
    scope: 'both',
    defaultEnabled: false,
    category: 'library',
    icon: '/extensions/icons/notes.svg',
    panel: true
  },
  {
    id: 'forbidden-lands-sheet',
    title: 'Лист «Запретные земли»',
    description:
      'Лист персонажа Forbidden Lands: характеристики, навыки, бой, снаряжение, отношения',
    scope: 'both',
    defaultEnabled: false,
    category: 'forbidden-lands',
    icon: '/extensions/forbidden-lands-sheet/icon.svg',
    panel: true,
    metaKey: 'com.forbiddenlands.sheet/state'
  },
  {
    id: 'fl-dice',
    title: 'Кубы «Запретных земель»',
    description: 'Пул белых, красных и чёрных d6, успехи и баны, толчок с последствиями',
    scope: 'both',
    defaultEnabled: false,
    category: 'forbidden-lands',
    icon: '/extensions/icons/fl-dice.svg',
    panel: true
  },
  {
    id: 'agon-sheet',
    title: 'Агон — лист героя',
    description:
      'Листы героев «Агона»: несколько персонажей, Домены, Слава, Пафос, Судьба, Милость богов и портрет. Любой участник может менять листы',
    scope: 'both',
    defaultEnabled: false,
    category: 'agon',
    icon: '/extensions/agon-sheet/icon.svg',
    panel: true,
    playerWritable: true,
    metaKey: 'com.agon.sheet/state'
  },
  {
    id: 'root-sheet',
    title: 'Корни — лист персонажа',
    description:
      'Листы бродяг Root RPG: архетип, Шарм/Хитрость/Сноровка/Удача/Мощь, Травмы, Истощение, Затраты, Репутация, ходы, связи и снаряжение. Любой участник может создать свой лист',
    scope: 'both',
    defaultEnabled: false,
    category: 'root',
    icon: '/extensions/root-sheet/icon.svg',
    panel: true,
    playerWritable: true,
    metaKey: 'com.root.sheet/state'
  },
  {
    id: 'root-roll',
    title: 'Корни — броски',
    description: 'PbtA-броски Root: 2d6 + характеристика, 10+ / 7–9 / 6−, преимущество и помеха',
    scope: 'both',
    defaultEnabled: false,
    category: 'root',
    icon: '/extensions/icons/root-roll.svg',
    panel: true
  },
  {
    id: 'root-moves',
    title: 'Корни — ходы',
    description:
      'Библиотека ходов Root: базовые, оружейные, дорожные, сессионные, репутационные и ходы плейбуков',
    scope: 'both',
    defaultEnabled: false,
    category: 'root',
    icon: '/extensions/icons/root-moves.svg',
    panel: true,
    playerWritable: true
  },
  {
    id: 'troika-initiative',
    title: 'Инициатива «Тройка»',
    description:
      'Стек инициативы по правилам «Тройки!»: жетоны, раунды, отсрочка и прицеливание. Состояние общее для стола',
    scope: 'both',
    defaultEnabled: false,
    category: 'troika',
    icon: '/extensions/troika-initiative/icon.svg',
    panel: true,
    metaKey: 'com.troika.initiative/state'
  },
  {
    id: 'troika-sheet',
    title: 'Лист персонажа «Тройка»',
    description:
      'Редактируемый лист персонажа по правилам «Тройки!». Любой участник может менять листы, состояние общее',
    scope: 'both',
    defaultEnabled: false,
    category: 'troika',
    icon: '/extensions/troika-sheet/icon.svg',
    panel: true,
    playerWritable: true,
    metaKey: 'com.troika.sheet/state'
  },
  {
    id: 'troika-token-stats',
    title: 'Тройка! Трекер состояний',
    description:
      'Панель Мастера для токена: умение, инициатива, выносливость, удача, особенности и все состояния',
    scope: 'gm',
    defaultEnabled: false,
    category: 'troika',
    icon: '/extensions/icons/troika-stats.svg',
    panel: true
  },
  {
    id: 'azag-sheet',
    title: 'Лист персонажа AZAG',
    description:
      'Редактируемый лист персонажа AZAG: оружие, броня, навыки, магические и обычные предметы. Любой участник может менять листы',
    scope: 'both',
    defaultEnabled: false,
    category: 'azag',
    icon: '/extensions/azag-sheet/icon.png',
    panel: true,
    playerWritable: true,
    metaKey: 'com.azag.sheet/state'
  }
]

/** Может ли игрок сохранять состояние этого модуля (проверяется и на сервере) */
export function isExtensionPlayerWritable(extensionId: string): boolean {
  return BUILT_IN_EXTENSIONS.some(
    (definition) => definition.id === extensionId && definition.playerWritable === true
  )
}
