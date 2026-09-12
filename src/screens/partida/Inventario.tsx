import { AlertTriangle, Check } from 'lucide-react'
import Chip from '../../components/Chip'
import { EPS, money } from '../../lib/money'
import type { Cuadre } from './cuadre'

/** Las fichas que salieron contra las que volvieron, y el dinero que entró contra el que salió. */
export default function Inventario({ cuadre }: { cuadre: Cuadre }) {
  const { fichas, fichasCuadran, recaudado, pagado, enLaMesa, pagadoDeMas } = cuadre

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Inventario de la noche</span>
      </p>
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Las fichas que salieron tienen que volver todas. Si falta o sobra alguna, el conteo
        está mal y la partida no se puede cerrar.
      </p>

      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
              <th className="px-1 pb-2 font-semibold">Ficha</th>
              <th className="px-1 pb-2 text-right font-semibold">Salieron</th>
              <th className="px-1 pb-2 text-right font-semibold">Volvieron</th>
            </tr>
          </thead>
          <tbody>
            {fichas.map((f) => (
              <tr key={f.color.key} className="border-t border-dashed border-paper-line">
                <td className="px-1 py-2">
                  <span className="flex items-center gap-2">
                    <Chip color={f.color} size={22} />
                    <span className="truncate font-semibold text-ink">
                      {f.color.label || 'Sin nombre'}
                    </span>
                  </span>
                </td>
                <td className="px-1 py-2 text-right text-ink-soft">{f.entregadas}</td>
                <td className="px-1 py-2 text-right">
                  <span className={`font-semibold ${f.dif === 0 ? 'text-ink' : 'text-loss'}`}>
                    {f.contadas}
                  </span>
                  {f.dif !== 0 && (
                    <span className="block text-[11px] font-semibold text-loss">
                      {f.dif > 0 ? '+' : '−'}
                      {Math.abs(f.dif)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fichasCuadran ? (
        <div className="balance balance-ok mt-3 mb-3">
          <Check size={16} strokeWidth={2.6} />
          Volvieron todas las fichas
        </div>
      ) : (
        <div className="balance balance-off mt-3 mb-3">
          <AlertTriangle size={16} strokeWidth={2.4} />
          Faltan fichas por contar o hay de más
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="stat">
          <div className="stat-k">Entró a la mesa</div>
          <div className="stat-v">{money(recaudado)}</div>
        </div>
        <div className="stat">
          <div className="stat-k">Ya se pagó</div>
          <div className="stat-v">{money(pagado)}</div>
        </div>
      </div>

      {pagadoDeMas ? (
        <div className="balance balance-off mt-3 mb-0">
          <AlertTriangle size={16} strokeWidth={2.4} />
          Se repartieron {money(-enLaMesa)} más de los que entraron
        </div>
      ) : (
        Math.abs(enLaMesa) > EPS && (
          <p className="mt-2.5 mb-0 text-center text-[12px] text-ink-soft">
            Quedan <b className="text-ink">{money(enLaMesa)}</b> sin repartir. Se puede cerrar
            así: casi siempre es lo que no se pudo partir en billetes.
          </p>
        )
      )}
    </section>
  )
}
