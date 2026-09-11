import ShareBlock from '../components/ShareBlock'
import { EPS, money, netOf, num, payoutAmount, pctSum, poolOf, signed } from '../lib/money'
import { useSession } from '../store/session'

const MEDALS = ['🥇', '🥈', '🥉']

/** Desglose de la bolsa, quién quedó en cada lugar y el neto de cada jugador. */
export default function TorneoResultadoScreen() {
  const players = useSession((s) => s.players)
  const tournament = useSession((s) => s.tournament)
  const sessionName = useSession((s) => s.sessionName)
  const assignPlace = useSession((s) => s.assignPlace)

  const pool = poolOf(players, tournament)
  const sum = pctSum(tournament)
  const rebuysN = players.reduce((a, p) => a + num(p.tourney.rebuys), 0)
  const addonsN = players.reduce((a, p) => a + num(p.tourney.addons), 0)

  const ranking = players
    .map((p) => ({ name: p.name || 'Sin nombre', net: netOf(p, players, tournament), place: p.tourney.place }))
    .sort((a, b) => b.net - a.net)

  const plainText = () => {
    const lines = [`🏆 ${sessionName || 'Torneo'}`, '', `Bolsa: ${money(pool)}`, '']
    tournament.payouts.forEach((po, i) => {
      const winner = players.find((p) => p.tourney.place === i + 1)
      lines.push(
        `${i + 1}º (${num(po.pct)}%): ${money(payoutAmount(i, players, tournament))}${
          winner ? ` — ${winner.name || 'Sin nombre'}` : ''
        }`,
      )
    })
    return lines.join('\n')
  }

  return (
    <>
      <div className="mb-3.5 rounded-xl bg-gradient-to-br from-[#0f6b3f] to-[#0a4a2b] px-4 py-3.5 text-center text-gold-soft shadow-[0_6px_16px_rgba(0,0,0,.2)]">
        <div className="text-xs tracking-[1px] text-mint uppercase opacity-85">Bolsa a repartir</div>
        <div className="mt-0.5 font-display text-[34px] font-bold">{money(pool)}</div>
      </div>

      <section className="panel">
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div className="stat">
            <div className="stat-k">Jugadores</div>
            <div className="stat-v">{players.length}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Entradas</div>
            <div className="stat-v">{money(players.length * num(tournament.buyIn))}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Recompras</div>
            <div className="stat-v">
              {rebuysN} · {money(rebuysN * num(tournament.rebuyPrice))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-k">Add-ons</div>
            <div className="stat-v">
              {addonsN} · {money(addonsN * num(tournament.addOnPrice))}
            </div>
          </div>
        </div>

        {Math.abs(sum - 100) > EPS && (
          <div className="balance balance-off mb-0">
            ⚠ Los porcentajes suman {sum}%. Ajústalos en la pestaña Torneo para que sumen 100%.
          </div>
        )}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>¿Quién ganó cada lugar?</span>
        </p>

        {tournament.payouts.map((po, i) => {
          const place = i + 1
          const winner = players.find((p) => p.tourney.place === place)
          return (
            <div key={i} className="subtle-card">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">
                  {MEDALS[i] || '🎖'} {place}º · {num(po.pct)}% ·{' '}
                  <span className="text-win">{money(payoutAmount(i, players, tournament))}</span>
                </b>
              </div>
              <select
                className="w-full rounded-[9px] border border-paper-line bg-white p-2.5 text-[15px] font-semibold text-ink"
                aria-label={`Jugador en el lugar ${place}`}
                value={winner?.id ?? ''}
                onChange={(e) => assignPlace(place, e.target.value || null)}
              >
                <option value="">— Sin asignar —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Sin nombre'}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Resultado por jugador</span>
        </p>

        <ul className="m-0 mb-3.5 list-none p-0">
          {ranking.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className="flex items-center justify-between border-b border-dashed border-paper-line px-1 py-2.5 font-semibold last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span>{r.place ? MEDALS[r.place - 1] ?? `${r.place}º` : ''}</span>
                <span className="truncate">{r.name}</span>
              </span>
              <span
                className={`font-display font-bold ${
                  r.net > EPS ? 'text-win' : r.net < -EPS ? 'text-loss' : 'text-ink-soft'
                }`}
              >
                {signed(r.net)}
              </span>
            </li>
          ))}
        </ul>

        <ShareBlock plainText={plainText} alt="Resultados del torneo" />
      </section>
    </>
  )
}
