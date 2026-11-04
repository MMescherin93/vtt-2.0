import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import type { Session, SessionSummary } from '@vtt/shared'
import type { Drawing, FogOfWarData, MapAsset, MapSettings, MapText, Token } from '@vtt/shared'
import { BUILT_IN_EXTENSIONS } from '@vtt/shared/plugins'
import {
  createSessionState,
  newId,
  normalizeCombat,
  sanitizeConditions,
  sanitizeFog,
  sanitizeStats
} from '@vtt/shared/utils'

const SESSION_FILE = 'session.json'
const ASSETS_DIR = 'assets'

/**
 * Хранилище сессий: JSON-файлы и изображения в папке данных приложения
 * (ТЗ: «Данные хранятся локально на машине Мастера», «Локальное хранение:
 * JSON файлы через fs API», уточнение 5 — картинки лежат в папке сессии,
 * в JSON хранятся относительные пути).
 *
 * Структура:
 *   <root>/<sessionId>/session.json
 *   <root>/<sessionId>/assets/<uuid>-<имя файла>
 */
export class SessionStorage {
  constructor(readonly rootDir: string) {}

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true })
  }

  sessionDir(sessionId: string): string {
    return join(this.rootDir, sanitizeId(sessionId))
  }

  assetsDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), ASSETS_DIR)
  }

  private sessionFile(sessionId: string): string {
    return join(this.sessionDir(sessionId), SESSION_FILE)
  }

  /** Список сессий для UI Мастера (битые файлы пропускаются) */
  async list(): Promise<SessionSummary[]> {
    await this.ensureRoot()
    let entries: string[]
    try {
      entries = await readdir(this.rootDir)
    } catch (error) {
      console.error('[storage] не удалось прочитать папку сессий:', error)
      return []
    }

    const summaries: SessionSummary[] = []
    for (const entry of entries) {
      const file = join(this.rootDir, entry, SESSION_FILE)
      if (!existsSync(file)) continue
      try {
        const raw = await readFile(file, 'utf-8')
        const session = normalizeSession(JSON.parse(raw), entry)
        summaries.push({
          id: session.id,
          name: session.name,
          description: session.description,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          tokenCount: session.tokens.length,
          hasMap: session.maps.length > 0
        })
      } catch (error) {
        console.error(`[storage] пропускаю повреждённую сессию "${entry}":`, error)
      }
    }

    return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async read(sessionId: string): Promise<Session | null> {
    const file = this.sessionFile(sessionId)
    try {
      const raw = await readFile(file, 'utf-8')
      return normalizeSession(JSON.parse(raw), sanitizeId(sessionId))
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        console.error(`[storage] ошибка чтения сессии ${sessionId}:`, error)
      }
      return null
    }
  }

  /** Атомарная запись: сначала .tmp, потом rename (защита от обрыва) */
  async write(session: Session): Promise<void> {
    const dir = this.sessionDir(session.id)
    await mkdir(dir, { recursive: true })
    const file = this.sessionFile(session.id)
    const temp = `${file}.tmp`
    await writeFile(temp, JSON.stringify(session, null, 2), 'utf-8')
    await rename(temp, file)
  }

  async delete(sessionId: string): Promise<void> {
    const dir = this.sessionDir(sessionId)
    const resolvedRoot = resolve(this.rootDir)
    const resolvedDir = resolve(dir)
    if (!resolvedDir.startsWith(resolvedRoot + sep)) {
      throw new Error('Некорректный путь сессии')
    }
    await rm(dir, { recursive: true, force: true })
  }

  /**
   * Сохраняет изображение в папку сессии и возвращает относительный путь
   * (в JSON он и хранится — уточнение 5).
   */
  async addAsset(
    sessionId: string,
    fileName: string,
    data: Uint8Array,
    kind: 'map' | 'token' = 'token'
  ): Promise<{ relativePath: string; absolutePath: string }> {
    const dir = this.assetsDir(sessionId)
    await mkdir(dir, { recursive: true })

    const extension = normalizeExtension(fileName)
    const baseName = `${kind}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}${extension}`
    const absolutePath = join(dir, baseName)
    await writeFile(absolutePath, data)
    return { relativePath: `${ASSETS_DIR}/${baseName}`, absolutePath }
  }

  /** Безопасное разрешение пути ассета (защита от выхода за папку сессии) */
  resolveAssetPath(sessionId: string, relativePath: string): string | null {
    const sessionRoot = resolve(this.sessionDir(sessionId))
    const candidate = resolve(sessionRoot, relativePath)
    if (!candidate.startsWith(sessionRoot + sep)) return null
    return candidate
  }

  async assetSize(sessionId: string, relativePath: string): Promise<number | null> {
    const file = this.resolveAssetPath(sessionId, relativePath)
    if (!file) return null
    try {
      const info = await stat(file)
      return info.isFile() ? info.size : null
    } catch {
      return null
    }
  }
}

