import { Coins, RotateCcw, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NumInput from '../../components/NumInput'
import Sheet from '../../components/Sheet'
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

/*
 * El simulador: con qué frecuencia gana tu mano.
 *
 * No adivina ni opina: reparte veinte mil veces lo que falta —las cartas que no se ven y
 * lo que queda por salir— y cuenta cuántas de esas veces ganas. Es la misma cuenta que
 * hacen los programas de los profesionales, sólo que explicada.
 *
 * Sirve para dos cosas distintas: decidir en el momento, con la mesa a medias, y repasar
 * una mano después de jugada poniendo lo que enseñó cada quien. Para lo primero no basta
 * el porcentaje: lo que decide es si alcanza para pagar lo que piden, y eso depende del
 * bote. Para lo segundo ayuda ver el número de cada uno con su nombre, no "rival 3".
 */

const HUECOS = [
  { i: 0, grupo: 'Tu mano' },
  { i: 1, grupo: 'Tu mano' },
  { i: 2, grupo: 'Flop' },
  { i: 3, grupo: 'Flop' },
  { i: 4, grupo: 'Flop' },
  { i: 5, grupo: 'Turn' },
  { i: 6, grupo: 'River' },
] as const

const ROJO = (c: number) => paloDe(c) === 1 || paloDe(c) === 2

/** Los identificadores van sin acento; lo que se lee, no. */
const NOMBRE_POSICION = {
  temprana: 'temprana',
  media: 'media',
  tardia: 'tardía',
  ciega: 'de ciega',
} as const

/** Qué hueco se está llenando: uno de los míos o una carta de un rival. */
type Eligiendo = { tipo: 'mio'; i: number } | { tipo: 'rival'; r: number; i: number }
const mismoHueco = (a: Eligiendo | null, b: Eligiendo) => {
  if (!a || a.tipo !== b.tipo) return false
  if (a.tipo === 'mio' || b.tipo === 'mio') return a.i === b.i
  return a.r === b.r && a.i === b.i
}

function Carta({
  valor,
  onClick,
  tam = 'normal',
  activa = false,
  gastada = false,
}: {
  valor: number | null
  onClick?: () => void
  tam?: 'normal' | 'chica' | 'mini'
  activa?: boolean
  gastada?: boolean
}) {
  const vacia = valor === null
  const medidas =
    tam === 'normal'
      ? 'h-14 w-11 text-[19px]'
      : tam === 'chica'
        ? 'h-11 w-9 text-[15px]'
        : 'h-9 w-7 text-[13px]'
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

/**
 * La mesa vista desde arriba, con una silla por jugador.
 *
 * Decir "posición media" no significa nada hasta que se ve dónde cae: aquí se toca la
 * silla y la app dice qué posición es y cuánto le exige a la mano. Debajo de cada silla
 * va el nombre de quien se sienta ahí y lo que se lleva, que es como se ve la mano
 * completa de un vistazo en vez de leer una lista.
 */
function Mesa({
  jugadores,
  asiento,
  onElegir,
  etiqueta,
  pct,
}: {
  jugadores: number
  asiento: number
  onElegir: (i: number) => void
  /** Cómo se llama el que se sienta ahí. */
  etiqueta: (indice: number) => string
  /** Lo que se lleva, ya escrito. Vacío mientras no haya cuenta hecha. */
  pct: (indice: number) => string
}) {
  const asientos = asientosDe(jugadores)
  const alto = 210
  return (
    <div className="relative mx-auto mb-2" style={{ height: alto, maxWidth: 320 }}>
      <div className="absolute inset-x-8 inset-y-12 rounded-[999px] bg-[#0b6b3a] ring-4 ring-[#5b3b22]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-[11px] tracking-[1px] text-white/50 uppercase">
          {jugadores} en la mesa
        </span>
      </div>
      {asientos.map((a, i) => {
        /* Las sillas se reparten por el óvalo empezando abajo, que es donde se sienta
           uno mismo al imaginarse la mesa. */
        const ang = Math.PI / 2 + (i / asientos.length) * Math.PI * 2
        const x = 50 + Math.cos(ang) * 40
        const y = 50 + Math.sin(ang) * 34
        const yo = a.indice === asiento
        const nombre = etiqueta(a.indice)
        const suyo = pct(a.indice)
        return (
          <div
            key={a.indice}
            className="absolute z-10 flex w-[58px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2px]"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <button
              type="button"
              onClick={() => onElegir(a.indice)}
              aria-label={`Sentarme en ${a.nombre}`}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 font-display text-[11px] font-bold transition-colors active:scale-90 ${
                yo
                  ? 'border-marca-alta bg-marca text-white'
                  : 'border-white/25 bg-black/45 text-white/70'
              }`}
            >
              {yo ? 'TÚ' : a.marca || i + 1}
            </button>
            {/* En una placa oscura: el nombre y el porcentaje caen encima del fieltro y
                en blanco a secas se pierden contra el verde. */}
            {(nombre || suyo) && (
              <span className="max-w-full rounded-md bg-black/65 px-1 py-[2px] text-center">
                {nombre && (
                  <span className="block truncate text-[9.5px] leading-tight font-semibold text-white/85">
                    {nombre}
                  </span>
                )}
                {suyo && (
                  <span className="block font-display text-[11px] leading-tight font-bold text-white tabular-nums">
                    {suyo}
                  </span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Simulador({
  abierta,
  onCerrar,
}: {
  abierta: boolean
  onCerrar: () => void
}) {
  const [cartas, setCartas] = useState<(number | null)[]>(Array(7).fill(null))
  const [rivalesCartas, setRivalesCartas] = useState<(number | null)[][]>(
    Array.from({ length: 9 }, () => [null, null]),
  )
  const [nombres, setNombres] = useState<string[]>(Array(9).fill(''))
  const [eligiendo, setEligiendo] = useState<Eligiendo | null>(null)
  const [rivales, setRivales] = useState(3)
  const [asiento, setAsiento] = useState(0)
  const [bote, setBote] = useState(0)
  const [apuesta, setApuesta] = useState(0)
  const [verRivales, setVerRivales] = useState(false)
  const [resultado, setResultado] = useState<Simulacion | null>(null)
  const [calculando, setCalculando] = useState(false)

  const jugadores = rivales + 1
  const asientos = useMemo(() => asientosDe(jugadores), [jugadores])
  /* Al cambiar el número de jugadores la silla elegida puede dejar de existir. */
  useEffect(() => {
    if (asiento >= jugadores) setAsiento(0)
  }, [jugadores, asiento])
  const miAsiento = asientos.find((a) => a.indice === asiento) ?? asientos[0]

  const mano = useMemo(() => cartas.slice(0, 2).filter((c): c is number => c !== null), [cartas])
  const mesa = useMemo(() => cartas.slice(2).filter((c): c is number => c !== null), [cartas])
  /* Cada rival se queda en su renglón: el que está a medias va vacío y se le reparte al
     azar, pero no corre a los de abajo, porque su porcentaje lleva su nombre. */
  const manosRivales = useMemo(
    () =>
      rivalesCartas.slice(0, rivales).map((par) => {
        const puestas = par.filter((c): c is number => c !== null)
        return puestas.length === 2 ? puestas : []
      }),
    [rivalesCartas, rivales],
  )
  const sabidas = manosRivales.filter((m) => m.length === 2).length

  /*
   * Quién se sienta dónde: el rival 1 es el de tu izquierda y de ahí se sigue dando la
   * vuelta. Hace falta para poner el nombre y el porcentaje en su silla.
   */
  const asientoDeRival = (r: number) => (asiento + 1 + r) % jugadores
  const rivalEnAsiento = (indice: number) =>
    indice === asiento ? -1 : (indice - asiento - 1 + jugadores) % jugadores
  const nombreDeRival = (r: number) => nombres[r]?.trim() || `Rival ${r + 1}`

  const usadas = useMemo(() => {
    const s = new Set<number>()
    for (const c of cartas) if (c !== null) s.add(c)
    for (const par of rivalesCartas.slice(0, rivales)) for (const c of par) if (c !== null) s.add(c)
    return s
  }, [cartas, rivalesCartas, rivales])

  const mesaValida = [0, 3, 4, 5].includes(mesa.length)
  const sinHuecos =
    cartas.slice(2, 2 + mesa.length).every((c) => c !== null) &&
    cartas.slice(2 + mesa.length).every((c) => c === null)
  const listo = mano.length === 2 && mesaValida && sinHuecos

  useEffect(() => {
    if (!listo) {
      setResultado(null)
      return
    }
    setCalculando(true)
    const t = setTimeout(() => {
      setResultado(simular({ mano, mesa, rivales, manosRivales }))
      setCalculando(false)
    }, 30)
    return () => clearTimeout(t)
  }, [listo, rivales, cartas, mano, mesa, manosRivales])

  const poner = (valor: number) => {
    if (!eligiendo) return
    if (eligiendo.tipo === 'mio') {
      setCartas((cs) => cs.map((c, i) => (i === eligiendo.i ? valor : c)))
      /* Salta al siguiente hueco vacío: poner cinco cartas no debe ser diez toques. */
      const siguiente = cartas.findIndex((c, k) => k > eligiendo.i && c === null)
      setEligiendo(siguiente >= 0 ? { tipo: 'mio', i: siguiente } : null)
      return
    }
    setRivalesCartas((rs) =>
      rs.map((par, r) =>
        r === eligiendo.r ? par.map((c, i) => (i === eligiendo.i ? valor : c)) : par,
      ),
    )
    setEligiendo(eligiendo.i === 0 ? { tipo: 'rival', r: eligiendo.r, i: 1 } : null)
  }

  const quitar = (e: Eligiendo) => {
    if (e.tipo === 'mio') setCartas((cs) => cs.map((c, i) => (i === e.i ? null : c)))
    else
      setRivalesCartas((rs) =>
        rs.map((par, r) => (r === e.r ? par.map((c, i) => (i === e.i ? null : c)) : par)),
      )
    setEligiendo(null)
  }

  /* Los nombres se quedan: son los de la mesa de esa noche y sirven para la mano que
     sigue. Lo que se borra es la mano y lo que se había apostado en ella. */
  const limpiar = () => {
    setCartas(Array(7).fill(null))
    setRivalesCartas(Array.from({ length: 9 }, () => [null, null]))
    setEligiendo(null)
    setResultado(null)
    setBote(0)
    setApuesta(0)
  }

  const trae = listo && mesa.length >= 3 ? nombreDeLaMano(mano, mesa) : ''
  const justo = 100 / jugadores
  const equidad = resultado ? equidadDe(resultado) : 0
  const cuentas = resultado ? cuentasDeLaApuesta(equidad, bote, apuesta) : null
  /* Quién va mandando, para marcarlo: puede ser uno de los rivales y no tú. */
  const mejorParte = resultado
    ? Math.max(resultado.parte, ...resultado.porRival.map((r) => r.parte))
    : 0
  const banda = bandaDeJugabilidad(equidad, jugadores, miAsiento.posicion)
  const TONOS = {
    win: {
      caja: 'bg-win/12 text-win-tinta',
      barra: 'bg-win',
      texto: 'text-win',
    },
    ambar: {
      caja: 'bg-[#f0a81e]/15 text-[#8a5c00]',
      barra: 'bg-[#f0a81e]',
      texto: 'text-[#8a5c00]',
    },
    loss: {
      caja: 'bg-loss/12 text-loss',
      barra: 'bg-loss',
      texto: 'text-loss',
    },
  }[banda.tono]

  /** El tablero de 52 cartas: las que ya están puestas salen tachadas y no se tocan. */
  const Mazo = () => (
    <div className="mt-2 mb-3 rounded-xl border border-paper-line bg-paper-soft p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold text-ink-soft">Elige la carta</span>
        <button
          type="button"
          onClick={() => eligiendo && quitar(eligiendo)}
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
        Pon tus cartas y las que ya estén en la mesa. La app reparte la mano veinte mil veces y
        cuenta cuántas ganas.
      </p>

      {(['Tu mano', 'Flop', 'Turn', 'River'] as const).map((grupo) => (
        <div key={grupo} className="mb-2.5 flex items-center gap-3">
          <span className="w-[62px] shrink-0 text-[12px] font-semibold text-ink-soft">{grupo}</span>
          <div className="flex gap-1.5">
            {HUECOS.filter((h) => h.grupo === grupo).map((h) => (
              <Carta
                key={h.i}
                valor={cartas[h.i]}
                activa={mismoHueco(eligiendo, { tipo: 'mio', i: h.i })}
                onClick={() =>
                  setEligiendo(
                    mismoHueco(eligiendo, { tipo: 'mio', i: h.i }) ? null : { tipo: 'mio', i: h.i },
                  )
                }
              />
            ))}
          </div>
        </div>
      ))}

      {eligiendo?.tipo === 'mio' && <Mazo />}

      {/* ---- la mesa ---- */}
      <p className="field-label mt-4 mb-1">Contra cuántos juegas</p>
      <div className="mb-2 flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRivales(n)}
            className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors ${
              rivales === n ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <p className="mt-3 mb-1 text-[12px] leading-snug text-ink-soft">
        Toca la silla donde te sentarías. <b className="text-ink">D</b> es el botón y{' '}
        <b className="text-ink">CCH</b>/<b className="text-ink">CG</b> las ciegas.
      </p>
      <Mesa
        jugadores={jugadores}
        asiento={asiento}
        onElegir={setAsiento}
        etiqueta={(i) => {
          const r = rivalEnAsiento(i)
          return r < 0 ? '' : nombres[r]?.trim() || ''
        }}
        pct={(i) => {
          if (!resultado || calculando) return ''
          const r = rivalEnAsiento(i)
          const suyo = r < 0 ? resultado : resultado.porRival[r]
          return suyo ? `${suyo.parte.toFixed(0)}%` : ''
        }}
      />
      <p className="mt-0 mb-4 text-center text-[12.5px] text-ink-soft">
        <b className="text-ink">{miAsiento.nombre}</b> · posición{' '}
        {NOMBRE_POSICION[miAsiento.posicion]}
      </p>

      {/* ---- las manos de los demás ---- */}
      <button type="button" className="btn btn-ghost mb-2" onClick={() => setVerRivales((v) => !v)}>
        <Users size={16} strokeWidth={2.4} />
        {verRivales ? 'Ocultar a los demás' : 'Pon los nombres y las manos de los demás'}
      </button>

      {verRivales && (
        <div className="mb-3 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
          <p className="mt-0 mb-2.5 text-[12px] leading-snug text-ink-soft">
            El nombre es para leer la mesa con la gente de esa noche y no con "rival 3". Las cartas,
            para repasar una mano ya jugada: pon lo que enseñó cada quien. Al que dejes en blanco se
            le siguen repartiendo cartas al azar.
          </p>
          {Array.from({ length: rivales }, (_, r) => (
            <div key={r} className="mb-2 flex items-center gap-2 last:mb-0">
              <div className="field-box min-w-0 flex-1">
                <input
                  type="text"
                  value={nombres[r]}
                  placeholder={`Rival ${r + 1}`}
                  aria-label={`Nombre del rival ${r + 1}`}
                  maxLength={14}
                  onChange={(e) =>
                    setNombres((ns) => ns.map((n, i) => (i === r ? e.target.value : n)))
                  }
                  className="w-full border-none bg-transparent text-[13.5px] text-ink outline-none"
                />
              </div>
              <div className="flex gap-1.5">
                {[0, 1].map((i) => (
                  <Carta
                    key={i}
                    valor={rivalesCartas[r][i]}
                    tam="chica"
                    activa={mismoHueco(eligiendo, { tipo: 'rival', r, i })}
                    onClick={() =>
                      setEligiendo(
                        mismoHueco(eligiendo, { tipo: 'rival', r, i })
                          ? null
                          : { tipo: 'rival', r, i },
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft/80">
            El rival 1 es el de tu izquierda, y de ahí se sigue dando la vuelta a la mesa.
          </p>
          {eligiendo?.tipo === 'rival' && <Mazo />}
        </div>
      )}

      {/* ---- el resultado ---- */}
      {!listo ? (
        <div className="balance balance-ok mb-2">
          <span>
            {mano.length < 2
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
                {[
                  {
                    clave: 'yo',
                    nombre: 'Tú',
                    detalle: miAsiento.nombre,
                    suyas: mano,
                    reparto: resultado,
                  },
                  ...resultado.porRival.map((reparto, r) => {
                    const silla = asientos.find((a) => a.indice === asientoDeRival(r))
                    const suyas = manosRivales[r] ?? []
                    return {
                      clave: `r${r}`,
                      nombre: nombreDeRival(r),
                      detalle: `${silla?.nombre ?? ''}${suyas.length === 2 ? '' : ' · a ciegas'}`,
                      suyas,
                      reparto,
                    }
                  }),
                ].map((j) => {
                  const manda = j.reparto.parte >= mejorParte - 1e-9
                  return (
                    <li
                      key={j.clave}
                      className="flex items-center gap-2 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        <b
                          className={`block truncate text-[12.5px] ${manda ? 'text-win' : 'text-ink'}`}
                        >
                          {j.nombre}
                        </b>
                        <span className="block text-[10.5px] leading-tight text-ink-soft">
                          {j.detalle}
                        </span>
                      </span>
                      {j.suyas.length === 2 && (
                        <span className="flex shrink-0 gap-0.5">
                          {j.suyas.map((c) => (
                            <Carta key={c} valor={c} tam="mini" />
                          ))}
                        </span>
                      )}
                      <b
                        className={`w-12 shrink-0 text-right font-display text-[15px] tabular-nums ${
                          manda ? 'text-win' : 'text-ink'
                        }`}
                      >
                        {j.reparto.parte.toFixed(1)}%
                      </b>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-0 mb-0 text-right text-[11px] text-ink-soft/80">
                Contando que los empates se parten el bote.
              </p>

              <p className="mt-3 mb-0 text-[12.5px] leading-snug text-ink-soft">
                Repartiendo a ciegas entre {jugadores} te tocaría{' '}
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

              {/* La pregunta de la mesa no es "¿voy ganando?" sino "¿me alcanza para pagar
                  esto?". Pagar $100 a un bote de $900 necesita ganar una de cada diez; a
                  un bote de $100, una de cada dos. */}
              <div className="mt-4 border-t border-dashed border-paper-line pt-3">
                <p className="field-label mt-0 mb-1.5">
                  <Coins size={13} strokeWidth={2.6} className="-mt-0.5 mr-1 inline" />
                  ¿Conviene pagar?
                </p>
                <div className="mb-2 flex gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[11.5px] text-ink-soft">En el bote hay</span>
                    <span className="field-box block">
                      <NumInput
                        value={bote}
                        mode="decimal"
                        aria-label="Lo que hay en el bote"
                        onChange={setBote}
                      />
                    </span>
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[11.5px] text-ink-soft">Te toca pagar</span>
                    <span className="field-box block">
                      <NumInput
                        value={apuesta}
                        mode="decimal"
                        aria-label="Lo que te toca pagar"
                        onChange={setApuesta}
                      />
                    </span>
                  </label>
                </div>

                {!cuentas ? (
                  <p className="mt-0 mb-0 text-[12px] leading-snug text-ink-soft">
                    Pon lo que hay en el bote y lo que te piden, y la app dice si sale a cuentas
                    pagar con la mano que traes.
                  </p>
                ) : (
                  <>
                    <div
                      className={`rounded-xl px-3 py-2.5 ${
                        cuentas.conviene ? 'bg-win/12' : 'bg-loss/12'
                      }`}
                    >
                      <b
                        className={`block font-display text-[14.5px] ${
                          cuentas.conviene ? 'text-win-tinta' : 'text-loss'
                        }`}
                      >
                        {cuentas.conviene ? 'Sí sale a cuentas pagar' : 'No sale a cuentas pagar'}
                      </b>
                      <p className="mt-1 mb-0 text-[12.5px] leading-snug text-ink">
                        Pagar {money(apuesta)} a un bote de {money(bote)} te pide ganar{' '}
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
                      La apuesta es {(cuentas.parteDelBote * 100).toFixed(0)}% del bote. Esto sólo
                      cuenta esta carta: si te van a volver a apostar después, te hace falta más
                      margen del que dice aquí.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {(cartas.some((c) => c !== null) || usadas.size > 0) && (
        <button type="button" className="btn btn-ghost mb-2" onClick={limpiar}>
          <RotateCcw size={16} strokeWidth={2.4} />
          Empezar de nuevo
        </button>
      )}
    </Sheet>
  )
}
