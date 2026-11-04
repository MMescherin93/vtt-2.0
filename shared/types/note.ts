/** Видимость заметки: общая для стола или только для Мастера */
export type NoteVisibility = 'shared' | 'gm'

/** Заметка кампании (хранится в сессии) */
export interface Note {
  id: string
  title: string
  /** Markdown-текст */
  body: string
  authorId: string
  authorName: string
  visibility: NoteVisibility
  tags: string[]
  createdAt: number
  updatedAt: number
  /** Необязательная ссылка на PDF и страницу */
  pdf?: { documentId: string; page: number }
}

/** Новая заметка от клиента */
export interface NoteInput {
  title: string
  body: string
  tags: string[]
  visibility: NoteVisibility
  pdf?: { documentId: string; page: number }
}

/** Изменение заметки */
export interface NotePatch {
  noteId: string
  title?: string
  body?: string
  tags?: string[]
  visibility?: NoteVisibility
  pdf?: { documentId: string; page: number } | null
}
