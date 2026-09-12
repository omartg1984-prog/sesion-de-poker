import { Check } from 'lucide-react'
import Chip from '../../components/Chip'
import type { Cuadre } from './cuadre'

/*
 * Cuántas fichas de cada color faltan por aparecer, pegado bajo la barra.
 *
 * Durante el cash out se cuenta jugador por jugador y hay que bajar hasta el final para
 * saber qué falta. Con esto se ve sin moverse: cada color con lo que queda por contar, y
 * en verde cuando ya volvieron todas.
 */
export default function BannerFichas({ cuadre }: { cuadre: Cuadre }) {
  const pendientes = cuadre.fichas.filter((f) => f.dif !== 0)

  if (pendientes.length === 0) {
    return (
      /* El banner vive dentro de la barra roja, así que el verde del texto se hunde:
         sobre rojo sólo aguanta el blanco. La palomita sí puede ir verde. */
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-black/25 py-1.5 text-[12px] font-bold text-white">
        <Check size={13} strokeWidth={3} className="text-win-alto" />
        Volvieron todas las fichas
      </div>
    )
  }

  return (
    <div className="no-scrollbar mt-2 flex items-center gap-2.5 overflow-x-auto rounded-lg bg-black/25 px-2.5 py-1.5">
      <span className="shrink-0 text-[10px] font-bold tracking-[.5px] text-white/70 uppercase">
        Faltan
      </span>
      {pendientes.map((f) => (
        <span key={f.color.key} className="flex shrink-0 items-center gap-1">
          <Chip color={f.color} size={18} />
          <b
            className={`font-display text-[15px] tabular-nums ${
              /* De más es un error distinto a de menos: no se puede seguir contando
                 para arreglarlo, hay que revisar lo ya capturado. */
              f.dif > 0 ? 'text-marca-alta' : 'text-white'
            }`}
          >
            {f.dif > 0 ? `+${f.dif}` : -f.dif}
          </b>
        </span>
      ))}
    </div>
  )
}
