import { Minus, Plus } from 'lucide-react'
import Chip from './Chip'
import NumInput from './NumInput'
import { money, num } from '../lib/money'
import type { ChipColor, Chips } from '../store/types'

interface Props {
  colores: ChipColor[]
  fichas: Chips
  onChange: (colorKey: string, cantidad: number) => void
  deshabilitado?: boolean
}

/**
 * Contador de fichas para el cierre de la partida.
 *
 * Es la pantalla que más se sufre: se cuenta a mano, de noche y con prisa. Por eso
 * una fila por color en vez de una rejilla apretada:
 *  - los botones −/+ son grandes, para ir sumando mientras apilas;
 *  - el número también se teclea, que para 14 fichas es más rápido que tocar 14 veces;
 *  - cada fila muestra cuánto vale ese montón, así un error se ve al momento y no
 *    hasta el final, cuando ya no sabes de dónde salió.
 */
export default function ContadorFichas({ colores, fichas, onChange, deshabilitado = false }: Props) {
  return (
    <ul className="m-0 list-none p-0">
      {colores.map((c) => {
        const cantidad = num(fichas[c.key])
        const vale = cantidad * num(c.value)
        return (
          <li
            key={c.key}
            className="flex items-center gap-2 border-b border-dashed border-paper-line py-2 last:border-b-0"
          >
            <Chip color={c} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.label}</span>

            <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-paper-line bg-white">
              <button
                type="button"
                disabled={deshabilitado || cantidad === 0}
                aria-label={`Una ficha ${c.label} menos`}
                onClick={() => onChange(c.key, Math.max(0, cantidad - 1))}
                className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-ink/6 text-ink active:scale-90 disabled:opacity-30"
              >
                <Minus size={16} strokeWidth={3} />
              </button>

              <NumInput
                value={cantidad}
                showZero
                aria-label={`Fichas ${c.label}`}
                className="w-12 border-none bg-transparent py-2 text-center font-display text-lg font-bold text-ink outline-none disabled:opacity-60"
                onChange={(v) => !deshabilitado && onChange(c.key, v)}
              />

              <button
                type="button"
                disabled={deshabilitado}
                aria-label={`Una ficha ${c.label} más`}
                onClick={() => onChange(c.key, cantidad + 1)}
                className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-ink/6 text-ink active:scale-90 disabled:opacity-30"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
            </div>

            <span
              className={`w-[68px] shrink-0 text-right font-display text-sm font-bold tabular-nums ${
                vale > 0 ? 'text-ink' : 'text-ink-soft/35'
              }`}
            >
              {money(vale)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
