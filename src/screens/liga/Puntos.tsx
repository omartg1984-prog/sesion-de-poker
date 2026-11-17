import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
import { signed } from '../../lib/money'
import {
  PESOS_POR_PUNTO,
  PESOS_SUGERIDOS,
  PUNTOS_POR_DEFECTO,
  puntosDeLaTemporada,
  type EsquemaPuntos,
} from '../../lib/api'

/*
 * Cómo se reparten los puntos del campeonato, escrito y con dos perillas.
 *
 * Esta hoja era una lista de diez consideraciones que se encendían y se tasaban una por
 * una, con tope del dinero, tabla por lugar, descarte de noches y tres esquemas de
 * fábrica. Todo eso se fue: la liga puntúa con una sola fórmula —el saldo de la
 * temporada más la gente a la que le ganaste— y aquí sólo se decide cuánto pesa el
 * dinero y qué tanto hay que venir para coronarse.
 *
 * Cambiarlo no reescribe la historia: los puntos se vuelven a contar desde las partidas
 * de siempre, así que toda la tabla se recalcula con el número nuevo.
 */

/*
 * Tres temporadas de ejemplo para ver el efecto de la perilla.
 *
 * Están puestas a propósito como los tres casos que se discuten en la mesa: el que no
 * se pierde una y acaba tablas, el que viene tres veces y arrasa, y el de en medio. Con
 * el punto barato gana el que arrasa; con el punto caro, el que no falta.
 */
const EJEMPLOS = [
  { quien: 'No se pierde una', noches: 8, saldo: -200, vencidos: 40 },
  { quien: 'Viene y arrasa', noches: 3, saldo: 2400, vencidos: 18 },
  { quien: 'El de en medio', noches: 6, saldo: 600, vencidos: 26 },
]

interface Props {
  abierta: boolean
  esquema: EsquemaPuntos
  soyAdmin: boolean
  onCerrar: () => void
  onGuardar: (e: EsquemaPuntos) => Promise<void> | void
}

