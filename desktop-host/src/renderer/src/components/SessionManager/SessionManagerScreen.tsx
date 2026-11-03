import { useState, type FormEvent } from 'react'
import { formatDateTime } from '../../lib/host'
import { useHostStore } from '../../store/useHostStore'

/**
 * Экран управления сессиями (ТЗ, этап 2): создание (имя, описание),
 * список всех сессий, удаление, открытие.
 */
export function SessionManagerScreen() {
  const sessions = useHostStore((state) => state.sessions)
  const session = useHostStore((state) => state.session)
  const busy = useHostStore((state) => state.busy)
  const error = useHostStore((state) => state.error)
  const status = useHostStore((state) => state.status)
  const createSession = useHostStore((state) => state.createSession)
  const openSession = useHostStore((state) => state.openSession)
  const deleteSession = useHostStore((state) => state.deleteSession)
  const setScreen = useHostStore((state) => state.setScreen)
  const setError = useHostStore((state) => state.setError)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!name.trim() || busy) return
    void createSession(name, description).then(() => {
      setName('')
      setDescription('')
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#1a1a1a] px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-100">VTT — стол Мастера</h1>
            <p className="mt-1 text-sm text-gray-400">
              Создайте сессию, откройте её и пригласите игроков по ссылке
            </p>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <button
                type="button"
                onClick={() => setScreen('table')}
                className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25"
              >
                Вернуться к столу «{session.name}»
              </button>
            )}
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400 backdrop-blur">
              <span
                className={`mr-2 inline-block h-2 w-2 rounded-full ${
                  status?.listening ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              Порт {status?.port ?? '—'} · LAN {status?.lanIp ?? '—'} · клиентов{' '}
              {status?.clients ?? 0}
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-red-300 hover:text-white"
            >
              Скрыть
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={submit}
            className="h-fit rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
          >
            <h2 className="text-sm font-semibold text-gray-100">Новая сессия</h2>
            <p className="mt-1 text-xs text-gray-500">Данные хранятся локально в JSON-файлах</p>

            <label className="mt-4 block text-xs text-gray-400" htmlFor="session-name">
              Название
            </label>
            <input
              id="session-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, «Проклятые земли»"
              maxLength={120}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/70"
            />

            <label className="mt-3 block text-xs text-gray-400" htmlFor="session-description">
              Описание
            </label>
            <textarea
              id="session-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Коротко о кампании, системе и составе"
              rows={3}
              maxLength={2000}
              className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-500/70"
            />

            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Создать и открыть
            </button>
          </form>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-100">
                Сессии{sessions.length > 0 ? ` · ${sessions.length}` : ''}
              </h2>
            </div>

            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-gray-500">
                Пока нет ни одной сессии. Создайте первую слева.
              </div>
            ) : (
              <ul className="space-y-2">
                {sessions.map((item) => {
                  const active = session?.id === item.id
                  return (
                    <li
                      key={item.id}
                      className={`group flex items-center gap-4 rounded-xl border px-4 py-3 transition ${
                        active
                          ? 'border-indigo-400/50 bg-indigo-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-100">
                            {item.name}
                          </span>
                          {active && (
                            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
                              открыта
                            </span>
                          )}
                          {item.hasMap && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                              карта
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {item.description || 'Без описания'}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-600">
                          изменена {formatDateTime(item.updatedAt)} · токенов {item.tokenCount}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void openSession(item.id)}
                          className="rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                        >
                          Открыть
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Удалить сессию «${item.name}» со всеми файлами?`)) {
                              void deleteSession(item.id)
                            }
                          }}
                          className="rounded-lg border border-transparent px-2 py-1.5 text-xs text-gray-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
