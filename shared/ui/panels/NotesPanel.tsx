import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { Note, NoteInput, NotePatch } from '../../types/note'
import { FloatingPanel } from '../FloatingPanel'
import { PlusIcon, TrashIcon } from '../icons'

type NotesView = 'shared' | 'gm' | 'local'

interface LocalNote {
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: number
}

interface Draft {
  id: string | null
  local: boolean
  title: string
  body: string
  tags: string
  visibility: 'shared' | 'gm'
}

export interface NotesPanelProps {
  sessionId: string
  role: 'gm' | 'player'
  ownerKey: string
  notes: Note[]
  onAdd: (note: NoteInput) => Promise<void> | void
  onUpdate: (patch: NotePatch) => Promise<void> | void
  onRemove: (noteId: string) => Promise<void> | void
  onClose: () => void
  storageKey: string
}

function localKey(sessionId: string, ownerKey: string): string {
  return `vtt.notes.${sessionId}.${ownerKey}`
}

function loadLocal(sessionId: string, ownerKey: string): LocalNote[] {
  try {
    const raw = localStorage.getItem(localKey(sessionId, ownerKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is LocalNote =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as LocalNote).id === 'string' &&
        typeof (item as LocalNote).title === 'string'
    )
  } catch {
    return []
  }
}

function showDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    })
  } catch {
    return ''
  }
}

function markdownHtml(body: string): string {
  const html = marked.parse(body, { async: false }) as string
  return DOMPurify.sanitize(html)
}

function draftFromNote(note: Note): Draft {
  return {
    id: note.id,
    local: false,
    title: note.title,
    body: note.body,
    tags: note.tags.join(', '),
    visibility: note.visibility
  }
}

function draftFromLocal(note: LocalNote): Draft {
  return {
    id: note.id,
    local: true,
    title: note.title,
    body: note.body,
    tags: note.tags.join(', '),
    visibility: 'shared'
  }
}

