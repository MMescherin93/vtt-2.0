import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useElementSize } from '../useElementSize'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfViewerProps {
  url: string
  title?: string
}

interface RenderState {
  page: number
  pages: number
  scale: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Просмотрщик PDF на PDF.js: одна страница, переход по страницам,
 * масштаб и «по ширине». Работает одинаково в Electron и браузере.
 */
export function PdfViewer({ url, title }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { ref: containerRef, size: container } = useElementSize<HTMLDivElement>()
  const renderRef = useRef<{ cancel: () => void } | null>(null)
  const renderTokenRef = useRef(0)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renderState, setRenderState] = useState<RenderState | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setDoc(null)
    setPage(1)
    setPages(0)
    const task = pdfjs.getDocument({ url })
    let cancelled = false
    task.promise
      .then((loaded) => {
        if (cancelled) {
          return
        }
        setDoc(loaded)
        setPages(loaded.numPages)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Не удалось открыть PDF')
        setLoading(false)
      })
    return () => {
      cancelled = true
      renderRef.current?.cancel()
      void task.destroy()
    }
  }, [url])

  const renderPage = useCallback(async () => {
    if (!doc) return
    const token = ++renderTokenRef.current
    renderRef.current?.cancel()
    setError(null)
    const pageNumber = clamp(page, 1, doc.numPages)
    const pdfPage: PDFPageProxy = await doc.getPage(pageNumber)
    if (token !== renderTokenRef.current) return
    const base = pdfPage.getViewport({ scale: 1 })
    const targetWidth = Math.max(200, container.width - 24)
    const nextScale = fitWidth ? Math.min(3, Math.max(0.25, targetWidth / base.width)) : scale
    const viewport = pdfPage.getViewport({ scale: nextScale })
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const renderViewport = pdfPage.getViewport({ scale: nextScale * dpr })
    canvas.width = Math.floor(renderViewport.width)
    canvas.height = Math.floor(renderViewport.height)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const task = pdfPage.render({ canvas, viewport: renderViewport })
    renderRef.current = task
    try {
      await task.promise
    } catch (reason) {
      if ((reason as { name?: string }).name === 'RenderingCancelledException') return
      throw reason
    }
    if (token !== renderTokenRef.current) return
    if (!fitWidth) setScale(nextScale)
    setRenderState({ page: pageNumber, pages: doc.numPages, scale: nextScale })
  }, [doc, page, scale, fitWidth, container.width])

  useEffect(() => {
    void renderPage().catch((reason: unknown) => {
      if ((reason as { name?: string }).name === 'RenderingCancelledException') return
      setError(reason instanceof Error ? reason.message : 'Ошибка отрисовки PDF')
    })
  }, [renderPage])

  const changePage = (next: number): void => {
    if (!doc) return
    setPage(clamp(next, 1, doc.numPages))
  }

  const zoom = (factor: number): void => {
    setFitWidth(false)
    setScale((current) => clamp(current * factor, 0.25, 3))
  }

  const pageOptions = useMemo(() => Array.from({ length: pages }, (_, index) => index + 1), [pages])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => changePage(page - 1)}
          disabled={page <= 1 || !doc}
          className="rounded-md border border-white/10 px-2 py-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          title="Предыдущая страница"
        >
          ‹
        </button>
        <select
          value={page}
          onChange={(event) => changePage(Number(event.target.value))}
          disabled={!doc}
          className="rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-gray-200"
          aria-label="Страница"
        >
          {pageOptions.length === 0 && <option value={1}>—</option>}
          {pageOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className="text-gray-500">/ {pages || '—'}</span>
        <button
          type="button"
          onClick={() => changePage(page + 1)}
          disabled={!doc || page >= pages}
          className="rounded-md border border-white/10 px-2 py-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          title="Следующая страница"
        >
          ›
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => zoom(1 / 1.2)}
          disabled={!doc}
          className="rounded-md border border-white/10 px-2 py-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          title="Уменьшить"
        >
          −
        </button>
        <span className="w-12 text-center text-gray-400">
          {Math.round((renderState?.scale ?? scale) * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoom(1.2)}
          disabled={!doc}
          className="rounded-md border border-white/10 px-2 py-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
          title="Увеличить"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setFitWidth(true)}
          disabled={!doc}
          className={`rounded-md border px-2 py-1 text-gray-300 transition hover:bg-white/10 disabled:opacity-30 ${
            fitWidth ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100' : 'border-white/10'
          }`}
          title="По ширине окна"
        >
          По ширине
        </button>
        <span className="ml-auto max-w-[45%] truncate text-gray-500">{title}</span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-[#0b0d12] p-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Загрузка PDF…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-red-300">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="mx-auto w-fit">
            <canvas ref={canvasRef} className="rounded bg-white shadow-xl shadow-black/40" />
          </div>
        )}
      </div>
    </div>
  )
}
