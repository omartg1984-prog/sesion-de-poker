import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
import { PUNTOS_POR_DEFECTO, puntosDeLaNoche, type EsquemaPuntos } from '../../lib/api'

/*
 * Cómo se reparten los puntos del campeonato, escrito y editable.
 *
 * La fórmula venía metida en el código y nadie de la mesa podía verla —ni discutirla—.
 * Aquí está en palabras, con los cuatro números que la arman y una tabla que enseña al
 * instante cuánto pagaría cada lugar. Cambiarla no reescribe la historia: los puntos se
 * vuelven a contar desde las partidas de siempre, así que toda la tabla de la liga se
 * recalcula con las reglas nuevas.
 */

const CAMPOS = [
  {
    id: 'base' as const,
    label: 'Por presentarte',
    ayuda: 'Lo que suma venir, aunque te vayas en la primera mano.',
  },
  {
    id: 'porJugador' as const,
    label: 'Por cada uno al que le ganas',
    ayuda: 'Es lo que hace que ganarle a siete valga más que ganarle a tres.',
  },
  {
    id: 'bonoGanar' as const,
    label: 'Extra por ganar la noche',
    ayuda: 'Un premio aparte para el primer lugar. En 0 no hay extra.',
  },
  {
    id: 'bonoPodio' as const,
    label: 'Extra por quedar en los tres primeros',
    ayuda: 'Sólo en mesas de más de tres: en una de tres, todos estarían en el podio.',
  },
]

/** Mesas de ejemplo: una chica y una llena, que es entre lo que se mueve una liga. */
const EJEMPLOS = [4, 6, 8]

interface Props {
  abierta: boolean
  esquema: EsquemaPuntos
  soyAdmin: boolean
  onCerrar: () => void
  onGuardar: (e: EsquemaPuntos) => Promise<void> | void
}

export default function Puntos({ abierta, esquema, soyAdmin, onCerrar, onGuardar }: Props) {
  const [valores, setValores] = useState<EsquemaPuntos>(esquema)
  const [ocupado, setOcupado] = useState(false)
  const [mesa, setMesa] = useState(EJEMPLOS[1])

  /* Al abrirla se parte de lo que hay guardado: una edición a medias no reaparece. */
  useEffect(() => {
    if (abierta) setValores(esquema)
  }, [abierta, esquema])

  const cambiado = (Object.keys(valores) as (keyof EsquemaPuntos)[]).some(
    (k) => valores[k] !== esquema[k],
  )
  const comoSiempre = (Object.keys(valores) as (keyof EsquemaPuntos)[]).every(
    (k) => valores[k] === PUNTOS_POR_DEFECTO[k],
  )

  const guardar = async () => {
    if (ocupado) return
    setOcupado(true)
    await onGuardar(valores)
    setOcupado(false)
  }

  const lugares = Array.from({ length: mesa }, (_, i) => i + 1)
  const total = lugares.reduce((s, l) => s + puntosDeLaNoche(l, mesa, valores), 0)

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Cómo se reparten los puntos">
      <p className="mt-0 mb-3 text-[13px] leading-relaxed text-ink-soft">
        El campeonato no cuenta pesos: cuenta a cuánta gente le ganaste. Por eso una noche
        de ocho pesa más que una de cuatro, y por eso venir siempre suma algo aunque te
        vayas temprano. Son cuatro números y los pone la casa.
      </p>

      {CAMPOS.map((c) => (
        <div key={c.id} className="mb-3">
          <span className="field-label">{c.label}</span>
          <p className="mt-0.5 mb-1 text-[12px] leading-snug text-ink-soft">{c.ayuda}</p>
          <div className="field-box">
            <NumInput
              value={valores[c.id]}
              showZero
              aria-label={c.label}
              onChange={(v) => soyAdmin && setValores((x) => ({ ...x, [c.id]: v }))}
            />
          </div>
        </div>
      ))}

      {/* La tabla es el punto de la hoja: los cuatro números por sí solos no dicen cómo
          queda la noche, y aquí se ve al instante al mover cualquiera. */}
      <p className="field-label mt-4 mb-1">Así quedaría una noche</p>
      <div className="mb-2 flex gap-1.5">
        {EJEMPLOS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setMesa(n)}
            className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors ${
              mesa === n ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            {n} en la mesa
          </button>
        ))}
      </div>

      <ul className="m-0 mb-2 list-none p-0">
        {lugares.map((l) => {
          const p = puntosDeLaNoche(l, mesa, valores)
          const ancho = total > 0 ? (p / puntosDeLaNoche(1, mesa, valores)) * 100 : 0
          return (
            <li
              key={l}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
            >
              <span className="w-[62px] shrink-0 text-[12.5px] font-semibold text-ink">
                {l === 1 ? 'Ganador' : l === mesa ? 'Último' : `${l}º lugar`}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${Math.max(3, ancho)}%` }}
                />
              </span>
              <b className="w-9 shrink-0 text-right font-display text-[15px] text-ink tabular-nums">
                {p}
              </b>
            </li>
          )
        })}
      </ul>
      <p className="mt-0 mb-4 text-right text-[11.5px] text-ink-soft">
        Esa noche reparte {total} puntos entre los {mesa}.
      </p>

      {soyAdmin ? (
        <>
          <button
            type="button"
            className="btn btn-marca mb-2 disabled:opacity-45"
            disabled={ocupado || !cambiado}
            onClick={() => void guardar()}
          >
            <Check size={17} strokeWidth={2.6} />
            Guardar y recalcular la tabla
          </button>
          {cambiado && (
            <p className="mt-0 mb-2 text-center text-[12px] leading-snug text-ink-soft">
              La tabla entera se vuelve a contar con estas reglas, también las partidas
              viejas.
            </p>
          )}
          {!comoSiempre && (
            <button
              type="button"
              className="btn btn-ghost mb-2"
              onClick={() => setValores(PUNTOS_POR_DEFECTO)}
            >
              <RotateCcw size={16} strokeWidth={2.4} />
              Volver a los puntos de siempre
            </button>
          )}
        </>
      ) : (
        <p className="mt-0 mb-2 text-center text-[12.5px] text-ink-soft">
          Sólo un admin de la liga puede cambiarlos.
        </p>
      )}
    </Sheet>
  )
}
