import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface AppSettings {
  /** Адрес туннеля, вставленный вручную (если cloudflared не используется) */
  tunnelUrl: string | null
  /** Последняя открытая сессия — восстанавливается при запуске */
  lastSessionId: string | null
}

const DEFAULTS: AppSettings = { tunnelUrl: null, lastSessionId: null }

/** Простое JSON-хранилище настроек приложения */
export class SettingsStore {
  private settings: AppSettings = { ...DEFAULTS }

  constructor(private readonly file: string) {}

  async load(): Promise<AppSettings> {
    try {
      const raw = await readFile(this.file, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      this.settings = {
        tunnelUrl: typeof parsed.tunnelUrl === 'string' ? parsed.tunnelUrl : null,
        lastSessionId: typeof parsed.lastSessionId === 'string' ? parsed.lastSessionId : null
      }
    } catch {
      this.settings = { ...DEFAULTS }
    }
    return this.settings
  }

  get(): AppSettings {
    return this.settings
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...patch }
    try {
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(this.file, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch (error) {
      console.error('[settings] не удалось сохранить настройки:', error)
    }
    return this.settings
  }
}
