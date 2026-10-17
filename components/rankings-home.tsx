'use client'

import { useMemo, useState } from 'react'

type Player = { rank: number; name: string; points: number; records: number; best: string }
type Recent = { player: string; level: string; progress: string; date: string }

export default function RankingsHome({
  players,
  recent,
  title,
  subtitle,
  season,
  connectionError = false,
  isLoggedIn = false,
  isAdmin = false,
}: {
  players: Player[]
  recent: Recent[]
  title: string
  subtitle: string
  season: string
  connectionError?: boolean
  isLoggedIn?: boolean
  isAdmin?: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => players.filter((player) => player.name.toLowerCase().includes(query.toLowerCase())), [players, query])
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visiblePlayers = filtered.slice((page - 1) * pageSize, page * pageSize)
  const firstVisible = filtered.length ? (page - 1) * pageSize + 1 : 0
  const lastVisible = Math.min(page * pageSize, filtered.length)

  return (
    <div className="min-h-screen bg-[#080808] text-[#f1f1f1]">
      <header className="border-b border-[#292929] bg-[#0b0b0b]">
        <nav className="mx-auto flex min-h-12 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6" aria-label="Navegación principal">
          <a href="#top" className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">Extremity <span className="text-[#b22222]">List</span></a>
          <div className="flex items-center gap-4 overflow-x-auto text-[11px] text-[#898989] sm:gap-7">
            <a href="#leaderboard" className="whitespace-nowrap hover:text-white">Ranking</a>
            <a href="#players" className="whitespace-nowrap hover:text-white">Jugadores</a>
            <a href="#submit" className="whitespace-nowrap hover:text-white">Enviar récord</a>
            <a href="#about" className="whitespace-nowrap hover:text-white">Acerca de</a>
            {isLoggedIn ? (
              <>
                <a href="/dashboard" className="whitespace-nowrap hover:text-white">Panel</a>
                {isAdmin && <a href="/admin" className="whitespace-nowrap text-[#b22222] hover:text-[#d44]">Admin</a>}
                <a href="/logout" className="whitespace-nowrap hover:text-white">Cerrar sesión</a>
              </>
            ) : (
              <>
                <a href="/login" className="whitespace-nowrap hover:text-white">Iniciar sesión</a>
                <a href="/register" className="whitespace-nowrap hover:text-white">Registrarse</a>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="top" className="mx-auto max-w-[1180px] px-4 pb-14 pt-7 sm:px-6 sm:pt-9">
        <section className="mb-5">
          <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#b22222]">{season}</p>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-white">{title}</h1>
          <p className="mt-1 text-[12px] text-[#777]">{subtitle}</p>
        </section>

        {connectionError && (
          <div className="mb-6 border border-[#3a2020] bg-[#1a0e0e] px-4 py-3 text-[12px] text-[#c97878]">
            No se pudieron cargar los datos del servidor. Inténtalo de nuevo más tarde.
          </div>
        )}

        <section id="leaderboard" aria-labelledby="leaderboard-title">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 id="leaderboard-title" className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Ranking global</h2>
            <label className="flex h-7 w-full items-center border border-[#303030] bg-[#111] px-2.5 text-[11px] text-[#666] sm:w-52">
              <span className="mr-2 text-[#8d2929]" aria-hidden="true">/</span>
              <span className="sr-only">Buscar jugadores</span>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar jugadores" className="min-w-0 flex-1 bg-transparent text-[#ddd] outline-none placeholder:text-[#555]" />
            </label>
          </div>
          <div className="overflow-x-auto border border-[#292929] bg-[#111]">
            <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
              <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
                <tr>
                  <th className="w-16 px-4 py-2.5 font-medium">Rango</th>
                  <th className="px-4 py-2.5 font-medium">Jugador</th>
                  <th className="px-4 py-2.5 font-medium">Mejor récord</th>
                  <th className="px-4 py-2.5 text-right font-medium">Puntos</th>
                  <th className="w-24 px-4 py-2.5 text-right font-medium">Récords</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.name} className={`border-b border-[#242424] last:border-0 hover:bg-[#181818] ${player.rank <= 3 ? 'bg-[#141010]' : ''}`}>
                    <td className={`px-4 py-3 font-mono ${player.rank <= 3 ? 'font-semibold text-[#b22222]' : 'text-[#777]'}`}>{String(player.rank).padStart(2, '0')}</td>
                    <td className="px-4 py-3 font-medium text-[#ededed]">{player.name}</td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{player.best}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#dedede]">{new Intl.NumberFormat('es-MX').format(player.points)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#858585]">{player.records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="px-4 py-8 text-center text-[12px] text-[#666]">
                {players.length === 0 && !connectionError
                  ? 'Aún no hay récords aprobados. El ranking se llenará conforme se aprueben los récords.'
                  : 'No se encontraron jugadores.'}
              </p>
            )}
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-x border-b border-[#292929] bg-[#0e0e0e] px-3 py-2 text-[10px] text-[#656565]">
              <span>Mostrando {firstVisible}–{lastVisible} de {filtered.length} jugadores</span>
              <div className="flex items-center gap-1" aria-label="Paginación">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="border border-[#292929] px-2 py-1 text-[#777] hover:border-[#555] hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior">←</button>
                <button className="border border-[#7e2020] bg-[#351313] px-2.5 py-1 text-[#e8b4b4]" aria-current="page">{page}</button>
                <button onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="border border-[#292929] px-2 py-1 text-[#777] hover:border-[#555] hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente">→</button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 max-w-[760px]" aria-labelledby="recent-title">
          <div className="mb-2 flex items-center justify-between border-b border-[#292929] pb-2">
            <h2 id="recent-title" className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Récords aprobados recientemente</h2>
            <span className="text-[10px] text-[#5f5f5f]">Últimas 48 horas</span>
          </div>
          {recent.length > 0 ? (
            <ul className="divide-y divide-[#242424] border-b border-[#292929]">
              {recent.map((record) => (
                <li key={`${record.player}-${record.level}`} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-[11px] sm:grid-cols-[115px_1fr_80px_90px]">
                  <span className="font-medium text-[#ddd]">{record.player}</span>
                  <span className="text-[#999]">{record.level}</span>
                  <span className="text-[#b22222]">{record.progress}</span>
                  <span className="text-right text-[#5f5f5f]">{record.date}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[12px] text-[#666]">Aún no hay récords aprobados.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export type { Player, Recent }
