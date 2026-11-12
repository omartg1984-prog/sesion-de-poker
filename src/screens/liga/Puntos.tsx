import { BookOpen, Check, Plus, RotateCcw, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
import {
  CONSIDERACIONES,
  DEL_DINERO,
  PUNTOS_CONTRA_LA_MESA,
  PUNTOS_DEL_REGLAMENTO,
  PUNTOS_POR_DEFECTO,
  puntosDeLaNoche,
  type EsquemaPuntos,
} from '../../lib/api'

/*
 * Cómo se reparten los puntos del campeonato, escrito y editable.
 *
 * La fórmula venía metida en el código y nadie de la mesa podía verla —ni discutirla—.
 * Aquí está en palabras, como una lista de consideraciones que la casa enciende, apaga y
 * tasa, más una tabla de puntos por lugar para quien la prefiera así. Cambiarla no
 * reescribe la historia: los puntos se vuelven a contar desde las partidas de siempre,
 * así que toda la tabla se recalcula con las reglas nuevas.
 */

/** Mesas de ejemplo: entre esto se mueve una liga de casa. */
const EJEMPLOS = [4, 6, 8]

/** Más lugares que esto en una tabla ya no los llena nadie. */
const MAX_LUGARES = 12

/*
 * Cuánto hay que haber venido para poder ser campeón.
 *
 * En por ciento y no en noches porque las temporadas no miden lo mismo: "la mitad" son
 * cuatro de siete en una temporada de siete y nueve de dieciocho en una de dieciocho, y
 * la liga no tiene que volver a tocar esto cada vez.
 */
/*
 * Cuántas noches cuentan para el campeonato.
 *
 * En por ciento por lo mismo que el mínimo del podio: una temporada de siete noches y
 * una de dieciocho no se miden con el mismo número, y así la liga no tiene que volver a
 * tocar esto cada semestre.
 */
const DESCARTES = [
  {
    valor: 0,
    corto: 'Todas',
    ayuda: 'Cuentan todas tus noches, las buenas y las malas. Es como ha funcionado siempre.',
  },
  {
    valor: 80,
    corto: 'Mejores 80%',
    ayuda:
      'Se te cae tu peor noche de cada cinco. En una temporada de siete cuentan seis. Ojo: sólo le quita noches a los que vienen mucho, porque al que vino tres veces no le sobra ninguna.',
  },
  {
    valor: 60,
    corto: 'Mejores 60%',
    ayuda:
      'Cuentan poco más de la mitad de las noches de la temporada. Premia fuerte las noches buenas y perdona casi todo lo demás.',
  },
]

const MINIMOS = [
  {
    valor: 0,
    corto: 'Sin mínimo',
    ayuda: 'Como siempre: campeón es el de más puntos, aunque haya venido una sola vez.',
  },
  {
    valor: 33,
    corto: 'Un tercio',
    ayuda:
      'Para subir al podio hay que haber venido a un tercio de las noches. Los demás suman puntos y salen en la tabla, pero no se coronan.',
  },
  {
    valor: 50,
    corto: 'La mitad',
    ayuda:
      'Para subir al podio hay que haber venido a la mitad de las noches. Así una racha de dos viernes no desplaza a quien no se ha perdido una.',
  },
]

const ordinal = (l: number) => `${l}º`

interface Props {
  abierta: boolean
  esquema: EsquemaPuntos
  soyAdmin: boolean
  onCerrar: () => void
  onGuardar: (e: EsquemaPuntos) => Promise<void> | void
}

export default function Puntos({ abierta, esquema, soyAdmin, onCerrar, onGuardar }: Props) {
  const [reglas, setReglas] = useState(esquema.reglas)
  const [tabla, setTabla] = useState<number[]>(esquema.tabla ?? [])
  const [minimo, setMinimo] = useState(esquema.minimoPodio ?? 0)
  const [tope, setTope] = useState(esquema.topeDinero ?? 0)
  const [mejores, setMejores] = useState(esquema.mejoresNoches ?? 0)
  const [descarta, setDescarta] = useState(esquema.descartaNoches ?? 0)
  const [minNoches, setMinNoches] = useState(esquema.minimoNoches ?? 0)
  const [ocupado, setOcupado] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [mesa, setMesa] = useState(EJEMPLOS[1])

  /* Al abrirla se parte de lo que hay guardado: una edición a medias no reaparece. */
  useEffect(() => {
    if (abierta) {
      setReglas(esquema.reglas)
      setTabla(esquema.tabla ?? [])
      setMinimo(esquema.minimoPodio ?? 0)
      setTope(esquema.topeDinero ?? 0)
      setMejores(esquema.mejoresNoches ?? 0)
      setDescarta(esquema.descartaNoches ?? 0)
      setMinNoches(esquema.minimoNoches ?? 0)
      setAgregando(false)
    }
  }, [abierta, esquema])

  /* El tope sólo tiene sentido si hay algo que recortar. */
  const hayDinero = reglas.some((r) => DEL_DINERO.indexOf(r.id) >= 0)

  /* Una tabla vacía y una tabla ausente son lo mismo, así que se comparan igualadas. */
  const sinVacios = (e: EsquemaPuntos): EsquemaPuntos => ({
    reglas: e.reglas,
    ...(e.tabla && e.tabla.length > 0 ? { tabla: e.tabla } : {}),
    ...(e.minimoPodio ? { minimoPodio: e.minimoPodio } : {}),
    ...(e.topeDinero ? { topeDinero: e.topeDinero } : {}),
    ...(e.mejoresNoches ? { mejoresNoches: e.mejoresNoches } : {}),
    ...(e.descartaNoches ? { descartaNoches: e.descartaNoches } : {}),
    ...(e.minimoNoches ? { minimoNoches: e.minimoNoches } : {}),
  })
  const actual = sinVacios({
    reglas,
    tabla,
    /* El tope no se guarda si no hay ninguna consideración de dinero que recortar: un
       número suelto que no hace nada sólo confunde al que abra esto en seis meses. */
    topeDinero: hayDinero ? tope : 0,
    /* Sólo viaja la forma elegida: guardar las dos dejaría una apagada esperando a
       confundir a quien abra esto el semestre que viene. */
    mejoresNoches: descarta > 0 ? 0 : mejores,
    descartaNoches: descarta,
    minimoPodio: minNoches > 0 ? 0 : minimo,
    minimoNoches: minNoches,
  })
  const igualA = (e: EsquemaPuntos) => JSON.stringify(actual) === JSON.stringify(sinVacios(e))
  const comoEstaba = igualA(esquema)
  const comoSiempre = igualA(PUNTOS_POR_DEFECTO)
  const comoElReglamento = igualA(PUNTOS_DEL_REGLAMENTO)
  const comoContraLaMesa = igualA(PUNTOS_CONTRA_LA_MESA)
  const disponibles = CONSIDERACIONES.filter((c) => !reglas.some((r) => r.id === c.id))

  const guardar = async () => {
    if (ocupado) return
    setOcupado(true)
    await onGuardar(actual)
    setOcupado(false)
  }

  /** Deja puesto un esquema completo, con todo lo que trae y sin nada de lo que no. */
  const usar = (e: EsquemaPuntos) => {
    setReglas(e.reglas.map((r) => ({ ...r })))
    setTabla([...(e.tabla ?? [])])
    setMinimo(e.minimoPodio ?? 0)
    setTope(e.topeDinero ?? 0)
    setMejores(e.mejoresNoches ?? 0)
    setDescarta(e.descartaNoches ?? 0)
    setMinNoches(e.minimoNoches ?? 0)
    setAgregando(false)
  }

  /*
   * La tabla de ejemplo sólo puede pintar lo que depende del lugar. Lo demás —salir
   * ganando, no recomprar— no se sabe por puesto, así que se lista aparte en vez de
   * meterlo en un número que sería mentira.
   */
  const porLugar = reglas.filter((r) => CONSIDERACIONES.find((c) => c.id === r.id)?.porLugar)
  const aparte = reglas.filter((r) => !CONSIDERACIONES.find((c) => c.id === r.id)?.porLugar)
  const esquemaDeLugar: EsquemaPuntos =
    tabla.length > 0 ? { reglas: porLugar, tabla } : { reglas: porLugar }

  /* Un guardado de otra versión puede traer un por ciento que no es ninguno de los
     tres; se resalta el más cercano en vez de dejar los tres apagados. */
  const elMinimo = MINIMOS.reduce((a, b) =>
    Math.abs(b.valor - minimo) < Math.abs(a.valor - minimo) ? b : a,
  )
  const elDescarte = DESCARTES.reduce((a, b) =>
    Math.abs(b.valor - mejores) < Math.abs(a.valor - mejores) ? b : a,
  )
  /* Las dos formas de decir lo mismo: en por ciento, que se acomoda solo cuando la
     temporada se alarga, o en noches, que es como se dice en la mesa. */
  const porNoches = descarta > 0
  const minPorNoches = minNoches > 0

  /* Las ayudas de las dos formas en noches se arman aquí y no en el renglón: con el
     plural y el cero metidos ahí abajo, el JSX se volvía ilegible. */
  const ayudaDescarte =
    descarta === 0
      ? 'En cero no se descarta ninguna: cuentan todas.'
      : `A cada quien se le ${
          descarta === 1 ? 'cae su peor noche' : `caen sus ${descarta} peores noches`
        } de la temporada. Al que vino poco no le quitan nada, porque no le sobran.`

  const ayudaMinimo =
    minNoches === 0
      ? 'En cero no se pide nada: cualquiera puede coronarse.'
      : `El que no haya venido a ${minNoches} ${
          minNoches === 1 ? 'noche' : 'noches'
        } suma puntos y sale en la tabla, pero no sube al podio. A diferencia del por ciento, esto no se mueve aunque la temporada se alargue.`

  const lugares = Array.from({ length: mesa }, (_, i) => i + 1)
  const deLugar = (l: number) =>
    puntosDeLaNoche({ lugar: l, deCuantos: mesa, resultado: 0, recompras: 0 }, esquemaDeLugar)
  const topes = lugares.map(deLugar)
  const mayor = Math.max(1, ...topes.map(Math.abs))
  const total = topes.reduce((a, b) => a + b, 0)

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Cómo se reparten los puntos">
      <p className="mt-0 mb-3 text-[13px] leading-relaxed text-ink-soft">
        El campeonato no cuenta pesos: cuenta cómo quedaste. Venir siempre suma algo aunque te vayas
        temprano, y de ahí para adelante lo que se premia lo pone la casa: una lista de
        consideraciones, una tabla fija de puntos por lugar, o las dos cosas.
      </p>

      {soyAdmin && !comoElReglamento && (
        <button
          type="button"
          className="btn btn-ghost mb-2"
          onClick={() => usar(PUNTOS_DEL_REGLAMENTO)}
        >
          <BookOpen size={16} strokeWidth={2.4} />
          Usar el reglamento de la liga
        </button>
      )}

      {/* El otro de fábrica: el campeonato mide a cuánta gente le ganaste, el dinero se
          queda en su columna y la peor noche de cada quien se cae. */}
      {soyAdmin && !comoContraLaMesa && (
        <button
          type="button"
          className="btn btn-ghost mb-3"
          onClick={() => usar(PUNTOS_CONTRA_LA_MESA)}
        >
          <Users size={16} strokeWidth={2.4} />
          Usar los puntos contra la mesa
        </button>
      )}

      <p className="field-label mt-0 mb-1.5">Lo que suma cada noche</p>

      {reglas.length === 0 && tabla.length === 0 && (
        <p className="mt-0 mb-3 rounded-xl bg-ink/6 px-3 py-2.5 text-[12.5px] leading-snug text-ink-soft">
          Sin ninguna consideración ni tabla nadie suma puntos y el campeonato queda plano. Agrega
          al menos una.
        </p>
      )}

      <ul className="m-0 mb-2 list-none p-0">
        {reglas.map((r) => {
          const c = CONSIDERACIONES.find((x) => x.id === r.id)
          if (!c) return null
          return (
            <li
              key={r.id}
              className="mb-2 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5 last:mb-0"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <b className="block text-[13.5px] text-ink">{c.etiqueta}</b>
                  <span className="block text-[11.5px] leading-snug text-ink-soft">{c.ayuda}</span>
                </div>
                {soyAdmin && (
                  <button
                    type="button"
                    aria-label={`Quitar ${c.etiqueta}`}
                    onClick={() => setReglas((rs) => rs.filter((x) => x.id !== r.id))}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss active:scale-95"
                  >
                    <X size={13} strokeWidth={2.6} />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11.5px] text-ink-soft">{c.castigo ? 'Resta' : 'Suma'}</span>
                <div className="field-box flex-1">
                  <NumInput
                    value={r.puntos}
                    showZero
                    mode="decimal"
                    aria-label={`Puntos por ${c.etiqueta}`}
                    onChange={(v) =>
                      soyAdmin &&
                      setReglas((rs) => rs.map((x) => (x.id === r.id ? { ...x, puntos: v } : x)))
                    }
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {soyAdmin && disponibles.length > 0 && !agregando && (
        <button
          type="button"
          className="btn-dashed mb-3 flex items-center justify-center gap-1.5"
          onClick={() => setAgregando(true)}
        >
          <Plus size={15} strokeWidth={2.6} />
          Agregar una consideración
        </button>
      )}

      {soyAdmin && agregando && (
        <div className="mb-3 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
          <p className="field-label mt-0 mb-1.5">¿Qué más quieres premiar?</p>
          {disponibles.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setReglas((rs) => [...rs, { id: c.id, puntos: c.sugerido }])
                setAgregando(false)
              }}
              className="mb-1.5 flex w-full cursor-pointer flex-col items-start rounded-xl border border-paper-line bg-white px-3 py-2 text-left last:mb-0 active:scale-[.99]"
            >
              <b className="text-[13.5px] text-ink">{c.etiqueta}</b>
              <span className="text-[11.5px] leading-snug text-ink-soft">{c.ayuda}</span>
            </button>
          ))}
          <button type="button" className="btn btn-ghost mt-2" onClick={() => setAgregando(false)}>
            Mejor no
          </button>
        </div>
      )}

      {/* Sólo sale si hay puntos por dinero que recortar: un número suelto que no hace
          nada sólo confunde al que abra esto en seis meses. */}
      {hayDinero && (
        <>
          <p className="field-label mt-4 mb-1.5">Tope de los puntos por dinero</p>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-ink-soft">Hasta</span>
            <div className="field-box flex-1">
              <NumInput
                value={tope}
                showZero
                mode="decimal"
                aria-label="Tope de los puntos por dinero en una noche"
                onChange={(v) => soyAdmin && setTope(Math.max(0, v))}
              />
            </div>
          </div>
          <p className="mt-1.5 mb-0 text-[12px] leading-snug text-ink-soft">
            {tope > 0
              ? `Lo que el dinero puede sumar o restar en una noche se queda en ${tope}. Arriba de eso da igual cuánto te llevaste: la noche del palazo cuenta, pero no se come la temporada.`
              : 'Sin tope, la noche que alguien se lleve cinco mil pesos vale cincuenta puntos y el campeonato se vuelve la columna de saldo con otro nombre. Pon un número para ponerle techo.'}
          </p>
        </>
      )}

      {/* La otra forma de puntuar, y la que usa el reglamento: tanto al primero, tanto al
          segundo, y de ahí para abajo hasta donde la casa quiera llegar. */}
      <p className="field-label mt-4 mb-1.5">Puntos por lugar</p>

      {tabla.length === 0 ? (
        <>
          <p className="mt-0 mb-2 text-[12.5px] leading-snug text-ink-soft">
            Sin tabla, el lugar sólo cuenta por las consideraciones de arriba. Con tabla, el primero
            se lleva lo que diga el primer renglón, el segundo el segundo, y así.
          </p>
          {soyAdmin && (
            <button
              type="button"
              className="btn-dashed mb-3 flex items-center justify-center gap-1.5"
              onClick={() => setTabla([25, 20, 15, 10, 5])}
            >
              <Plus size={15} strokeWidth={2.6} />
              Usar una tabla de puntos por lugar
            </button>
          )}
        </>
      ) : (
        <>
          <ul className="m-0 mb-2 list-none p-0">
            {tabla.map((p, i) => (
              <li key={i} className="mb-1.5 flex items-center gap-2 last:mb-0">
                <span className="w-[62px] shrink-0 text-[12.5px] font-semibold text-ink">
                  {i === 0 ? 'Ganador' : `${ordinal(i + 1)} lugar`}
                </span>
                <div className="field-box flex-1">
                  <NumInput
                    value={p}
                    showZero
                    mode="decimal"
                    aria-label={`Puntos del ${ordinal(i + 1)} lugar`}
                    onChange={(v) =>
                      soyAdmin && setTabla((t) => t.map((x, j) => (j === i ? v : x)))
                    }
                  />
                </div>
                {soyAdmin && (
                  <button
                    type="button"
                    aria-label={`Quitar el ${ordinal(i + 1)} lugar`}
                    onClick={() => setTabla((t) => t.filter((_, j) => j !== i))}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss active:scale-95"
                  >
                    <X size={13} strokeWidth={2.6} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-0 mb-2 text-[11.5px] leading-snug text-ink-soft">
            Del {ordinal(tabla.length + 1)} en adelante no se suman puntos de lugar.
          </p>
          {soyAdmin && tabla.length < MAX_LUGARES && (
            <button
              type="button"
              className="btn-dashed mb-3 flex items-center justify-center gap-1.5"
              onClick={() => setTabla((t) => [...t, 0])}
            >
              <Plus size={15} strokeWidth={2.6} />
              Agregar el {ordinal(tabla.length + 1)} lugar
            </button>
          )}
        </>
      )}

      {/* La tabla es el punto de la hoja: los números por sí solos no dicen cómo queda la
          noche, y aquí se ve al instante al mover cualquiera. */}
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
          const p = deLugar(l)
          return (
            <li
              key={l}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
            >
              <span className="w-[62px] shrink-0 text-[12.5px] font-semibold text-ink">
                {l === 1 ? 'Ganador' : l === mesa ? 'Último' : `${ordinal(l)} lugar`}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span
                  className={`block h-full rounded-full ${p < 0 ? 'bg-loss' : 'bg-marca'}`}
                  style={{
                    width: `${Math.max(3, (Math.abs(p) / mayor) * 100)}%`,
                  }}
                />
              </span>
              <b
                className={`w-9 shrink-0 text-right font-display text-[15px] tabular-nums ${
                  p < 0 ? 'text-loss' : 'text-ink'
                }`}
              >
                {p}
              </b>
            </li>
          )
        })}
      </ul>
      <p className="mt-0 mb-2 text-right text-[11.5px] text-ink-soft">
        Esa noche reparte {total} puntos entre los {mesa}.
      </p>

      {aparte.length > 0 && (
        <div className="mb-4 rounded-xl bg-ink/6 px-3 py-2.5">
          <p className="mt-0 mb-1 text-[11.5px] font-semibold text-ink">
            Y encima de eso, a cada quien:
          </p>
          <ul className="m-0 list-none p-0">
            {aparte.map((r) => {
              const c = CONSIDERACIONES.find((x) => x.id === r.id)!
              return (
                <li key={r.id} className="text-[11.5px] leading-snug text-ink-soft">
                  <b className={r.puntos < 0 ? 'text-loss' : 'text-ink'}>
                    {r.puntos > 0 ? `+${r.puntos}` : r.puntos}
                  </b>{' '}
                  {c.etiqueta.replace(/^Por /, '').toLowerCase()}
                </li>
              )
            })}
          </ul>
          {hayDinero && tope > 0 && (
            <p className="mt-1.5 mb-0 text-[11.5px] leading-snug text-ink-soft">
              Lo del dinero, sumado, no pasa de {tope} ni para arriba ni para abajo.
            </p>
          )}
        </div>
      )}

      {/*
        Tampoco es una consideración: no cambia lo que vale una noche, sino cuántas de
        ellas entran a la suma del campeonato. Por eso va aquí abajo y no arriba.
      */}
      <p className="field-label mt-4 mb-1.5">Cuántas noches cuentan</p>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {DESCARTES.map((d) => (
          <button
            key={d.valor}
            type="button"
            disabled={!soyAdmin}
            aria-pressed={!porNoches && d.valor === elDescarte.valor}
            onClick={() => {
              setDescarta(0)
              setMejores(d.valor)
            }}
            className={`min-w-[86px] flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[12.5px] font-bold transition-colors disabled:cursor-default ${
              !porNoches && d.valor === elDescarte.valor
                ? 'bg-marca text-white'
                : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            {d.corto}
          </button>
        ))}
        {/* La misma regla, dicha en noches. Es como se dice en la mesa: "se cae la
            peor". El por ciento se acomoda solo cuando la temporada se alarga; el
            número no, y a veces eso es justo lo que se quiere. */}
        <button
          type="button"
          disabled={!soyAdmin}
          aria-pressed={porNoches}
          onClick={() => {
            setMejores(0)
            setDescarta(descarta > 0 ? descarta : 1)
          }}
          className={`min-w-[86px] flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[12.5px] font-bold transition-colors disabled:cursor-default ${
            porNoches ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
          }`}
        >
          Por noches
        </button>
      </div>

      {porNoches ? (
        <>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="shrink-0 text-[11.5px] text-ink-soft">Se descartan</span>
            <div className="field-box flex-1">
              <NumInput
                value={descarta}
                showZero
                mode="decimal"
                aria-label="Cuántas noches se descartan"
                onChange={(v) => soyAdmin && setDescarta(Math.max(0, v))}
              />
            </div>
            <span className="shrink-0 text-[11.5px] text-ink-soft">
              {descarta === 1 ? 'noche' : 'noches'}
            </span>
          </div>
          <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">{ayudaDescarte}</p>
        </>
      ) : (
        <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">{elDescarte.ayuda}</p>
      )}

      {(mejores > 0 || descarta > 0) && (
        <p className="mt-0 mb-4 text-[12px] leading-snug text-ink-soft">
          El saldo en dinero no se descarta nunca: ahí siguen contando todas las noches,
          como debe ser, porque lo que se pagó en la mesa se pagó.
        </p>
      )}

      {/*
        Esto no es una consideración y por eso va aparte: no cambia lo que suma nadie,
        sino a quién se puede coronar. Lo que resuelve es el viernes de suerte —dos
        noches, dos palazos— que de otro modo se lleva una temporada entera.
      */}
      <p className="field-label mt-4 mb-1.5">Quién puede subir al podio</p>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {MINIMOS.map((m) => (
          <button
            key={m.valor}
            type="button"
            disabled={!soyAdmin}
            aria-pressed={!minPorNoches && m.valor === elMinimo.valor}
            onClick={() => {
              setMinNoches(0)
              setMinimo(m.valor)
            }}
            className={`min-w-[86px] flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[12.5px] font-bold transition-colors disabled:cursor-default ${
              !minPorNoches && m.valor === elMinimo.valor
                ? 'bg-marca text-white'
                : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            {m.corto}
          </button>
        ))}
        {/* En noches no se mueve aunque la temporada se alargue: "hay que venir a
            cuatro" quiere decir cuatro en diciembre y cuatro en julio. */}
        <button
          type="button"
          disabled={!soyAdmin}
          aria-pressed={minPorNoches}
          onClick={() => {
            setMinimo(0)
            setMinNoches(minNoches > 0 ? minNoches : 4)
          }}
          className={`min-w-[86px] flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[12.5px] font-bold transition-colors disabled:cursor-default ${
            minPorNoches ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
          }`}
        >
          Por noches
        </button>
      </div>

      {minPorNoches ? (
        <>
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
        </>
      ) : (
        <p className="mt-0 mb-4 text-[12px] leading-snug text-ink-soft">{elMinimo.ayuda}</p>
      )}

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
              La tabla entera se vuelve a contar con estas reglas, también las partidas viejas.
            </p>
          )}
          {!comoSiempre && (
            <button
              type="button"
              className="btn btn-ghost mb-2"
              onClick={() => usar(PUNTOS_POR_DEFECTO)}
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
