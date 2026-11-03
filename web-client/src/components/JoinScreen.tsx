import { useEffect, useState, type FormEvent } from 'react'
import { useClientStore } from '../store/useClientStore'
import { SESSION_ID, hostUrl, socket } from '../socket'

function statusView(status: string): { color: string; text: string } {
  switch (status) {
    case 'connected':
      return { color: 'bg-green-500', text: 'Подключено к хосту' }
    case 'connecting':
      return { color: 'bg-amber-500', text: 'Подключение…' }
    case 'disconnected':
      return { color: 'bg-amber-500', text: 'Переподключение…' }
    case 'error':
      return { color: 'bg-red-500', text: 'Нет связи с хостом' }
    default:
      return { color: 'bg-gray-500', text: 'Ожидание' }
  }
}

/** Экран входа игрока: имя и подключение к сессии Мастера */
export function JoinScreen() {
  const playerName = useClientStore((state) => state.playerName)
  const join = useClientStore((state) => state.join)
  const status = useClientStore((state) => state.status)
  const joinError = useClientStore((state) => state.joinError)
  const closedReason = useClientStore((state) => state.closedReason)
  const session = useClientStore((state) => state.session)

  const [name, setName] = useState(playerName)

  useEffect(() => {
    setName(playerName)
  }, [playerName])

  const view = statusView(status)

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    join(name)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#1a1a1a] p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-100">VTT — Игрок</h1>
          <p className="mt-1 text-sm text-gray-400">
            {session ? `Стол «${session.name}»` : 'Подключение к столу Мастера'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${view.color}`} />
            <span className="text-sm font-medium text-gray-200">{view.text}</span>
          </div>

          {closedReason ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {closedReason}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Обновить страницу
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label className="mb-1.5 block text-xs text-gray-400" htmlFor="player-name">
                Ваше имя
              </label>
              <div className="flex gap-2">
                <input
                  id="player-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например, «Тарвин»"
                  maxLength={32}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/70"
                />
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Войти
                </button>
              </div>

              <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Сессия</dt>
                  <dd className="truncate font-mono text-gray-300">{SESSION_ID || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Хост</dt>
                  <dd className="truncate font-mono text-gray-300">{hostUrl}</dd>
                </div>
              </dl>

              {joinError && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-red-300">{joinError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      useClientStore.getState().setJoinError(null)
                      socket.connect()
                    }}
                    className="w-full rounded-lg border border-white/10 py-1.5 text-xs text-gray-300 transition hover:bg-white/10"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-600">
          Камера, масштаб и инструменты сохраняются в этом браузере и восстанавливаются после
          переподключения
        </p>
      </div>
    </div>
  )
}
