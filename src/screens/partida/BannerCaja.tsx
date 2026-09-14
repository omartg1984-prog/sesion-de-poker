import { AlertTriangle } from 'lucide-react'
import { money } from '../../lib/money'
import type { CajaEnDinero } from '../../lib/distribution'

/*
 * Cuánto dinero le queda a la caja de fichas, pegado bajo la barra.
 *
 * Es la cuenta que se hace en la mesa cuando alguien pide una recompra o llega uno más:
 * no "cuántas fichas quedan" sino "¿alcanza para darle $500?". Va fijo arriba porque se
 * pregunta mientras se captura, con la lista de jugadores a medio scroll, y bajar hasta
 * el inventario para verlo es justo lo que nadie hace.
 */
export default function BannerCaja({ caja }: { caja: CajaEnDinero }) {
  const sinNada = caja.queda <= 0

  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-black/25 px-3 py-1.5">
      <span className="shrink-0 text-[10px] font-bold tracking-[.5px] text-white/70 uppercase">
        {sinNada ? 'Sin fichas' : 'Quedan'}
      </span>
      <b
        className={`font-display text-[17px] tabular-nums ${
          sinNada ? 'text-marca-alta' : 'text-white'
        }`}
      >
        {money(caja.queda)}
      </b>
      {sinNada && <AlertTriangle size={14} strokeWidth={2.6} className="shrink-0 text-marca-alta" />}
      <span className="ml-auto shrink-0 text-[11px] text-white/70">
        de {money(caja.total)} en fichas
      </span>
    </div>
  )
}
