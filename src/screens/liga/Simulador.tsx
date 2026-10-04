import { Coins, RotateCcw, Undo2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Cara from '../../components/Cara'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
import type { Miembro } from '../../lib/api'
import {
  NOMBRE_CALLE,
  arrancarMano,
  bote as boteDe,
  comoSeDice,
  deshacer,
  jugar,
  opciones,
  type Mano,
} from '../../lib/mano'
import { money } from '../../lib/money'
import {
  EXIGENCIA,
  PALOS,
  VALORES,
  asientosDe,
  bandaDeJugabilidad,
  carta,
  cuentasDeLaApuesta,
  equidadDe,
  nombreDeLaMano,
  paloDe,
  simular,
  valorDe,
  type Simulacion,
} from '../../lib/poker'
import Mesa, { type AsientoEnMesa } from './Mesa'

/*
 * El simulador: con qué frecuencia gana tu mano, y si sale a cuentas pagar.
 *
 * No adivina ni opina: reparte veinte mil veces lo que falta —las cartas que no se ven y
 * lo que queda por salir— y cuenta cuántas de esas veces ganas. Es la misma cuenta que
 * hacen los programas de los profesionales, sólo que explicada.
 *
 * Todo cuelga de la mesa dibujada: ahí se sienta uno, se sienta a los demás con su nombre
 * de la liga, se ponen las cartas comunes y se ve lo que se lleva cada quien. Debajo se
 * apunta la mano como fue —las ciegas, quién subió, quién se fue— y de eso salen el bote
 * y la cuenta de si pagar conviene, que es la pregunta de verdad en la mesa.
 */

const MIN_JUGADORES = 2
const MAX_JUGADORES = 9

const ROJO = (c: number) => paloDe(c) === 1 || paloDe(c) === 2

/** Los identificadores van sin acento; lo que se lee, no. */
const NOMBRE_POSICION = {
  temprana: 'temprana',
  media: 'media',
  tardia: 'tardía',
  ciega: 'de ciega',
} as const

/** Qué hueco se está llenando: una de las de en medio o una de alguien. */
type Eligiendo = { tipo: 'mesa'; i: number } | { tipo: 'asiento'; s: number; i: number }
const mismoHueco = (a: Eligiendo | null, b: Eligiendo) => {
  if (!a || a.tipo !== b.tipo) return false
  if (a.tipo === 'mesa' || b.tipo === 'mesa') return a.i === b.i
  return a.s === b.s && a.i === b.i
}

const manosVacias = (): (number | null)[][] =>
  Array.from({ length: MAX_JUGADORES }, () => [null, null])

function Carta({
  valor,
  onClick,
  tam = 'normal',
  activa = false,
  gastada = false,
}: {
  valor: number | null
  onClick?: () => void
  tam?: 'normal' | 'chica'
  activa?: boolean
  gastada?: boolean
}) {
  const vacia = valor === null
  const medidas = tam === 'normal' ? 'h-14 w-11 text-[19px]' : 'h-11 w-9 text-[15px]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative flex shrink-0 flex-col items-center justify-center rounded-lg border font-display leading-none font-bold transition-colors ${medidas} ${
        vacia
          ? `border-dashed bg-white/60 text-ink-soft/40 ${activa ? 'border-marca bg-marca/10' : 'border-paper-line'}`
          : gastada
            ? 'border-paper-line bg-ink/10 text-ink-soft/35'
            : `border-paper-line bg-white ${ROJO(valor) ? 'text-loss' : 'text-ink'}`
      } ${onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
    >
      {vacia ? (
        '+'
      ) : (
        <>
          <span>{VALORES[valorDe(valor)]}</span>
          <span className={tam === 'normal' ? 'text-[16px]' : 'text-[12px]'}>
            {PALOS[paloDe(valor)]}
          </span>
          {/* La tachadura dice de un vistazo que esa carta ya está en otro lado: sin
              ella, la casilla apagada parece sólo un color distinto. */}
          {gastada && (
            <span className="pointer-events-none absolute inset-x-1 top-1/2 h-px -rotate-12 bg-ink-soft/50" />
          )}
        </>
      )}
    </button>
  )
}

/** Dos cartas chiquitas, para los renglones del resultado. */
function Par({ cartas }: { cartas: number[] }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {cartas.map((c) => (
        <span
          key={c}
          className={`flex h-7 w-5 flex-col items-center justify-center rounded border border-paper-line bg-white font-display text-[10px] leading-none font-bold ${
            ROJO(c) ? 'text-loss' : 'text-ink'
          }`}
        >
          <span>{VALORES[valorDe(c)]}</span>
          <span className="text-[8px]">{PALOS[paloDe(c)]}</span>
        </span>
      ))}
    </span>
  )
}

