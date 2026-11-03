import type { Session, SessionSummary } from '@vtt/shared'
import { createSessionState, shortId } from '@vtt/shared/utils'
import { imageSize } from './imageSize'
import { SessionStorage } from './storage'

export interface AddedAsset {
  relativePath: string
  width: number
  height: number
}

/**
 * Управление сессиями (ТЗ, п.1): CRUD, загрузка/автосохранение,
 * активная сессия и уведомление подписчиков об изменениях.
 */
export class SessionManager {
  private activeSession: Session | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private lastSaveAt = 0

  /** Вызывается при каждом изменении активной сессии (или её закрытии) */
  onChange: ((session: Session | null) => void) | null = null

  constructor(
    private readonly storage: SessionStorage,
    private readonly saveDelayMs = 250
  ) {}

  getActive(): Session | null {
    return this.activeSession
  }

  getActiveId(): string | null {
    return this.activeSession?.id ?? null
  }

  async list(): Promise<SessionSummary[]> {
    return this.storage.list()
  }

  async read(id: string): Promise<Session | null> {
    return this.storage.read(id)
  }

  /** Создание новой сессии (имя, описание) и немедленная активация */
  async create(name: string, description: string): Promise<Session> {
    await this.flush()
    const id = shortId(10)
    const session = createSessionState(id, name.trim() || 'Новая сессия', description.trim())
    await this.storage.write(session)
    this.activeSession = session
    this.onChange?.(session)
    return session
  }

  /** Открытие сессии при выборе в списке (ТЗ: «Загрузка состояния сессии») */
  async activate(id: string | null): Promise<Session | null> {
    await this.flush()
    if (!id) {
      this.activeSession = null
      this.onChange?.(null)
      return null
    }
    const session = await this.storage.read(id)
    if (!session) {
      console.error(`[session] не удалось загрузить сессию ${id}`)
      return null
    }

    // Сразу фиксируем миграцию схемы на диске (например, map -> maps),
    // не дожидаясь первого изменения сессии.
    try {
      await this.storage.write(session)
      this.lastSaveAt = Date.now()
    } catch (error) {
      console.error('[session] не удалось сохранить миграцию сессии:', error)
    }

    this.activeSession = session
    this.onChange?.(session)
    return session
  }

  /** Удаление сессии вместе с её файлами */
  async remove(id: string): Promise<void> {
    if (this.activeSession?.id === id) {
      this.activeSession = null
      this.onChange?.(null)
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await this.storage.delete(id)
  }

  /**
   * Изменяет активную сессию и планирует автосохранение
   * (ТЗ: «Автосохранение состояния сессии в JSON файл при каждом изменении»).
   */
  update(mutator: (session: Session) => void): Session | null {
    const session = this.activeSession
    if (!session) return null
    mutator(session)
    session.updatedAt = Date.now()
    this.scheduleSave()
    this.onChange?.(session)
    return session
  }

  /**
   * Изменение без полной рассылки состояния (например, перемещение токена):
   * данные сохраняются, а участникам уходит точечное событие.
   */
  updateSilent(mutator: (session: Session) => void): Session | null {
    const session = this.activeSession
    if (!session) return null
    mutator(session)
    session.updatedAt = Date.now()
    this.scheduleSave()
    return session
  }

  /** Сохраняет изображение и возвращает относительный путь с размерами */
  async addAsset(
    fileName: string,
    data: Uint8Array,
    kind: 'map' | 'token'
  ): Promise<AddedAsset | null> {
    const session = this.activeSession
    if (!session) return null
    const { relativePath } = await this.storage.addAsset(session.id, fileName, data, kind)
    const dimensions = imageSize(data)
    return {
      relativePath,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0
    }
  }

  /** Немедленная запись на диск (перед выходом/переключением сессии) */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const session = this.activeSession
    if (!session) return
    this.lastSaveAt = Date.now()
    try {
      await this.storage.write(session)
    } catch (error) {
      console.error('[session] ошибка автосохранения:', error)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    // При непрерывных изменениях (перетаскивание токена) не откладываем запись
    // бесконечно: не реже одного раза в 2 секунды.
    if (Date.now() - this.lastSaveAt >= 2000) {
      void this.flush()
      return
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, this.saveDelayMs)
  }
}
