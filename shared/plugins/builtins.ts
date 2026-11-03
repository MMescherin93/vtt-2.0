import type { ExtensionDefinition } from './types'

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
    defaultEnabled: true
  },
  {
    id: 'chat',
    title: 'Чат',
    description: 'Общий чат стола с именами отправителей и временем',
    scope: 'both',
    defaultEnabled: true
  },
  {
    id: 'drawing',
    title: 'Рисование',
    description: 'Карандаш и ластик: цвет, толщина, общая доска',
    scope: 'both',
    defaultEnabled: true
  },
  {
    id: 'fog',
    title: 'Туман войны',
    description: 'Кисть, ластик и область — управляет только Мастер',
    scope: 'gm',
    defaultEnabled: true
  },
  {
    id: 'token-labels',
    title: 'Подписи токенов',
    description: 'Показывать имена токенов на карте всем участникам',
    scope: 'both',
    defaultEnabled: true
  },
  {
    id: 'troika-initiative',
    title: 'Инициатива «Тройка»',
    description:
      'Стек инициативы по правилам «Тройки!»: жетоны, раунды, отсрочка и прицеливание. Состояние общее для стола',
    scope: 'both',
    defaultEnabled: false
  }
]