export default function Simulador({
  abierta,
  miembros,
  onCerrar,
}: {
  abierta: boolean
  miembros: Miembro[]
  onCerrar: () => void
}) {
  const [jugadores, setJugadores] = useState(4)
  const [asiento, setAsiento] = useState(0)
  /** Las cinco de en medio. */
  const [mesaCartas, setMesaCartas] = useState<(number | null)[]>(Array(5).fill(null))
  /** Las dos de cada asiento, el mío incluido. */
  const [manos, setManos] = useState<(number | null)[][]>(manosVacias)
  /** Quién se sienta en cada asiento: el id de un jugador de la liga. */
  const [quien, setQuien] = useState<(string | null)[]>(Array(MAX_JUGADORES).fill(null))
  const [eligiendo, setEligiendo] = useState<Eligiendo | null>(null)
  /** El asiento cuyo panel está abierto. */
  const [panel, setPanel] = useState<number | null>(null)
  const [resultado, setResultado] = useState<Simulacion | null>(null)
  const [calculando, setCalculando] = useState(false)

  /* El repaso de la mano: las ciegas y lo que fue apostando cada quien. */
  const [ciegas, setCiegas] = useState({ chica: 1, grande: 2 })
  const [manoApuntada, setMano] = useState<Mano | null>(null)
  const [subirA, setSubirA] = useState(0)
  const [boteManual, setBoteManual] = useState(0)
  const [apuestaManual, setApuestaManual] = useState(0)

  /* Una mano apuntada con otra cantidad de gente no habla de esta mesa: mejor no
     enseñarla que enseñar a medio mundo "se fue" por un asiento que ni existía. */
  const mano = manoApuntada && manoApuntada.cfg.jugadores === jugadores ? manoApuntada : null

  const asientos = useMemo(() => asientosDe(jugadores), [jugadores])
  const miAsiento = asientos.find((a) => a.indice === asiento) ?? asientos[0]

  /* Al cambiar el tamaño de la mesa, la silla elegida puede dejar de existir y la mano
     apuntada ya no cuadra con quién está sentado. */
  useEffect(() => {
    setAsiento((s) => (s >= jugadores ? 0 : s))
    setMano(null)
    setPanel(null)
    setEligiendo(null)
  }, [jugadores])

  /* Sin nadie sentado se le dice por su silla —"la ciega grande sube"—, que es como se
     cuenta una mano cuando no te acuerdas de quién estaba ahí. */
  const nombreDe = (s: number) => {
    const m = miembros.find((x) => x.id === quien[s])
    if (m) return m.nombre
    if (s === asiento) return 'Tú'
    const silla = asientos.find((a) => a.indice === s)
    return silla?.marca || `Asiento ${s + 1}`
  }
  const fotoDe = (s: number) => miembros.find((x) => x.id === quien[s])?.foto ?? null

  /* En la placa de la mesa no cabe "Asiento 4", y la silla ya se ve por su marca: ahí lo
     útil es si está libre o quién se sentó. */
  const enLaPlaca = (s: number) =>
    miembros.find((x) => x.id === quien[s])?.nombre ?? (s === asiento ? 'Tú' : 'Libre')

  const cartasDe = (s: number) => {
    const puestas = manos[s].filter((c): c is number => c !== null)
    return puestas.length === 2 ? puestas : []
  }

  const miMano = cartasDe(asiento)
  const mesa = useMemo(() => mesaCartas.filter((c): c is number => c !== null), [mesaCartas])

  const usadas = useMemo(() => {
    const s = new Set<number>()
    for (const c of mesaCartas) if (c !== null) s.add(c)
    for (const par of manos.slice(0, jugadores)) for (const c of par) if (c !== null) s.add(c)
    return s
  }, [mesaCartas, manos, jugadores])

  /* Los que siguen en la mano: sin nada apuntado, están todos. */
  const sigue = (s: number) => !mano || mano.vivo[s]
  const vivos = useMemo(
    () => Array.from({ length: jugadores }, (_, s) => s).filter(sigue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jugadores, mano],
  )
  const rivalesVivos = vivos.filter((s) => s !== asiento)
  const meFui = !sigue(asiento)

  /* Para el motor los rivales van en fila; aquí se guarda a qué asiento es cada uno. */
  const manosRivales = useMemo(
    () => rivalesVivos.map((s) => cartasDe(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rivalesVivos, manos],
  )

  const mesaValida = [0, 3, 4, 5].includes(mesa.length)
  const sinHuecos =
    mesaCartas.slice(0, mesa.length).every((c) => c !== null) &&
    mesaCartas.slice(mesa.length).every((c) => c === null)
  const listo =
    miMano.length === 2 && mesaValida && sinHuecos && !meFui && rivalesVivos.length > 0

  useEffect(() => {
    if (!listo) {
      setResultado(null)
      return
    }
    setCalculando(true)
    const t = setTimeout(() => {
      setResultado(simular({ mano: miMano, mesa, rivales: rivalesVivos.length, manosRivales }))
      setCalculando(false)
    }, 30)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, mesaCartas, manos, asiento, jugadores, mano])

  /** Lo que se lleva un asiento, ya calculado. */
  const repartoDe = (s: number) => {
    if (!resultado) return null
    if (s === asiento) return resultado
    const k = rivalesVivos.indexOf(s)
    return k >= 0 ? resultado.porRival[k] : null
  }

  const mejorParte = resultado
    ? Math.max(resultado.parte, ...resultado.porRival.map((r) => r.parte))
    : 0

  const poner = (valor: number) => {
    if (!eligiendo) return
    if (eligiendo.tipo === 'mesa') {
      setMesaCartas((cs) => cs.map((c, i) => (i === eligiendo.i ? valor : c)))
      /* Salta al siguiente hueco vacío: poner cinco cartas no debe ser diez toques. */
      const siguiente = mesaCartas.findIndex((c, k) => k > eligiendo.i && c === null)
      setEligiendo(siguiente >= 0 ? { tipo: 'mesa', i: siguiente } : null)
      return
    }
    setManos((ms) =>
      ms.map((par, s) =>
        s === eligiendo.s ? par.map((c, i) => (i === eligiendo.i ? valor : c)) : par,
      ),
    )
    setEligiendo(eligiendo.i === 0 ? { tipo: 'asiento', s: eligiendo.s, i: 1 } : null)
  }

  const vaciarHueco = (e: Eligiendo) => {
    if (e.tipo === 'mesa') setMesaCartas((cs) => cs.map((c, i) => (i === e.i ? null : c)))
    else
      setManos((ms) =>
        ms.map((par, s) => (s === e.s ? par.map((c, i) => (i === e.i ? null : c)) : par)),
      )
    setEligiendo(null)
  }

  const limpiar = () => {
    setMesaCartas(Array(5).fill(null))
    setManos(manosVacias())
    setEligiendo(null)
    setResultado(null)
    setMano(null)
    setPanel(null)
  }

  /* ---- el repaso de la mano ---- */
  const o = mano ? opciones(mano) : null
  const bote = mano ? boteDe(mano) : 0
  const meToca = mano?.turno === asiento

  const empezar = () => {
    setMano(arrancarMano({ jugadores, ciegaChica: ciegas.chica, ciegaGrande: ciegas.grande }))
    setPanel(null)
  }

  const mover = (tipo: Parameters<typeof jugar>[1], hasta?: number) => {
    if (!mano) return
    const siguiente = jugar(mano, tipo, hasta)
    setMano(siguiente)
    setSubirA(opciones(siguiente)?.minimo ?? 0)
  }

  const minimo = o?.minimo ?? 0
  useEffect(() => {
    setSubirA((v) => (v >= minimo ? v : minimo))
  }, [minimo])

  /* Si se está apuntando la mano, lo que te piden pagar sale de ahí: es el número que de
     verdad estás viendo en la mesa, no uno que haya que volver a teclear. */
  /* Lo que te falta para seguir en la mano. No hace falta que sea tu turno: mientras
     alguien apuesta ya se ve lo que te va a costar entrar, que es lo que se está
     pensando mientras los demás hablan. */
  const meFalta = mano && !meFui ? Math.max(...mano.puesto) - mano.puesto[asiento] : 0
  const usandoMano = Boolean(mano && !meFui)
  const elBote = usandoMano ? bote : boteManual
  const laApuesta = usandoMano ? meFalta : apuestaManual

  const equidad = resultado ? equidadDe(resultado) : 0
  const banda = bandaDeJugabilidad(equidad, vivos.length, miAsiento.posicion)
  const cuentas = resultado ? cuentasDeLaApuesta(equidad, elBote, laApuesta) : null
  const justo = 100 / Math.max(2, vivos.length)
  const trae = miMano.length === 2 && mesa.length >= 3 ? nombreDeLaMano(miMano, mesa) : ''
  const sabidas = manosRivales.filter((m) => m.length === 2).length

  const TONOS = {
    win: { caja: 'bg-win/12 text-win-tinta', texto: 'text-win' },
    ambar: { caja: 'bg-[#f0a81e]/15 text-[#8a5c00]', texto: 'text-[#8a5c00]' },
    loss: { caja: 'bg-loss/12 text-loss', texto: 'text-loss' },
  }[banda.tono]

  const enMesa: AsientoEnMesa[] = asientos.map((a) => {
    const r = repartoDe(a.indice)
    return {
      indice: a.indice,
      nombre: enLaPlaca(a.indice),
      foto: fotoDe(a.indice),
      ocupado: quien[a.indice] !== null,
      marca: a.marca,
      yo: a.indice === asiento,
      cartas: cartasDe(a.indice),
      pct: r && !calculando ? `${r.parte.toFixed(0)}%` : '',
      apuesta: mano ? mano.puesto[a.indice] : 0,
      fuera: !sigue(a.indice),
      activo: mano?.turno === a.indice,
      manda: Boolean(r && r.parte >= mejorParte - 1e-9),
    }
  })

  /** El tablero de 52 cartas: las que ya están puestas salen tachadas y no se tocan. */
  const Mazo = () => (
    <div className="mt-2 mb-3 rounded-xl border border-paper-line bg-paper-soft p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold text-ink-soft">Elige la carta</span>
        <button
          type="button"
          onClick={() => eligiendo && vaciarHueco(eligiendo)}
          className="cursor-pointer border-none bg-transparent p-1 text-[11.5px] font-semibold text-ink-soft underline"
        >
          Vaciar este hueco
        </button>
      </div>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <div className="grid w-max gap-1">
          {PALOS.map((_, palo) => (
            <div key={palo} className="flex gap-1">
              {/* De la A para abajo: las altas son las que se consultan. */}
              {VALORES.map((_, i) => VALORES.length - 1 - i).map((valor) => {
                const c = carta(valor, palo)
                const ocupada = usadas.has(c)
                return (
                  <Carta
                    key={c}
                    valor={c}
                    tam="chica"
                    gastada={ocupada}
                    onClick={ocupada ? undefined : () => poner(c)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Simulador de manos">
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Siéntate en la mesa, pon tus cartas y las que vayan saliendo. La app reparte la mano
        veinte mil veces y cuenta cuántas gana cada quien.
      </p>

      <p className="field-label mt-0 mb-1.5">Cuántos en la mesa</p>
      <div className="mb-3 flex gap-1">
        {Array.from(
          { length: MAX_JUGADORES - MIN_JUGADORES + 1 },
          (_, i) => i + MIN_JUGADORES,
        ).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setJugadores(n)}
            className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors ${
              jugadores === n ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <Mesa
        asientos={enMesa}
        mesa={mesaCartas}
        eligiendo={eligiendo?.tipo === 'mesa' ? eligiendo.i : null}
        bote={bote}
        dinero={money}
        onAsiento={(s) => {
          setPanel((p) => (p === s ? null : s))
          setEligiendo(null)
        }}
        onCarta={(i) =>
          setEligiendo((e) => (mismoHueco(e, { tipo: 'mesa', i }) ? null : { tipo: 'mesa', i }))
        }
      />

      <p className="mt-1 mb-3 text-center text-[12px] leading-snug text-ink-soft">
        Toca a alguien para sentarlo o verle las cartas, y las de en medio para ponerlas.
        Estás en <b className="text-ink">{miAsiento.nombre.toLowerCase()}</b>, posición{' '}
        {NOMBRE_POSICION[miAsiento.posicion]}.
      </p>

      {eligiendo?.tipo === 'mesa' && <Mazo />}

      {/* ---- el asiento que se está tocando ---- */}
      {panel !== null && (
        <div className="mb-3 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[13.5px] text-ink">
              {asientos.find((a) => a.indice === panel)?.nombre ?? 'El asiento'}
            </b>
            <button
              type="button"
              aria-label="Cerrar el asiento"
              onClick={() => {
                setPanel(null)
                setEligiendo(null)
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft active:scale-95"
            >
              <X size={13} strokeWidth={2.6} />
            </button>
          </div>

          {panel !== asiento && (
            <button
              type="button"
              className="btn btn-ghost mb-2"
              onClick={() => {
                setAsiento(panel)
                setPanel(null)
              }}
            >
              <UserRound size={16} strokeWidth={2.4} />
              Aquí me siento yo
            </button>
          )}

          <p className="field-label mt-0 mb-1.5">Quién se sienta aquí</p>
          {miembros.length === 0 ? (
            <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
              La liga todavía no tiene jugadores a los que ponerles la cara.
            </p>
          ) : (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {miembros.map((m) => {
                const aqui = quien[panel] === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setQuien((q) =>
                        /* Nadie se sienta en dos sillas: se levanta de la otra. */
                        q.map((x, s) =>
                          s === panel ? (aqui ? null : m.id) : x === m.id ? null : x,
                        ),
                      )
                    }
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border-none py-1 pr-2.5 pl-1 text-[12.5px] font-semibold active:scale-95 ${
                      aqui ? 'bg-marca text-white' : 'bg-white text-ink'
                    }`}
                  >
                    <Cara nombre={m.nombre} foto={m.foto} size={20} />
                    {m.nombre}
                  </button>
                )
              })}
            </div>
          )}

        </div>
      )}

      {/* ---- lo que trae cada quien ----
          Las cartas también se ponen tocando a alguien en la mesa, pero ahí hay que
          saber que se puede. Esta lista lo deja a la vista: un renglón por silla, el
          tuyo primero, y el que no se sabe se queda en blanco. */}
      <p className="field-label mt-0 mb-1.5">Lo que trae cada quien</p>
      <ul className="m-0 mb-1 list-none p-0">
        {Array.from({ length: jugadores }, (_, s) => s).map((s) => {
          const silla = asientos.find((a) => a.indice === s)
          const fuera = !sigue(s)
          return (
            <li key={s} className="mb-1.5 flex items-center gap-2 last:mb-0">
              <button
                type="button"
                onClick={() => {
                  setPanel((x) => (x === s ? null : s))
                  setEligiendo(null)
                }}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-paper-line bg-paper-soft px-2 py-1.5 text-left active:scale-[.99] ${
                  fuera ? 'opacity-45' : ''
                }`}
              >
                {/* Sin nadie sentado no hay cara que poner: la inicial de "ciega grande"
                    no es de nadie. */}
                {quien[s] !== null && <Cara nombre={nombreDe(s)} foto={fotoDe(s)} size={24} />}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] text-ink">
                    {s === asiento ? 'Tú' : nombreDe(s)}
                  </b>
                  <span className="block truncate text-[10.5px] leading-tight text-ink-soft">
                    {silla?.nombre}
                    {fuera && ' · se fue'}
                  </span>
                </span>
              </button>
              <span className="flex shrink-0 gap-1.5">
                {[0, 1].map((i) => (
                  <Carta
                    key={i}
                    valor={manos[s][i]}
                    tam="chica"
                    activa={mismoHueco(eligiendo, { tipo: 'asiento', s, i })}
                    onClick={() =>
                      setEligiendo((e) =>
                        mismoHueco(e, { tipo: 'asiento', s, i })
                          ? null
                          : { tipo: 'asiento', s, i },
                      )
                    }
                  />
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-0 mb-3 text-[11.5px] leading-snug text-ink-soft">
        Toca el nombre para decir quién se sienta ahí. Al que dejes en blanco se le siguen
        repartiendo cartas al azar, que es justo lo que sabes de él.
      </p>

      {eligiendo?.tipo === 'asiento' && <Mazo />}

      {/* ---- cómo se fue jugando ---- */}
      <section className="panel">
        <p className="panel-title">
          <span>Cómo se fue la mano</span>
        </p>

        {!mano ? (
          <>
            <p className="mt-0 mb-2.5 text-[12.5px] leading-snug text-ink-soft">
              Apúntala como pasó —las ciegas, quién subió, quién se fue— y la app lleva el bote
              y te dice, cuando te toque, si sale a cuentas pagar.
            </p>
            <div className="mb-2 flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11.5px] text-ink-soft">Ciega chica</span>
                <span className="field-box block">
                  <NumInput
                    value={ciegas.chica}
                    mode="decimal"
                    aria-label="Ciega chica"
                    onChange={(v) => setCiegas((c) => ({ ...c, chica: v }))}
                  />
                </span>
              </label>
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11.5px] text-ink-soft">Ciega grande</span>
                <span className="field-box block">
                  <NumInput
                    value={ciegas.grande}
                    mode="decimal"
                    aria-label="Ciega grande"
                    onChange={(v) => setCiegas((c) => ({ ...c, grande: v }))}
                  />
                </span>
              </label>
            </div>
            <button type="button" className="btn btn-marca" onClick={empezar}>
              Repartir y empezar a apuntar
            </button>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <b className="font-display text-[14px] text-ink">{NOMBRE_CALLE[mano.calle]}</b>
              <span className="text-[12.5px] text-ink-soft">
                Bote <b className="font-display text-ink tabular-nums">{money(bote)}</b>
              </span>
            </div>

            {/* El repaso, calle por calle: es lo que se cuenta después —"subió en el turn y
                los demás se fueron"— y aquí queda escrito. */}
            <ul className="m-0 mb-2.5 list-none p-0">
              {mano.movimientos.map((x, i) => {
                const abreCalle = i === 0 || mano.movimientos[i - 1].calle !== x.calle
                return (
                  <li key={i}>
                    {abreCalle && x.calle !== 'preflop' && (
                      <p className="mt-2 mb-1 text-[11px] font-bold tracking-[.5px] text-ink-soft uppercase">
                        {NOMBRE_CALLE[x.calle]}
                      </p>
                    )}
                    <p className="my-0 text-[12.5px] leading-relaxed text-ink">
                      <b>{nombreDe(x.jugador)}</b>{' '}
                      <span className="text-ink-soft">{comoSeDice(x, money)}</span>
                    </p>
                  </li>
                )
              })}
            </ul>

            {mano.terminada ? (
              <p className="mt-0 mb-2 rounded-xl bg-ink/6 px-3 py-2.5 text-[12.5px] leading-snug text-ink">
                {vivos.length === 1
                  ? `Se acabó: el bote de ${money(bote)} es de ${nombreDe(vivos[0])}.`
                  : `Se acabó el river. Al golpe quedan ${vivos.length} por ${money(bote)}.`}
              </p>
            ) : (
              o &&
              mano.turno !== null && (
                <>
                  <p className="mt-0 mb-1.5 text-[12.5px] text-ink">
                    {meToca ? (
                      'Te toca'
                    ) : (
                      <>
                        Le toca a <b>{nombreDe(mano.turno)}</b>
                      </>
                    )}
                    {o.paga > 0 && (
                      <>
                        , y pagar {meToca ? 'te' : 'le'} cuesta{' '}
                        <b className="font-display tabular-nums">{money(o.paga)}</b>
                      </>
                    )}
                    .
                  </p>
                  <div className="mb-2 flex gap-1.5">
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-lg border-none bg-[#e6e1d8] py-2.5 text-[13px] font-bold text-ink-soft active:scale-95"
                      onClick={() => mover('seVa')}
                    >
                      Se va
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer rounded-lg border-none bg-[#e6e1d8] py-2.5 text-[13px] font-bold text-ink active:scale-95"
                      onClick={() => mover(o.pasa ? 'pasa' : 'paga')}
                    >
                      {o.pasa ? 'Pasa' : `Paga ${money(o.paga)}`}
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="field-box flex-1">
                      <NumInput
                        value={subirA}
                        mode="decimal"
                        aria-label="A cuánto sube"
                        onChange={setSubirA}
                      />
                    </span>
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded-lg border-none bg-marca px-4 py-2.5 text-[13px] font-bold text-white active:scale-95"
                      onClick={() => mover(o.esApuesta ? 'apuesta' : 'sube', subirA)}
                    >
                      {o.esApuesta ? 'Apuesta' : 'Sube'}
                    </button>
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    {[
                      { k: 'Medio bote', v: Math.round(bote / 2) },
                      { k: 'El bote', v: bote },
                    ].map((s) => (
                      <button
                        key={s.k}
                        type="button"
                        onClick={() => setSubirA(Math.max(o.minimo, s.v))}
                        className="flex-1 cursor-pointer border-none bg-transparent py-1 text-[11.5px] font-semibold text-ink-soft underline active:scale-95"
                      >
                        {s.k}
                      </button>
                    ))}
                  </div>
                </>
              )
            )}

            <div className="mt-2.5 flex gap-1.5">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMano((m) => (m ? deshacer(m) : m))}
              >
                <Undo2 size={16} strokeWidth={2.4} />
                Deshacer
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setMano(null)}>
                <RotateCcw size={16} strokeWidth={2.4} />
                Otra mano
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---- si conviene pagar ----
          La pregunta de la mesa no es "¿voy ganando?" sino "¿me alcanza para pagar esto?".
          Pagar $100 a un bote de $900 necesita ganar una de cada diez; a un bote de $100,
          una de cada dos. Apuntando la mano, el bote y lo que te piden salen solos: no hay
          que volver a teclear lo que ya se apuntó. */}
      <section className="panel">
        <p className="panel-title">
          <span>
            <Coins size={14} strokeWidth={2.6} className="-mt-0.5 mr-1 inline" />
            ¿Conviene pagar?
          </span>
        </p>

        {usandoMano ? (
          <div className="mb-2 flex gap-2">
            <div className="flex-1 rounded-xl bg-ink/6 px-3 py-2">
              <span className="block text-[11px] text-ink-soft">En el bote hay</span>
              <b className="block font-display text-[19px] leading-tight text-ink tabular-nums">
                {money(elBote)}
              </b>
            </div>
            <div className="flex-1 rounded-xl bg-ink/6 px-3 py-2">
              <span className="block text-[11px] text-ink-soft">
                {meToca ? 'Te toca poner' : 'Para seguir pones'}
              </span>
              <b className="block font-display text-[19px] leading-tight text-ink tabular-nums">
                {money(laApuesta)}
              </b>
            </div>
          </div>
        ) : (
          <div className="mb-2 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11.5px] text-ink-soft">En el bote hay</span>
              <span className="field-box block">
                <NumInput
                  value={boteManual}
                  mode="decimal"
                  aria-label="Lo que hay en el bote"
                  onChange={setBoteManual}
                />
              </span>
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11.5px] text-ink-soft">Te toca pagar</span>
              <span className="field-box block">
                <NumInput
                  value={apuestaManual}
                  mode="decimal"
                  aria-label="Lo que te toca pagar"
                  onChange={setApuestaManual}
                />
              </span>
            </label>
          </div>
        )}

        {cuentas ? (
          <>
            <div
              className={`rounded-xl px-3 py-2.5 ${cuentas.conviene ? 'bg-win/12' : 'bg-loss/12'}`}
            >
              <b
                className={`block font-display text-[14.5px] ${
                  cuentas.conviene ? 'text-win-tinta' : 'text-loss'
                }`}
              >
                {cuentas.conviene ? 'Sí sale a cuentas pagar' : 'No sale a cuentas pagar'}
              </b>
              <p className="mt-1 mb-0 text-[12.5px] leading-snug text-ink">
                Pagar {money(laApuesta)} a un bote de {money(elBote)} te pide ganar{' '}
                <b>{cuentas.necesitas.toFixed(1)}%</b> de las veces, y te llevas{' '}
                <b>{cuentas.tienes.toFixed(1)}%</b>.
              </p>
              <p className="mt-1 mb-0 text-[12.5px] leading-snug text-ink">
                Cada vez que se jugara esta mano, pagar te{' '}
                {cuentas.esperado >= 0 ? 'deja' : 'cuesta'}{' '}
                <b className={cuentas.esperado >= 0 ? 'text-win' : 'text-loss'}>
                  {money(Math.abs(cuentas.esperado))}
                </b>
                .
              </p>
            </div>
            <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft/80">
              La apuesta es {(cuentas.parteDelBote * 100).toFixed(0)}% del bote. Esto sólo cuenta
              esta carta: si te van a volver a apostar después, te hace falta más margen del que
              dice aquí.
            </p>
          </>
        ) : (
          <p className="mt-0 mb-0 text-[12.5px] leading-snug text-ink-soft">
            {meFui
              ? 'Te fuiste de la mano: ya no hay nada que pagar.'
              : !resultado
                ? 'Falta poner tus dos cartas para saber cuánto te llevas y poder comparar.'
                : usandoMano && laApuesta <= 0
                  ? `Ahora mismo no te piden nada: estás al corriente y en el bote hay ${money(elBote)}.`
                  : 'Pon lo que hay en el bote y lo que te piden, y la app dice si sale a cuentas pagar con la mano que traes.'}
          </p>
        )}
      </section>

      {/* ---- el resultado ---- */}
      {!listo ? (
        <div className="balance balance-ok mb-2">
          <span>
            {meFui
              ? 'Te fuiste de la mano: ya no hay nada que calcular.'
              : rivalesVivos.length === 0
                ? 'Ya no queda nadie contra quien jugar.'
                : miMano.length < 2
                  ? 'Pon tus dos cartas para empezar. La mesa puedes dejarla vacía.'
                  : 'El flop va completo: pon las tres o quítalas.'}
          </span>
        </div>
      ) : (
        <section className="panel">
          <p className="panel-title">
            <span>{trae ? `Traes ${trae.toLowerCase()}` : 'Antes del flop'}</span>
          </p>

          {calculando || !resultado ? (
            <p className="m-0 py-6 text-center text-[13px] text-ink-soft">Repartiendo manos…</p>
          ) : (
            <>
              <div className={`mb-3 rounded-xl px-3 py-2 text-center ${TONOS.caja}`}>
                <b className="font-display text-[15px] tracking-[.5px] uppercase">
                  {banda.etiqueta}
                </b>
              </div>

              <div className="text-center">
                <div className={`font-display text-[46px] leading-none font-bold ${TONOS.texto}`}>
                  {resultado.gano.toFixed(1)}%
                </div>
                <div className="mt-1 text-[12px] text-ink-soft">
                  de las veces ganas
                  {resultado.manos === 1 && ' · la mano ya está jugada, esto es exacto'}
                </div>
              </div>

              <ul className="m-0 mt-3 list-none p-0">
                {[
                  { k: 'Ganas', v: resultado.gano, color: 'bg-win' },
                  { k: 'Empatas', v: resultado.empate, color: 'bg-tiza' },
                  { k: 'Pierdes', v: resultado.perdi, color: 'bg-loss' },
                ].map((f) => (
                  <li key={f.k} className="mb-1.5 last:mb-0">
                    <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                      <span className="text-ink-soft">{f.k}</span>
                      <b className="font-display text-ink tabular-nums">{f.v.toFixed(1)}%</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                      <div
                        className={`h-full rounded-full ${f.color}`}
                        style={{ width: `${Math.max(0, f.v)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Los porcentajes de los demás. Al que se le sabe la mano trae el suyo de
                  verdad; al que no, el de una mano cualquiera, que es lo que se sabe de
                  él. Suman 100 porque el bote siempre se lo lleva alguien. */}
              <p className="field-label mt-4 mb-1">Lo que se lleva cada quien</p>
              <ul className="m-0 mb-1 list-none p-0">
                {[asiento, ...rivalesVivos].map((s) => {
                  const r = repartoDe(s)
                  if (!r) return null
                  const suyas = cartasDe(s)
                  const silla = asientos.find((a) => a.indice === s)
                  const manda = r.parte >= mejorParte - 1e-9
                  return (
                    <li
                      key={s}
                      className="flex items-center gap-2 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
                    >
                      <Cara nombre={nombreDe(s)} foto={fotoDe(s)} size={26} />
                      <span className="min-w-0 flex-1">
                        <b
                          className={`block truncate text-[12.5px] ${manda ? 'text-win' : 'text-ink'}`}
                        >
                          {nombreDe(s)}
                        </b>
                        <span className="block text-[10.5px] leading-tight text-ink-soft">
                          {silla?.nombre}
                          {suyas.length === 2 ? '' : ' · a ciegas'}
                        </span>
                      </span>
                      {suyas.length === 2 && <Par cartas={suyas} />}
                      <b
                        className={`w-12 shrink-0 text-right font-display text-[15px] tabular-nums ${
                          manda ? 'text-win' : 'text-ink'
                        }`}
                      >
                        {r.parte.toFixed(1)}%
                      </b>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-0 mb-0 text-right text-[11px] text-ink-soft/80">
                Contando que los empates se parten el bote.
              </p>

              <p className="mt-3 mb-0 text-[12.5px] leading-snug text-ink-soft">
                Repartiendo a ciegas entre {vivos.length} te tocaría{' '}
                <b className="text-ink">{justo.toFixed(1)}%</b>, y desde{' '}
                <b className="text-ink">{miAsiento.nombre.toLowerCase()}</b> conviene pedirle un{' '}
                {Math.round((EXIGENCIA[miAsiento.posicion] - 1) * 100)}% más que eso.
                {sabidas > 0 &&
                  ` Contando ${sabidas === 1 ? 'la mano que ya sabes' : `las ${sabidas} manos que ya sabes`}.`}
              </p>

              <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft/80">
                La posición no cambia el porcentaje —las cartas ganan lo mismo desde donde sea—;
                cambia cuánto margen necesitas, porque hablando primero juegas sin saber qué
                hicieron los demás.
              </p>

            </>
          )}
        </section>
      )}

      {(usadas.size > 0 || mano) && (
        <button type="button" className="btn btn-ghost mb-2" onClick={limpiar}>
          <RotateCcw size={16} strokeWidth={2.4} />
          Empezar de nuevo
        </button>
      )}
    </Sheet>
  )
}
