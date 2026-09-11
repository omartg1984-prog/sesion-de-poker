import PlayerHeading from '../components/PlayerHeading'
import Stepper from '../components/Stepper'
import { money, paidOf, poolOf } from '../lib/money'
import { useSession } from '../store/session'

/** Quiénes juegan, cuántas recompras y add-ons llevan, y la bolsa en vivo. */
export default function TorneoJugadoresScreen() {
  const players = useSession((s) => s.players)
  const tournament = useSession((s) => s.tournament)
  const setTourneyCount = useSession((s) => s.setTourneyCount)
  const addPlayer = useSession((s) => s.addPlayer)

  return (
    <>
      <div className="mb-3.5 rounded-xl bg-gradient-to-br from-[#0f6b3f] to-[#0a4a2b] px-4 py-3.5 text-center text-gold-soft shadow-[0_6px_16px_rgba(0,0,0,.2)]">
        <div className="text-xs tracking-[1px] text-mint uppercase opacity-85">Bolsa acumulada</div>
        <div className="mt-0.5 font-display text-[34px] font-bold" aria-live="polite">
          {money(poolOf(players, tournament))}
        </div>
      </div>

      {players.map((p, i) => (
        <section key={p.id} className="panel">
          <PlayerHeading player={p} index={i} editable />

          <div className="mb-3 flex items-center justify-between gap-2.5">
            <span className="text-sm font-semibold text-ink-soft">Recompras</span>
            <Stepper
              label="recompra"
              value={p.tourney.rebuys}
              onChange={(v) => setTourneyCount(p.id, 'rebuys', v)}
            />
          </div>

          <div className="mb-3 flex items-center justify-between gap-2.5">
            <span className="text-sm font-semibold text-ink-soft">Add-ons</span>
            <Stepper
              label="add-on"
              value={p.tourney.addons}
              onChange={(v) => setTourneyCount(p.id, 'addons', v)}
            />
          </div>

          <p className="m-0 text-right text-xs text-ink-soft">
            Pagó: <b className="text-ink">{money(paidOf(p, tournament))}</b>
          </p>
        </section>
      ))}

      <button type="button" className="btn btn-gold" onClick={addPlayer}>
        ＋ Agregar jugador
      </button>
    </>
  )
}