/** Заметки кампании: общий журнал, заметки Мастера и локальные «Мои» */
export function NotesPanel({
  sessionId,
  role,
  ownerKey,
  notes,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
  storageKey
}: NotesPanelProps) {
  const [view, setView] = useState<NotesView>('shared')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState(false)
  const [localNotes, setLocalNotes] = useState<LocalNote[]>(() => loadLocal(sessionId, ownerKey))
  const draftRef = useRef<Draft | null>(null)
  const pendingRef = useRef<NotePatch | null>(null)
  const pendingNewRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onUpdateRef = useRef(onUpdate)
  const onRemoveRef = useRef(onRemove)
  onUpdateRef.current = onUpdate
  onRemoveRef.current = onRemove

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    setLocalNotes(loadLocal(sessionId, ownerKey))
  }, [sessionId, ownerKey])

  useEffect(() => {
    try {
      localStorage.setItem(localKey(sessionId, ownerKey), JSON.stringify(localNotes))
    } catch {
      // localStorage может быть недоступен
    }
  }, [localNotes, sessionId, ownerKey])

  const flush = useCallback(async (): Promise<void> => {
    const patch = pendingRef.current
    if (!patch) return
    pendingRef.current = null
    try {
      await onUpdateRef.current(patch)
    } catch {
      // ошибку покажет сервер/следующая попытка
    }
  }, [])

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void flush()
    },
    [flush]
  )

  const scheduleSave = (next: Draft): void => {
    if (!next.id || next.local) return
    pendingRef.current = {
      noteId: next.id,
      title: next.title,
      body: next.body,
      tags: next.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      visibility: next.visibility
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flush(), 650)
  }

  const applyDraft = (patch: Partial<Draft>): void => {
    const current = draftRef.current
    if (!current) return
    const next = { ...current, ...patch }
    draftRef.current = next
    setDraft(next)
    if (next.local && next.id) {
      setLocalNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === next.id
            ? {
                ...note,
                title: next.title,
                body: next.body,
                tags: next.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                updatedAt: Date.now()
              }
            : note
        )
      )
    } else if (next.id) {
      scheduleSave(next)
    }
  }

  const sharedNotes = useMemo(() => notes.filter((note) => note.visibility === 'shared'), [notes])
  const gmNotes = useMemo(() => notes.filter((note) => note.visibility === 'gm'), [notes])
  const currentNotes = view === 'gm' ? gmNotes : view === 'local' ? localNotes : sharedNotes
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return currentNotes
    return currentNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        ('body' in note && note.body.toLowerCase().includes(query)) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [currentNotes, search])

  useEffect(() => {
    if (pendingNewRef.current && view !== 'local') {
      const last = currentNotes[currentNotes.length - 1]
      if (last) {
        pendingNewRef.current = false
        setSelectedId(last.id)
        const next = draftFromNote(last as Note)
        draftRef.current = next
        setDraft(next)
        return
      }
    }
    if (selectedId && currentNotes.some((note) => note.id === selectedId)) return
    const first = currentNotes[0]
    if (!first) {
      setSelectedId(null)
      setDraft(null)
      draftRef.current = null
      return
    }
    setSelectedId(first.id)
    const next =
      view === 'local' ? draftFromLocal(first as LocalNote) : draftFromNote(first as Note)
    draftRef.current = next
    setDraft(next)
  }, [currentNotes, selectedId, view])

  const selectNote = (id: string): void => {
    if (selectedId === id) return
    void flush()
    setSelectedId(id)
    const note =
      view === 'local'
        ? localNotes.find((item) => item.id === id)
        : notes.find((item) => item.id === id)
    if (!note) return
    const next = view === 'local' ? draftFromLocal(note as LocalNote) : draftFromNote(note as Note)
    draftRef.current = next
    setDraft(next)
  }

  const createNote = async (): Promise<void> => {
    if (view === 'local') {
      const note: LocalNote = {
        id: `local_${Date.now().toString(36)}`,
        title: 'Новая заметка',
        body: '',
        tags: [],
        updatedAt: Date.now()
      }
      setLocalNotes((current) => [note, ...current])
      setSelectedId(note.id)
      const next = draftFromLocal(note)
      draftRef.current = next
      setDraft(next)
      return
    }
    pendingNewRef.current = true
    await onAdd({
      title: 'Новая заметка',
      body: '',
      tags: [],
      visibility: view === 'gm' ? 'gm' : 'shared'
    })
  }

  const removeNote = async (): Promise<void> => {
    if (!draft?.id) return
    if (!window.confirm(`Удалить заметку «${draft.title}»?`)) return
    if (draft.local) {
      setLocalNotes((current) => current.filter((note) => note.id !== draft.id))
      setSelectedId(null)
      setDraft(null)
      draftRef.current = null
      return
    }
    await onRemove(draft.id)
    setSelectedId(null)
    setDraft(null)
  }

  const changeView = (next: NotesView): void => {
    if (next === view) return
    void flush()
    setView(next)
    setSearch('')
  }

  const viewTabs: Array<{ id: NotesView; label: string; count: number }> = [
    { id: 'shared', label: 'Общие', count: sharedNotes.length },
    ...(role === 'gm' ? [{ id: 'gm' as const, label: 'Мастер', count: gmNotes.length }] : []),
    { id: 'local', label: 'Мои', count: localNotes.length }
  ]

  return (
    <FloatingPanel
      title="Заметки"
      storageKey={storageKey}
      defaultPosition={{ x: 260, y: 60 }}
      width={900}
      defaultHeight={680}
      resizable
      onClose={onClose}
    >
      <div className="flex h-full min-h-0">
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-black/10">
          <div className="flex gap-1 border-b border-white/10 p-1.5">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeView(tab.id)}
                className={`flex-1 rounded-md px-1 py-1 text-[10px] transition ${
                  view === tab.id
                    ? 'bg-indigo-500/20 text-indigo-100'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {tab.label}
                <span className="ml-0.5 text-[9px] text-gray-500">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1 p-1.5">
            <button
              type="button"
              onClick={() => void createNote()}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500"
            >
              <PlusIcon size={12} />
              Новая
            </button>
            <button
              type="button"
              onClick={() => void removeNote()}
              disabled={!draft?.id}
              className="rounded-md border border-white/10 px-2 py-1.5 text-gray-500 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-30"
              title="Удалить заметку"
            >
              <TrashIcon size={13} />
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по заметкам…"
            className="mx-1.5 mb-1.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-indigo-400/60"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-gray-600">
                {search ? 'Ничего не найдено' : 'Заметок пока нет'}
              </p>
            )}
            {filtered.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => selectNote(note.id)}
                className={`mb-1 w-full rounded-md border px-2 py-1.5 text-left transition ${
                  selectedId === note.id
                    ? 'border-indigo-400/40 bg-indigo-500/15'
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <span className="block truncate text-[11px] font-medium text-gray-200">
                  {note.title || 'Без названия'}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] text-gray-500">
                  <span>{showDate(note.updatedAt)}</span>
                  {note.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded bg-white/5 px-1">
                      {tag}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {draft ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-2 py-1.5">
                <input
                  value={draft.title}
                  onChange={(event) => applyDraft({ title: event.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm font-semibold text-gray-100 outline-none focus:border-indigo-400/60"
                  placeholder="Заголовок"
                />
                <input
                  value={draft.tags}
                  onChange={(event) => applyDraft({ tags: event.target.value })}
                  className="w-40 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-300 outline-none placeholder:text-gray-600 focus:border-indigo-400/60"
                  placeholder="теги, через запятую"
                />
                {role === 'gm' && !draft.local && (
                  <select
                    value={draft.visibility}
                    onChange={(event) =>
                      applyDraft({ visibility: event.target.value as 'shared' | 'gm' })
                    }
                    className="rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] text-gray-300"
                    title="Кому видна заметка"
                  >
                    <option value="shared">Всем</option>
                    <option value="gm">Только Мастеру</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setPreview((current) => !current)}
                  className={`rounded-md border px-2 py-1 text-[11px] transition ${
                    preview
                      ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100'
                      : 'border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {preview ? 'Редактор' : 'Предпросмотр'}
                </button>
                <span className="text-[10px] text-gray-600">
                  {draft.local ? 'локально' : 'сохраняется'}
                </span>
              </div>

              {preview ? (
                <div
                  className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-200 [&_a]:text-indigo-300 [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_code]:rounded [&_code]:bg-black/40 [&_code]:px-1 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-gray-100 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
                  dangerouslySetInnerHTML={{ __html: markdownHtml(draft.body) }}
                />
              ) : (
                <textarea
                  value={draft.body}
                  onChange={(event) => applyDraft({ body: event.target.value })}
                  placeholder="Текст заметки. Поддерживается Markdown: **жирный**, *курсив*, списки, ссылки."
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-gray-200 outline-none placeholder:text-gray-600"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-10 text-center text-xs leading-relaxed text-gray-600">
              {view === 'local'
                ? 'Здесь ваши личные заметки. Они хранятся только в этом браузере и не уходят другим участникам.'
                : view === 'gm'
                  ? 'Заметки для Мастера. Игроки их не получают.'
                  : 'Общий журнал кампании: заметки видны всем участникам.'}
            </div>
          )}
        </section>
      </div>
    </FloatingPanel>
  )
}
