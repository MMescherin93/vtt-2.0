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
  }
]

/** Может ли игрок сохранять состояние этого модуля (проверяется и на сервере) */
export function isExtensionPlayerWritable(extensionId: string): boolean {
  return BUILT_IN_EXTENSIONS.some(
    (definition) => definition.id === extensionId && definition.playerWritable === true
  )
}
