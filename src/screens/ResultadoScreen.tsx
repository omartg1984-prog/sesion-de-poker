import { AlertTriangle, Check } from 'lucide-react'
import Medalla from '../components/Medalla'
import ShareBlock from '../components/ShareBlock'
import { EPS, finalValueOf, investedOf, money, plOf, signed } from '../lib/money'
import { useSession } from '../store/session'

/** Cierre de la partida en cash: cuadre, ranking e imagen para el chat. */
export default function ResultadoScreen() {
  const colors = useSession((s) => s.colors)
  const players = useSession((s) => s.players)
  const sessionName = useSession((s) => s.sessionName)

  const totalInv = players.reduce((a, p) => a + investedOf(p), 0)
  const totalFin = players.reduce((a, p) => a + finalValueOf(p, colors), 0)
  const diff = totalFin - totalInv

  const ranking = players
    .map((p) => ({ name: p.name || 'Sin nombre', pl: plOf(p, colors) }))
    .sort((a, b) => b.pl - a.pl)

  const plainText = () => {
    const lines = [`🃏 ${sessionName || 'Sesión de Póker'}`, '']
    ranking.forEach((r, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i]
      lines.push(`${r.pl > EPS && medalla ? medalla : '•'} ${r.name}: ${signed(r.pl)}`)
    })
    lines.push('', `Total en la mesa: ${money(totalInv)}`)
    return lines.join('\n')
  }

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Resumen de la sesión</span>
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="stat">
          <div className="stat-k">Total en la mesa</div>
          <div className="stat-v">{money(totalInv)}</div>
        </div>
        <div className="stat">
          <div className="stat-k">Fichas contadas</div>
          <div className="stat-v">{money(totalFin)}</div>
        </div>
      </div>

      {totalInv === 0 && totalFin === 0 ? (
        <div className="balance balance-ok">Aún sin datos</div>
      ) : Math.abs(diff) < EPS ? (
        <div className="balance balance-ok">
          <Check size={16} strokeWidth={2.6} />
          Las fichas cuadran con el dinero
        </div>
      ) : diff > 0 ? (
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          Hay {money(diff)} de más en fichas contadas
        </div>
      ) : (
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          Faltan {money(-diff)} en fichas contadas
        </div>
      )}

      <ul className="m-0 mb-3.5 list-none p-0">
        {ranking.map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className="flex items-center justify-between border-b border-dashed border-paper-line px-1 py-2.5 font-semibold last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              {r.pl > EPS && <Medalla lugar={i + 1} />}
              <span className="truncate">{r.name}</span>
            </span>
            <span
              className={`font-display font-bold ${
                r.pl > EPS ? 'text-win' : r.pl < -EPS ? 'text-loss' : 'text-ink-soft'
              }`}
            >
              {signed(r.pl)}
            </span>
          </li>
        ))}
      </ul>

      <ShareBlock plainText={plainText} alt="Tabla de resultados de la sesión" />
    </section>
  )
}
