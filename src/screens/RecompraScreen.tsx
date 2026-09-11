import { Plus, X } from 'lucide-react'
import ChipsGrid from '../components/ChipsGrid'
import MoneyInput from '../components/MoneyInput'
import PlayerHeading from '../components/PlayerHeading'
import { chipValue, investedOf, money } from '../lib/money'
import { useSession } from '../store/session'

/** Las recompras de cada jugador durante la partida. */
export default function RecompraScreen() {
  const colors = useSession((s) => s.colors)
  const players = useSession((s) => s.players)
  const addRecompra = useSession((s) => s.addRecompra)
  const removeRecompra = useSession((s) => s.removeRecompra)
  const setRecompraMoney = useSession((s) => s.setRecompraMoney)
  const setRecompraChip = useSession((s) => s.setRecompraChip)

  return (
    <>
      {players.map((p, i) => (
        <section key={p.id} className="panel">
          <PlayerHeading player={p} index={i} />

          {p.recompras.length === 0 && (
            <p className="mt-0 mb-2.5 text-[13px] text-ink-soft">Sin recompras todavía.</p>
          )}

          {p.recompras.map((r, ri) => {
            const v = chipValue(r.chips, colors)
            return (
              <div key={ri} className="subtle-card">
                <div className="mb-2 flex items-center justify-between">
                  <b className="text-xs tracking-[.5px] uppercase">Recompra {ri + 1}</b>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger h-[26px] w-[26px] text-[13px]"
                    aria-label={`Quitar recompra ${ri + 1}`}
                    onClick={() => removeRecompra(p.id, ri)}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
                <MoneyInput
                  label="Dinero"
                  value={r.money}
                  onChange={(x) => setRecompraMoney(p.id, ri, x)}
                />
                <ChipsGrid
                  colors={colors}
                  chips={r.chips}
                  onChange={(key, x) => setRecompraChip(p.id, ri, key, x)}
                />
                {v > 0 && (
                  <p className="mt-2 mb-0 text-right text-xs text-ink-soft">
                    En fichas: <b className="text-ink">{money(v)}</b>
                  </p>
                )}
              </div>
            )
          })}

          <button
            type="button"
            className="btn-dashed flex items-center justify-center gap-1.5"
            onClick={() => addRecompra(p.id)}
          >
            <Plus size={15} strokeWidth={2.6} />
            Agregar recompra
          </button>

          <p className="mt-2.5 mb-0 text-right text-xs text-ink-soft">
            Invertido total: <b className="text-ink">{money(investedOf(p))}</b>
          </p>
        </section>
      ))}
    </>
  )
}
