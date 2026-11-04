import { useEffect, useState } from 'react'
import type { PdfDocument } from '../../types/pdf'
import { assetUrl } from '../assets'
import { FloatingPanel } from '../FloatingPanel'
import { PdfViewer } from './PdfViewer'
import { FileTextIcon, PlusIcon, TrashIcon } from '../icons'

export interface PdfPanelProps {
  sessionId: string
  assetsBaseUrl: string
  pdfs: PdfDocument[]
  canManage: boolean
  onPick: () => Promise<PdfDocument | null>
  onRemove: (pdfId: string) => Promise<boolean>
  onClose: () => void
  storageKey: string
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/** Библиотека PDF: список документов и встроенный просмотрщик */
export function PdfPanel({
  sessionId,
  assetsBaseUrl,
  pdfs,
  canManage,
  onPick,
  onRemove,
  onClose,
  storageKey
}: PdfPanelProps) {
  const selectionKey = `${storageKey}:selected`
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(selectionKey)
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = pdfs.find((pdf) => pdf.id === selectedId) ?? pdfs[0] ?? null

  useEffect(() => {
    if (selectedId && pdfs.some((pdf) => pdf.id === selectedId)) return
    const next = pdfs[0]?.id ?? null
    setSelectedId(next)
    try {
      if (next) localStorage.setItem(selectionKey, next)
      else localStorage.removeItem(selectionKey)
    } catch {
      // ignore
    }
  }, [pdfs, selectedId, selectionKey])

  const select = (id: string): void => {
    setSelectedId(id)
    try {
      localStorage.setItem(selectionKey, id)
    } catch {
      // ignore
    }
  }

  const upload = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const pdf = await onPick()
      if (pdf) select(pdf.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (pdf: PdfDocument): Promise<void> => {
    if (!window.confirm(`Удалить PDF «${pdf.title}» из библиотеки?`)) return
    setBusy(true)
    setError(null)
    try {
      await onRemove(pdf.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FloatingPanel
      title="PDF-библиотека"
      storageKey={storageKey}
      defaultPosition={{ x: 220, y: 50 }}
      width={980}
      defaultHeight={760}
      resizable
      onClose={onClose}
    >
      <div className="flex h-full min-h-0">
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-black/10">
          <div className="flex items-center gap-1 border-b border-white/10 p-2">
            {canManage && (
              <button
                type="button"
                onClick={() => void upload()}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <PlusIcon size={13} />
                Добавить PDF
              </button>
            )}
            {!canManage && (
              <span className="px-1 text-[11px] text-gray-500">Документы Мастера</span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {pdfs.length === 0 && (
              <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-gray-600">
                {canManage
                  ? 'Загрузите PDF — он появится у всех участников.'
                  : 'Мастер ещё не добавил PDF.'}
              </p>
            )}
            {pdfs.map((pdf) => (
              <button
                key={pdf.id}
                type="button"
                onClick={() => select(pdf.id)}
                className={`group mb-1 flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                  selected?.id === pdf.id
                    ? 'border-indigo-400/40 bg-indigo-500/15'
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <FileTextIcon size={14} className="mt-0.5 shrink-0 text-indigo-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-gray-200">
                    {pdf.title}
                  </span>
                  <span className="block text-[10px] text-gray-500">{formatSize(pdf.size)}</span>
                </span>
                {canManage && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      void remove(pdf)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.stopPropagation()
                        void remove(pdf)
                      }
                    }}
                    className="mt-0.5 hidden text-gray-600 transition hover:text-red-300 group-hover:block"
                    title="Удалить PDF"
                  >
                    <TrashIcon size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <p className="border-t border-red-400/20 bg-red-500/10 px-2 py-1.5 text-[10px] leading-snug text-red-200">
              {error}
            </p>
          )}
        </aside>

        <section className="min-w-0 flex-1">
          {selected ? (
            <PdfViewer
              key={selected.id}
              url={assetUrl(assetsBaseUrl, sessionId, selected.relativePath)}
              title={selected.title}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-xs leading-relaxed text-gray-600">
              {canManage
                ? 'Добавьте PDF через кнопку «Добавить PDF». Файл сохранится в папке сессии.'
                : 'Здесь появятся документы, которые загрузит Мастер.'}
            </div>
          )}
        </section>
      </div>
    </FloatingPanel>
  )
}