/** Идентификатор сессии попадает в путь — разрешаем только безопасные символы */
export function sanitizeId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!clean) throw new Error('Некорректный идентификатор сессии')
  return clean
}

function normalizeExtension(fileName: string): string {
  const extension = extname(fileName || '').toLowerCase()
  const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']
  return allowed.includes(extension) ? extension : '.png'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeToken(raw: unknown): Token | null {
  if (!raw || typeof raw !== 'object') return null
  const token = raw as Partial<Token>
  if (typeof token.id !== 'string' || typeof token.name !== 'string') return null
  return {
    id: token.id,
    name: token.name,
    imageUrl: typeof token.imageUrl === 'string' ? token.imageUrl : '',
    x: isFiniteNumber(token.x) ? token.x : 0,
    y: isFiniteNumber(token.y) ? token.y : 0,
    width: isFiniteNumber(token.width) && token.width > 0 ? token.width : 70,
    height: isFiniteNumber(token.height) && token.height > 0 ? token.height : 70,
    rotation: isFiniteNumber(token.rotation) ? token.rotation : 0,
    hidden: Boolean(token.hidden),
    locked: Boolean(token.locked),
    hideName: Boolean(token.hideName),
    stats: sanitizeStats(token.stats),
    conditions: sanitizeConditions(token.conditions)
  }
}

function normalizeDrawing(raw: unknown): Drawing | null {
  if (!raw || typeof raw !== 'object') return null
  const drawing = raw as Partial<Drawing>
  if (typeof drawing.id !== 'string' || !Array.isArray(drawing.points)) return null
  if (drawing.points.length < 2) return null
  return {
    id: drawing.id,
    tool: drawing.tool === 'eraser' ? 'eraser' : 'pencil',
    color: typeof drawing.color === 'string' ? drawing.color : '#f8fafc',
    size: isFiniteNumber(drawing.size) && drawing.size > 0 ? drawing.size : 4,
    points: drawing.points.filter((value): value is number => isFiniteNumber(value)),
    authorId: typeof drawing.authorId === 'string' ? drawing.authorId : '',
    authorName: typeof drawing.authorName === 'string' ? drawing.authorName : '',
    createdAt: isFiniteNumber(drawing.createdAt) ? drawing.createdAt : Date.now()
  }
}

function normalizeMapText(raw: unknown): MapText | null {
  if (!raw || typeof raw !== 'object') return null
  const text = raw as Partial<MapText>
  if (typeof text.id !== 'string' || typeof text.text !== 'string' || !text.text.trim()) return null
  return {
    id: text.id,
    x: isFiniteNumber(text.x) ? text.x : 0,
    y: isFiniteNumber(text.y) ? text.y : 0,
    text: text.text.slice(0, 1000),
    color: typeof text.color === 'string' ? text.color : '#f8fafc',
    fontSize:
      isFiniteNumber(text.fontSize) && text.fontSize > 0
        ? Math.min(200, Math.max(8, text.fontSize))
        : 24,
    authorId: typeof text.authorId === 'string' ? text.authorId : '',
    authorName: typeof text.authorName === 'string' ? text.authorName : '',
    createdAt: isFiniteNumber(text.createdAt) ? text.createdAt : Date.now()
  }
}

function normalizeMap(raw: unknown): MapAsset | null {
  if (!raw || typeof raw !== 'object') return null
  const map = raw as Partial<MapAsset>
  const imageUrl = typeof map.imageUrl === 'string' ? map.imageUrl : ''
  const width = isFiniteNumber(map.width) && map.width > 0 ? Math.round(map.width) : 0
  const height = isFiniteNumber(map.height) && map.height > 0 ? Math.round(map.height) : 0
  if (!imageUrl || width <= 0 || height <= 0) return null
  return {
    id: typeof map.id === 'string' && map.id ? map.id : newId('map'),
    imageUrl,
    width,
    height
  }
}

/** Карты сессии; v1-сессия с одной картой мигрирует в массив */
function normalizeMaps(source: Partial<Session>): MapAsset[] {
  if (Array.isArray(source.maps)) {
    return source.maps.map(normalizeMap).filter((map): map is MapAsset => map !== null)
  }
  const legacy = (source as { map?: unknown }).map
  const migrated = normalizeMap(legacy)
  return migrated ? [migrated] : []
}

/**
 * Приводит JSON с диска к актуальной схеме (старые/частично битые файлы
 * не должны ломать приложение).
 */
export function normalizeSession(raw: unknown, fallbackId: string): Session {
  const source = (raw ?? {}) as Partial<Session>
  const base = createSessionState(
    typeof source.id === 'string' && source.id ? source.id : fallbackId,
    typeof source.name === 'string' && source.name.trim() ? source.name : 'Без названия',
    typeof source.description === 'string' ? source.description : '',
    isFiniteNumber(source.createdAt) ? source.createdAt : Date.now()
  )

  const maps = normalizeMaps(source)
  const settings: MapSettings = {
    gridType:
      source.settings?.gridType === 'hex' || source.settings?.gridType === 'none'
        ? source.settings.gridType
        : 'square',
    gridSize:
      isFiniteNumber(source.settings?.gridSize) && source.settings.gridSize >= 10
        ? source.settings.gridSize
        : base.settings.gridSize,
    showGrid: typeof source.settings?.showGrid === 'boolean' ? source.settings.showGrid : true,
    gridColor:
      typeof source.settings?.gridColor === 'string' ? source.settings.gridColor : '#ffffff',
    tokenLabelColor:
      typeof source.settings?.tokenLabelColor === 'string'
        ? source.settings.tokenLabelColor
        : '#e2e8f0',
    showTokenNames:
      typeof source.settings?.showTokenNames === 'boolean' ? source.settings.showTokenNames : true
  }

  const fog: FogOfWarData = sanitizeFog(source.fogOfWar) ?? { covered: true, ops: [] }

  // Включённость расширений — общая для сессии; старые сессии получают значения по умолчанию
  const enabledExtensions: Record<string, boolean> = {}
  for (const definition of BUILT_IN_EXTENSIONS) {
    const stored = source.enabledExtensions?.[definition.id]
    enabledExtensions[definition.id] =
      typeof stored === 'boolean' ? stored : definition.defaultEnabled
  }

  return {
    ...base,
    schemaVersion: 2,
    id: base.id,
    createdAt: base.createdAt,
    updatedAt: isFiniteNumber(source.updatedAt) ? source.updatedAt : base.updatedAt,
    maps,
    settings,
    combat: normalizeCombat(source.combat),
    enabledExtensions,
    extensionState:
      source.extensionState && typeof source.extensionState === 'object'
        ? { ...(source.extensionState as Record<string, unknown>) }
        : {},
    tokens: Array.isArray(source.tokens)
      ? source.tokens.map(normalizeToken).filter((token): token is Token => token !== null)
      : [],
    fogOfWar: fog,
    drawings: Array.isArray(source.drawings)
      ? source.drawings
          .map(normalizeDrawing)
          .filter((drawing): drawing is Drawing => drawing !== null)
      : [],
    texts: Array.isArray(source.texts)
      ? source.texts.map(normalizeMapText).filter((text): text is MapText => text !== null)
      : [],
    chatLog: Array.isArray(source.chatLog)
      ? source.chatLog.filter(
          (message) =>
            message &&
            typeof message.id === 'string' &&
            typeof message.text === 'string' &&
            typeof message.userName === 'string'
        )
      : [],
    rollLog: Array.isArray(source.rollLog)
      ? source.rollLog.filter(
          (roll) => roll && typeof roll.id === 'string' && Array.isArray(roll.results)
        )
      : []
  }
}
