import { Check, HandCoins } from 'lucide-react'
import { EPS, money } from '../../lib/money'

/*
 * La feria que queda sobre la mesa, pegada bajo la barra.
 *
 * Es la pregunta del final de la noche —"¿ya quedamos o todavía hay dinero ahí?"— y
 * vivía hasta el fondo del reparto, debajo de la tabla de pagos: para verla había que
 * bajar toda la pantalla, y se consulta justo mientras se está pagando. Aquí se queda a
 * la vista sin moverse, igual que las fichas que faltan por contar.
 *
 * Entregar de más es otro problema que entregar de menos: no se arregla siguiendo, hay
 * que revisar lo ya apuntado. Por eso va en otro color y con otras palabras.
 */
export default function BannerFeria({ queda }: { queda: number }) {
  if (Math.abs(queda) < EPS) {
    return (
      /* El banner vive dentro de la barra roja, así que el verde del texto se hunde:
         sobre rojo sólo aguanta el blanco. La palomita sí puede ir verde. */
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-black/25 py-1.5 text-[12px] font-bold text-white">
        <Check size={13} strokeWidth={3} className="text-win-alto" />
        Se repartió todo: no queda feria en la mesa
      </div>
    )
  }

  const deMas = queda < 0
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-1.5">
      <HandCoins size={15} strokeWidth={2.4} className="shrink-0 text-white/70" />
      <span className="shrink-0 text-[10px] font-bold tracking-[.5px] text-white/70 uppercase">
        {deMas ? 'Se entregó de más' : 'Queda en la mesa'}
      </span>
      <b
        className={`ml-auto font-display text-[19px] tabular-nums ${
          deMas ? 'text-marca-alta' : 'text-white'
        }`}
      >
        {money(Math.abs(queda))}
      </b>
    </div>
  )
}
