import { useEffect, useState } from 'react'
import { CloudIcon, CopyIcon, FloatingPanel, LinkIcon } from '@vtt/shared/ui'
import { useHostStore } from '../../store/useHostStore'

/** Панель ссылки-приглашения и туннеля для удалённых игроков (уточнение 1) */
export function InvitePanel() {
  const session = useHostStore((state) => state.session)
  const panels = useHostStore((state) => state.panels)
  const togglePanel = useHostStore((state) => state.togglePanel)
  const invite = useHostStore((state) => state.invite)
  const refreshInvite = useHostStore((state) => state.refreshInvite)

  const [manualUrl, setManualUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tunnelError, setTunnelError] = useState<string | null>(null)

  useEffect(() => {
    if (!panels.invite) return
    void refreshInvite()
    const timer = window.setInterval(() => void refreshInvite(), 15000)
    return () => window.clearInterval(timer)
  }, [panels.invite, refreshInvite])

  useEffect(() => {
    if (invite?.tunnel.url) setManualUrl(invite.tunnel.url)
  }, [invite?.tunnel.url])

  if (!session || !panels.invite) return null

  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setTunnelError('Не удалось скопировать ссылку — выделите её вручную')
    }
  }

  const startTunnel = async (): Promise<void> => {
    setBusy(true)
    setTunnelError(null)
    try {
      await window.hostApi.startTunnel()
      await refreshInvite()
    } catch (error) {
      setTunnelError(String(error))
    } finally {
      setBusy(false)
    }
  }

  const stopTunnel = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.hostApi.stopTunnel()
      await refreshInvite()
    } finally {
      setBusy(false)
    }
  }

  const saveManual = async (): Promise<void> => {
    setBusy(true)
    setTunnelError(null)
    try {
      await window.hostApi.setTunnelUrl(manualUrl.trim() || null)
      await refreshInvite()
    } finally {
      setBusy(false)
    }
  }

  return (
    <FloatingPanel
      title="Приглашение игроков"
      icon={<LinkIcon size={16} />}
      defaultPosition={{ x: 360, y: 96 }}
      storageKey="vtt.gm.panel.invite"
      width={380}
      onClose={() => togglePanel('invite')}
    >
      <div className="space-y-4 p-3">
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Ссылка для игроков
          </h3>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
            <span className="min-w-0 flex-1 select-all break-all font-mono text-[11px] leading-snug text-indigo-200">
              {invite?.inviteUrl ?? '—'}
            </span>
            <button
              type="button"
              onClick={() => invite?.inviteUrl && void copy(invite.inviteUrl)}
              className="flex shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-500"
            >
              <CopyIcon size={12} />
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            ID сессии: <span className="font-mono text-gray-400">{session.id}</span>
          </p>
        </section>

        <section className="space-y-1 text-[11px]">
          <Row label="Локально" value={invite?.localUrl} />
          <Row label="По локальной сети" value={invite?.lanUrl} />
          <Row label="Через туннель" value={invite?.tunnelUrl} />
        </section>

        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <CloudIcon size={13} /> Туннель для удалённых игроков
          </h3>

          {invite?.tunnel.running ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200">
                Туннель запущен: <span className="break-all font-mono">{invite.tunnel.url}</span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void stopTunnel()}
                className="w-full rounded-lg border border-white/10 px-2 py-1.5 text-xs text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
              >
                Остановить туннель
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {invite?.tunnel.available ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startTunnel()}
                  className="w-full rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  {busy ? 'Запускаю cloudflared…' : 'Запустить туннель cloudflared'}
                </button>
              ) : (
                <p className="text-[11px] leading-relaxed text-gray-500">
                  cloudflared не найден. Вставьте адрес своего туннеля (ngrok, cloudflared или
                  другой) — ссылка будет сформирована с его учётом.
                </p>
              )}

              <div className="flex gap-2">
                <input
                  value={manualUrl}
                  onChange={(event) => setManualUrl(event.target.value)}
                  placeholder="https://example.trycloudflare.com"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/70"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveManual()}
                  className="rounded-lg border border-white/10 px-2 text-[11px] text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}

          {tunnelError && <p className="mt-1.5 text-[11px] text-red-300">{tunnelError}</p>}
          {invite?.tunnel.error && !invite.tunnel.running && (
            <p className="mt-1.5 text-[11px] text-amber-300">{invite.tunnel.error}</p>
          )}
        </section>

        {!invite?.servingClient && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200">
            Веб-клиент запущен отдельно (порт 5173). Для ссылки на один порт соберите проект
            командой <span className="font-mono">npm run build</span> и перезапустите хост.
          </p>
        )}
      </div>
    </FloatingPanel>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="select-all break-all text-right font-mono text-gray-300">
        {value ?? '—'}
      </span>
    </div>
  )
}
