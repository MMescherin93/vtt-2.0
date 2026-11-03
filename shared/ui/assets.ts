/**
 * URL файла из папки сессии на HTTP-сервере хоста.
 * В JSON сессии хранятся относительные пути (уточнение 5), поэтому адрес
 * собирается из базового URL сервера + id сессии + путь.
 */
export function assetUrl(baseUrl: string, sessionId: string, relativePath: string): string {
  if (!relativePath) return ''
  const base = baseUrl.replace(/\/+$/, '')
  const encodedPath = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/session-assets/${encodeURIComponent(sessionId)}/${encodedPath}`
}

/** Базовый URL сервера хоста (без завершающего слэша) */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}
