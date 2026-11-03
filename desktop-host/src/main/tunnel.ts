import { spawn, type ChildProcess } from 'node:child_process'
import type { TunnelStatus } from '../shared/ipc'

const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const START_TIMEOUT_MS = 30000
const PROBE_TIMEOUT_MS = 4000

/**
 * Туннель для удалённых игроков (уточнение 1: «используется туннель,
 * например cloudflared или ngrok; ссылка формируется с учётом адреса туннеля»).
 *
 * Реализован запуск quick-туннеля cloudflared. Если утилита не установлена,
 * Мастер может вставить адрес своего туннеля вручную — ссылка будет
 * сформирована с его учётом.
 */
export class TunnelManager {
  private child: ChildProcess | null = null
  private url: string | null = null
  private error: string | null = null
  private available: boolean | null = null

  constructor(
    private readonly port: number,
    private readonly onUpdate: () => void
  ) {}

  getStatus(): TunnelStatus {
    return {
      available: this.available === true,
      running: this.child !== null && this.url !== null,
      url: this.url,
      error: this.error
    }
  }

  /** Есть ли cloudflared в PATH */
  async checkAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available
    this.available = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean): void => {
        if (settled) return
        settled = true
        resolve(value)
      }
      try {
        const probe = spawn('cloudflared', ['--version'], {
          stdio: 'ignore',
          windowsHide: true
        })
        probe.on('error', () => finish(false))
        probe.on('close', (code) => finish(code === 0))
        setTimeout(() => {
          probe.kill()
          finish(false)
        }, PROBE_TIMEOUT_MS)
      } catch {
        finish(false)
      }
    })
    return this.available
  }

  async start(): Promise<TunnelStatus> {
    if (this.child) return this.getStatus()
    this.error = null
    this.url = null

    const available = await this.checkAvailable()
    if (!available) {
      this.error = 'cloudflared не найден в системе — вставьте адрес туннеля вручную'
      this.onUpdate()
      return this.getStatus()
    }

    const child = spawn(
      'cloudflared',
      ['tunnel', '--no-autoupdate', '--url', `http://localhost:${this.port}`],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    )
    this.child = child

    const urlPromise = new Promise<string>((resolve, reject) => {
      let settled = false
      const finish = (value: string | Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (value instanceof Error) reject(value)
        else resolve(value)
      }
      const timer = setTimeout(
        () => finish(new Error('Не удалось получить адрес туннеля за 30 секунд')),
        START_TIMEOUT_MS
      )

      const onData = (chunk: Buffer): void => {
        const match = URL_PATTERN.exec(chunk.toString())
        if (match) {
          this.url = match[0]
          this.error = null
          this.onUpdate()
          finish(match[0])
        }
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)
      child.on('error', (cause) =>
        finish(new Error(`Ошибка запуска cloudflared: ${cause.message}`))
      )
      child.on('close', (code) => {
        if (this.child === child) {
          this.child = null
          if (!this.url) finish(new Error(`cloudflared завершился (код ${code ?? '—'})`))
          this.onUpdate()
        }
      })
    })

    try {
      await urlPromise
    } catch (cause) {
      this.error = cause instanceof Error ? cause.message : 'Не удалось запустить туннель'
      this.stop()
    }

    this.onUpdate()
    return this.getStatus()
  }

  stop(): TunnelStatus {
    const child = this.child
    this.child = null
    this.url = null
    if (child) {
      try {
        child.kill()
      } catch (error) {
        console.error('[tunnel] не удалось остановить cloudflared:', error)
      }
    }
    this.onUpdate()
    return this.getStatus()
  }
}
