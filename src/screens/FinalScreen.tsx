import ChipsGrid from '../components/ChipsGrid'
import PlayerHeading from '../components/PlayerHeading'
import { EPS, finalValueOf, investedOf, money, signed } from '../lib/money'
import { useSession } from '../store/session'

/** Conteo final de fichas, con el P/L en vivo. */
export default function FinalScreen() {
  const colors = useSession((s) => s.colors)
  const players = useSession((s) => s.players)
  const setFinalChip = useSession((s) => s.setFinalChip)

  return (
    <>
      {players.map((p, i) => {
        const inv = investedOf(p)
        const fin = finalValueOf(p, colors)
        const pl = fin - inv
        const tone = pl > EPS ? 'bg-win' : pl < -EPS ? 'bg-loss' : 'bg-[#4a5a4f]'

        return (
          <section key={p.id} className="panel">
            <PlayerHeading player={p} index={i} />
            <ChipsGrid colors={colors} chips={p.final} onChange={(key, v) => setFinalChip(p.id, key, v)} />

            <div className="mt-3.5 grid grid-cols-2 items-center gap-2.5 rounded-xl bg-felt-line px-3.5 py-3 text-[#eafff2] min-[421px]:grid-cols-[1fr_1fr_auto]">
              <div>
                <div className="text-[10px] tracking-[.6px] uppercase opacity-70">Invertido</div>
                <div className="font-display text-[17px] font-bold">{money(inv)}</div>
              </div>
              <div>
                <div className="text-[10px] tracking-[.6px] uppercase opacity-70">Fichas al final</div>
                <div className="font-display text-[17px] font-bold">{money(fin)}</div>
              </div>
              <div
                className={`col-span-2 min-w-[96px] justify-self-stretch rounded-[10px] px-3.5 py-2 text-center font-display text-[22px] font-bold text-white min-[421px]:col-span-1 min-[421px]:justify-self-end ${tone}`}
              >
                {signed(pl)}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}
