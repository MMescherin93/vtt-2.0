/** PDF-документ, загруженный в библиотеку сессии */
export interface PdfDocument {
  id: string
  /** Отображаемое название (по умолчанию — имя файла без расширения) */
  title: string
  /** Исходное имя файла */
  fileName: string
  /** Путь внутри папки сессии (assets/pdf-....pdf) */
  relativePath: string
  /** Размер в байтах */
  size: number
  addedAt: number
  /** Число страниц, если уже известно клиенту */
  pages?: number
}
