import { Plus } from 'lucide-react'
import ChipsGrid from '../components/ChipsGrid'
import MoneyInput from '../components/MoneyInput'
import PlayerHeading from '../components/PlayerHeading'
import { chipValue, money } from '../lib/money'
import { useSession } from '../store/session'

/** Cuánto puso cada jugador al entrar y con qué fichas. */
export default function EntradaScreen() {
  const colors = useSession((s) => s.colors)
  const players = useSession((s) => s.players)
  const setEntradaMoney = useSession((s) => s.setEntradaMoney)
  const setEntradaChip = useSession((s) => s.setEntradaChip)
  const addPlayer = useSession((s) => s.addPlayer)

  return (
    <>
      {players.map((p, i) => {
        const v = chipValue(p.entrada.chips, colors)
        return (
          <section key={p.id} className="panel">
            <PlayerHeading player={p} index={i} editable />
            <MoneyInput
              label="Dinero"
              value={p.entrada.money}
              onChange={(x) => setEntradaMoney(p.id, x)}
            />
            <ChipsGrid
              colors={colors}
              chips={p.entrada.chips}
              onChange={(key, x) => setEntradaChip(p.id, key, x)}
            />
            {v > 0 && (
              <p className="mt-2 mb-0 text-right text-xs text-ink-soft">
                En fichas: <b className="text-ink">{money(v)}</b>
              </p>
            )}
          </section>
        )
      })}

      <button type="button" className="btn btn-gold" onClick={addPlayer}>
        <Plus size={18} strokeWidth={2.6} />
        Agregar jugador
      </button>
    </>
  )
}
