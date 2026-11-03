/** Токен существа/объекта на карте */
export interface Token {
  id: string
  /** Отображаемое имя (видно GM и игрокам, если токен не скрыт) */
  name: string
  /** Путь к изображению относительно папки сессии */
  imageUrl: string
  /** Координаты центра токена в пикселях карты */
  x: number
  y: number
  /** Размеры в пикселях карты */
  width: number
  height: number
  /** Поворот в градусах */
  rotation: number
  /** GM-only: скрыт от игроков (ТЗ, п.3) */
  hidden: boolean
  /** Запрет перемещения (по умолчанию false — двигать может любой участник) */
  locked: boolean
}