export default function Puntos({ abierta, esquema, soyAdmin, onCerrar, onGuardar }: Props) {
  const [pesos, setPesos] = useState(esquema.pesosPorPunto)
  const [minNoches, setMinNoches] = useState(esquema.minimoNoches)
  const [aMano, setAMano] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  /* Al abrirla se parte de lo que hay guardado: una edición a medias no reaparece. */
  useEffect(() => {
    if (abierta) {
      setPesos(esquema.pesosPorPunto)
      setMinNoches(esquema.minimoNoches)
      setAMano(!PESOS_SUGERIDOS.includes(esquema.pesosPorPunto))
    }
  }, [abierta, esquema])

  const actual: EsquemaPuntos = {
    pesosPorPunto: pesos > 0 ? pesos : PESOS_POR_PUNTO,
    minimoNoches: Math.max(0, minNoches),
  }
  const igualA = (e: EsquemaPuntos) => JSON.stringify(actual) === JSON.stringify(e)
  const comoEstaba = igualA(esquema)
  const comoSiempre = igualA(PUNTOS_POR_DEFECTO)

  const guardar = async () => {
    if (ocupado) return
    setOcupado(true)
    await onGuardar(actual)
    setOcupado(false)
  }

  const cuentas = EJEMPLOS.map((e) => ({
    ...e,
    porSaldo: e.saldo / actual.pesosPorPunto,
    total: puntosDeLaTemporada(e.saldo, e.vencidos, actual),
  }))
  const mayor = Math.max(1, ...cuentas.map((c) => Math.abs(c.total)))
  const lider = cuentas.reduce((a, b) => (b.total > a.total ? b : a))

  const ayudaMinimo =
    actual.minimoNoches === 0
      ? 'Sin mínimo: campeón es el de más puntos, aunque haya venido una sola vez.'
      : `El que no haya venido a ${actual.minimoNoches} ${
          actual.minimoNoches === 1 ? 'noche' : 'noches'
        } suma puntos y sale en la tabla, pero no sube al podio. Si el mínimo deja a todos fuera no se aplica: un podio vacío no es más justo, es una pantalla rota.`

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Cómo se reparten los puntos">
      <p className="mt-0 mb-3 text-[13px] leading-relaxed text-ink-soft">
        Una sola cuenta, la misma para todos, y se puede repetir de memoria:
      </p>

      <div className="mb-3 rounded-xl bg-ink/6 px-3 py-3 text-center">
        <b className="block text-[14px] leading-snug text-ink">
          Tu saldo de la temporada entre {actual.pesosPorPunto}
        </b>
        <span className="my-0.5 block text-[12px] text-ink-soft">más</span>
        <b className="block text-[14px] leading-snug text-ink">
          a cuántos les ganaste en todas las noches
        </b>
      </div>

      <p className="mt-0 mb-4 text-[12.5px] leading-snug text-ink-soft">
        Los vencidos se cuentan noche por noche: en una mesa de quince, quedar sexto son nueve
        puntos. El dinero entra una sola vez, sobre el saldo de todo el semestre, así que la noche
        del palazo no se come la temporada. Al final se redondea a entero, y el desempate sigue
        siendo por saldo.
      </p>

      <p className="field-label mt-0 mb-1.5">Cuánto vale un punto</p>
      <div className="mb-1.5 flex gap-1.5">
        {PESOS_SUGERIDOS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={!soyAdmin}
            aria-pressed={!aMano && pesos === p}
            onClick={() => {
              setAMano(false)
              setPesos(p)
            }}
            className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors disabled:cursor-default ${
              !aMano && pesos === p ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            ${p}
          </button>
        ))}
        <button
          type="button"
          disabled={!soyAdmin}
          aria-pressed={aMano}
          onClick={() => setAMano(true)}
          className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors disabled:cursor-default ${
            aMano ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
          }`}
        >
          Otro
        </button>
      </div>

      {aMano && (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="shrink-0 text-[11.5px] text-ink-soft">Un punto cada</span>
          <div className="field-box flex-1">
            <NumInput
              value={pesos}
              showZero
              mode="decimal"
              aria-label="Cuántos pesos vale un punto"
              onChange={(v) => soyAdmin && setPesos(Math.max(0, v))}
            />
          </div>
          <span className="shrink-0 text-[11.5px] text-ink-soft">pesos</span>
        </div>
      )}

      <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
        Es la única perilla del dinero y mueve el campeonato entero. Barato el punto, manda la
        caja; caro, manda venir y ganarle a gente.
      </p>

      {/* El punto de la hoja: el número por sí solo no dice nada, y aquí se ve al
          instante a quién le conviene moverlo. */}
      <p className="field-label mt-0 mb-1">Así quedaría una temporada</p>
      <ul className="m-0 mb-1.5 list-none p-0">
        {cuentas.map((c) => (
          <li
            key={c.quien}
            className="border-b border-dashed border-paper-line py-2 last:border-b-0"
          >
            <div className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] text-ink">{c.quien}</b>
                <span className="block text-[11px] leading-snug text-ink-soft">
                  {c.noches} {c.noches === 1 ? 'noche' : 'noches'} · {signed(c.saldo)} ·{' '}
                  {c.vencidos} vencidos
                </span>
              </span>
              <b className="w-10 shrink-0 text-right font-display text-[17px] tabular-nums text-ink">
                {c.total}
              </b>
            </div>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink/10">
              <span
                className={`block h-full rounded-full ${
                  c.total < 0 ? 'bg-loss' : c.quien === lider.quien ? 'bg-marca' : 'bg-ink/35'
                }`}
                style={{ width: `${Math.max(3, (Math.abs(c.total) / mayor) * 100)}%` }}
              />
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">
              {c.vencidos} vencidos {c.porSaldo < 0 ? '−' : '+'}{' '}
              {Math.abs(c.porSaldo).toFixed(1)} del dinero
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-0 mb-4 text-[12px] leading-snug text-ink-soft">
        Con el punto en ${actual.pesosPorPunto}, de estos tres se corona{' '}
        <b className="text-ink">{lider.quien.toLowerCase()}</b>.
      </p>

      {/*
        Esto no cambia lo que suma nadie, sino a quién se puede coronar. Lo que resuelve
        es el viernes de suerte —dos noches, dos palazos— que de otro modo se lleva una
        temporada entera.
      */}
      <p className="field-label mt-0 mb-1.5">Noches mínimas para el podio</p>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="shrink-0 text-[11.5px] text-ink-soft">Hay que venir a</span>
        <div className="field-box flex-1">
          <NumInput
            value={minNoches}
            showZero
            mode="decimal"
            aria-label="A cuántas noches hay que haber venido para el podio"
            onChange={(v) => soyAdmin && setMinNoches(Math.max(0, v))}
          />
        </div>
        <span className="shrink-0 text-[11.5px] text-ink-soft">
          {minNoches === 1 ? 'noche' : 'noches'}
        </span>
      </div>
      <p className="mt-0 mb-4 text-[12px] leading-snug text-ink-soft">{ayudaMinimo}</p>

      {soyAdmin ? (
        <>
          <button
            type="button"
            className="btn btn-marca mb-2 disabled:opacity-45"
            disabled={ocupado || comoEstaba}
            onClick={() => void guardar()}
          >
            <Check size={17} strokeWidth={2.6} />
            Guardar y recalcular la tabla
          </button>
          {!comoEstaba && (
            <p className="mt-0 mb-2 text-center text-[12px] leading-snug text-ink-soft">
              La tabla entera se vuelve a contar, también las partidas viejas.
            </p>
          )}
          {!comoSiempre && (
            <button
              type="button"
              className="btn btn-ghost mb-2"
              onClick={() => {
                setPesos(PUNTOS_POR_DEFECTO.pesosPorPunto)
                setMinNoches(PUNTOS_POR_DEFECTO.minimoNoches)
                setAMano(false)
              }}
            >
              <RotateCcw size={16} strokeWidth={2.4} />
              Volver a ${PESOS_POR_PUNTO} el punto y sin mínimo
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
