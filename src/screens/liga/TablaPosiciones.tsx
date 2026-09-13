import { Flame, Snowflake, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import Esqueleto from '../../components/Esqueleto'
import ShareBlock from '../../components/ShareBlock'
import Titulos from '../../components/Titulos'
import { EPS, money, signed } from '../../lib/money'
import type { DatosLiga, DatosTabla } from '../../lib/imagenTablas'
import {
  api,
  type PartidaResumen,
  type Posicion,
  type ResultadoNoche,
  type TablaPosiciones as Tabla,
} from '../../lib/api'
import { conAviso } from '../../store/app'

/*
 * La tabla de la liga, en tarjetas.
 *
 * Antes era seis bloques apilados —podio, los que van arriba, la liga en números, la
 * tabla, récords y una tabla ancha— y la misma gente aparecía en cinco de ellos. Con
 * doce o veinte jugadores eso se lee como una hoja de cálculo, no como una app.
 *
 * Ahora cada quien es una tarjeta con su saldo grande y cuatro números al pie, y arriba
 * se cambia entre toda la liga y una noche suelta: las mismas tarjetas, pero contando
 * lo que pasó ese día.
 */

type Orden = 'balance' | 'puntos' | 'roi' | 'promedio' | 'partidas'

const ORDENES: { id: Orden; label: string; ayuda: string }[] = [
  { id: 'balance', label: 'Saldo', ayuda: 'Lo que lleva ganado o perdido en total.' },
  {
    id: 'puntos',
    label: 'Campeonato',
    ayuda:
      'Un punto por cada jugador al que le ganaste esa noche, más uno por presentarte. Aquí no importa cuánto se apostó: gana el más constante, no el que más arriesga.',
  },
  {
    id: 'roi',
    label: 'Rendimiento',
    ayuda:
      'Cuánto rinde por cada peso que mete. No premia al que juega más, sino al que juega mejor.',
  },
  { id: 'promedio', label: 'Por noche', ayuda: 'Lo que deja una partida típica suya.' },
  { id: 'partidas', label: 'Asistencia', ayuda: 'Quién se aparece más.' },
]

const claseSaldo = (v: number) => (v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft')
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`

function fechaCorta(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function Cara({
  nombre,
  foto,
  size = 34,
}: {
  nombre: string
  foto: string | null
  size?: number
}) {
  return (
    <span
      /* `block` no es adorno: un span en linea ignora el ancho y el alto, y dentro del
         podio —que no es flex— la foto se salía del tamaño pedido. */
      className="block shrink-0 overflow-hidden rounded-full bg-ink/8"
      style={{ width: size, height: size }}
    >
      {foto ? (
        <img src={foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
          {nombre.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

function Racha({ n }: { n: number }) {
  if (Math.abs(n) < 2) return null
  const ganando = n > 0
  return (
    <span
      className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        ganando ? 'bg-win/12 text-win-tinta' : 'bg-loss/10 text-loss'
      }`}
      title={ganando ? `${n} noches ganando seguidas` : `${-n} noches perdiendo seguidas`}
    >
      {ganando ? <Flame size={10} strokeWidth={3} /> : <Snowflake size={10} strokeWidth={3} />}
      {Math.abs(n)}
    </span>
  )
}

/** El podio: el 1º en medio y más grande, sobre el fondo oscuro. */
function Podio({
  top,
}: {
  top: { id: string; nombre: string; foto: string | null; saldo: number }[]
}) {
  const orden = [1, 0, 2].filter((i) => top[i])
  return (
    <div className="mb-3 grid grid-cols-[1fr_1.15fr_1fr] items-end gap-1.5">
      {orden.map((i) => {
        const p = top[i]
        const primero = i === 0
        return (
          <div
            key={p.id}
            className={`rounded-2xl px-1.5 pb-3 text-center ${
              primero
                ? 'bg-gradient-to-b from-marca to-marca-tinta pt-4 ring-1 ring-marca-alta/60'
                : 'bg-white/6 pt-2.5 ring-1 ring-white/10'
            }`}
          >
            <div
              className={`font-display text-[11px] font-bold tracking-[1px] ${
                primero ? 'text-white/85' : 'text-tiza-suave'
              }`}
            >
              {i + 1}º
            </div>
            <span className="mx-auto mt-1.5 block w-fit">
              <Cara nombre={p.nombre} foto={p.foto} size={primero ? 46 : 34} />
            </span>
            <div className="mt-1.5 truncate text-[12px] font-semibold text-white">{p.nombre}</div>
            <div
              className={`font-display text-[17px] font-bold ${
                primero
                  ? 'text-white'
                  : p.saldo > EPS
                    ? 'text-win-alto'
                    : p.saldo < -EPS
                      ? 'text-loss-alto'
                      : 'text-tiza-suave'
              }`}
            >
              {signed(p.saldo)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Una tarjeta: quién, cuánto, y cuatro números al pie. */
function Tarjeta({
  puesto,
  nombre,
  foto,
  saldo,
  bajo,
  pies,
}: {
  puesto: number
  nombre: string
  foto: string | null
  saldo: number
  bajo?: React.ReactNode
  pies: { k: string; v: string; clase?: string }[]
}) {
  return (
    <article className="mb-2 rounded-[14px] bg-paper p-3 shadow-[0_6px_16px_rgba(0,0,0,.22)]">
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-center font-display text-[15px] font-bold text-ink-soft">
          {puesto}
        </span>
        <Cara nombre={nombre} foto={foto} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] text-ink">{nombre}</b>
          {bajo && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
              {bajo}
            </span>
          )}
        </span>
        <span className={`font-display text-[19px] font-bold tabular-nums ${claseSaldo(saldo)}`}>
          {signed(saldo)}
        </span>
      </div>

      <dl className="mt-2.5 flex gap-1.5">
        {pies.map((pie) => (
          <div
            key={pie.k}
            className="flex-1 rounded-[9px] border border-paper-line bg-paper-soft px-0.5 py-1.5 text-center"
          >
            <dt className="text-[8.5px] tracking-[.4px] text-ink-soft uppercase">{pie.k}</dt>
            <dd
              className={`m-0 mt-px font-display text-[14px] font-bold tabular-nums ${pie.clase ?? 'text-ink'}`}
            >
              {pie.v}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

interface Props {
  tabla: Tabla | null
  nombreLiga: string
  /** Para poder mirar una noche suelta sin salir de la tabla. */
  partidas: PartidaResumen[]
}

export default function TablaPosiciones({ tabla, nombreLiga, partidas }: Props) {
  const [modo, setModo] = useState<'liga' | 'noche'>('liga')
  const [orden, setOrden] = useState<Orden>('balance')

  /* Sólo las cerradas tienen resultado: en una abierta las fichas no están contadas. */
  const jugadas = partidas.filter((p) => p.estado === 'cerrada')
  const [cual, setCual] = useState<string | null>(null)
  const [noche, setNoche] = useState<ResultadoNoche | null>(null)
  const [cargando, setCargando] = useState(false)

  const elegida = cual ?? jugadas[0]?.id ?? null

  useEffect(() => {
    if (modo !== 'noche' || !elegida) return
    let cancelado = false
    setCargando(true)
    void (async () => {
      const r = await conAviso(() => api.resultado(elegida))
      if (cancelado) return
      setNoche(r ?? null)
      setCargando(false)
    })()
    return () => {
      cancelado = true
    }
  }, [modo, elegida])

  if (!tabla) return <Esqueleto filas={2} />

  if (tabla.posiciones.length === 0) {
    return (
      <section className="panel text-center">
        <Trophy size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
        <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Todavía sin números</p>
        <p className="mx-auto mb-0 max-w-[320px] text-[13px] leading-snug text-ink-soft">
          {tabla.partidasAbiertas > 0
            ? `Hay ${tabla.partidasAbiertas} ${tabla.partidasAbiertas === 1 ? 'partida abierta' : 'partidas abiertas'}. La tabla se llena cuando las cierres, porque hasta entonces las fichas no están contadas.`
            : 'Cuando cierres tu primera partida, aquí aparece quién va arriba en la liga.'}
        </p>
      </section>
    )
  }

  const Interruptor = (
    <div className="mb-3 flex gap-1 rounded-xl bg-black/30 p-1">
      {(
        [
          ['liga', 'Toda la liga'],
          ['noche', 'Por partida'],
        ] as const
      ).map(([id, texto]) => (
        <button
          key={id}
          type="button"
          aria-pressed={modo === id}
          onClick={() => setModo(id)}
          className={`flex-1 cursor-pointer rounded-[9px] border-none py-1.5 text-[12.5px] font-bold transition-colors ${
            modo === id ? 'bg-paper text-ink' : 'bg-transparent text-tiza-suave'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )

  /* ---- una noche suelta ---- */
  if (modo === 'noche') {
    if (jugadas.length === 0) {
      return (
        <>
          {Interruptor}
          <section className="panel text-center">
            <p className="m-0 text-[13px] leading-snug text-ink-soft">
              Todavía no hay ninguna partida cerrada que mirar.
            </p>
          </section>
        </>
      )
    }

    const esTorneo = noche?.partida.tipo === 'torneo'
    const texto = () => {
      if (!noche) return ''
      const lineas = [
        `♠ ${nombreLiga} — ${noche.partida.nombre || fechaCorta(noche.partida.fecha)}`,
        '',
      ]
      noche.filas.forEach((f) => {
        const medalla = ['🥇', '🥈', '🥉'][f.lugar - 1] ?? `${f.lugar}º`
        lineas.push(`${medalla} ${f.nombre}: ${signed(f.resultado)}`)
      })
      lineas.push('', `${noche.filas.length} jugadores · ${money(noche.mesa)} en la mesa`)
      return lineas.join('\n')
    }

    const imagen: DatosTabla | null = noche && {
      tipo: 'tabla',
      titulo: noche.partida.nombre || fechaCorta(noche.partida.fecha),
      subtitulo: `${noche.filas.length} jugadores · ${money(noche.mesa)} en la mesa`,
      gorro: nombreLiga,
      columnas: ['Jugador', 'Puso', esTorneo ? 'Premio' : 'Sacó', 'Saldo'],
      filas: noche.filas.map((f) => [f.nombre, money(f.puso), money(f.saco), signed(f.resultado)]),
      fotos: noche.filas.map((f) => f.foto),
      pie: `${noche.filas.length} jugadores`,
    }

    return (
      <>
        {Interruptor}

        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          {jugadas.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={elegida === p.id}
              onClick={() => setCual(p.id)}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                elegida === p.id
                  ? 'border-paper bg-paper text-ink'
                  : 'border-white/12 bg-white/8 text-tiza-suave'
              }`}
            >
              {p.nombre || fechaCorta(p.fecha)}
            </button>
          ))}
        </div>

        {cargando || !noche ? (
          <Esqueleto filas={2} />
        ) : noche.filas.length === 0 ? (
          <section className="panel text-center">
            <p className="m-0 text-[13px] text-ink-soft">Esa noche no tiene jugadores cargados.</p>
          </section>
        ) : (
          <>
            <p className="mt-0 mb-3 px-1 text-[12px] text-tiza-suave">
              {esTorneo ? 'Torneo' : 'Cash'} · {noche.filas.length} jugadores ·{' '}
              <b className="text-white">{money(noche.mesa)}</b> en la mesa
            </p>

            <Podio
              top={noche.filas.slice(0, 3).map((f) => ({
                id: f.usuarioId,
                nombre: f.nombre,
                foto: f.foto,
                saldo: f.resultado,
              }))}
            />

            {noche.filas.map((f) => (
              <Tarjeta
                key={f.usuarioId}
                puesto={f.lugar}
                nombre={f.nombre}
                foto={f.foto}
                saldo={f.resultado}
                bajo={
                  esTorneo && f.lugarTorneo ? (
                    <span>{f.lugarTorneo}º lugar · premio de la bolsa</span>
                  ) : f.recompras > 0 ? (
                    <span>
                      {f.recompras} {f.recompras === 1 ? 'recompra' : 'recompras'}
                    </span>
                  ) : undefined
                }
                pies={[
                  { k: 'Puso', v: money(f.puso) },
                  { k: esTorneo ? 'Premio' : 'Sacó', v: money(f.saco) },
                  {
                    k: 'Saldo',
                    v: signed(f.resultado),
                    clase: claseSaldo(f.resultado),
                  },
                  {
                    k: 'De la mesa',
                    v: `${noche.mesa > 0 ? Math.round((f.saco / noche.mesa) * 100) : 0}%`,
                  },
                ]}
              />
            ))}

            <section className="panel">
              <p className="panel-title">
                <span>Presumir esta noche</span>
              </p>
              {imagen && (
                <ShareBlock datos={imagen} texto={texto} alt="Cómo quedó la noche" />
              )}
            </section>
          </>
        )}
      </>
    )
  }

  /* ---- toda la liga ---- */
  const porSaldo = [...tabla.posiciones].sort((a, b) => b.balance - a.balance)
  const ordenadas = [...tabla.posiciones].sort((a, b) => {
    if (orden === 'puntos') return b.puntos - a.puntos || b.balance - a.balance
    if (orden === 'roi') return b.roi - a.roi
    if (orden === 'promedio') return b.promedio - a.promedio
    if (orden === 'partidas') return b.partidas - a.partidas
    return b.balance - a.balance
  })
  const ayuda = ORDENES.find((o) => o.id === orden)!.ayuda

  const datosImagen: DatosLiga = {
    tipo: 'liga',
    titulo: nombreLiga,
    subtitulo: `${tabla.partidasContadas} ${tabla.partidasContadas === 1 ? 'partida' : 'partidas'} · tabla acumulada`,
    filas: porSaldo.map((p, i) => ({
      puesto: i + 1,
      nombre: p.nombre,
      foto: p.foto,
      partidas: p.partidas,
      balance: p.balance,
      roi: p.roi,
      titulos: p.titulos.map((t) => t.etiqueta),
    })),
    partidas: tabla.partidasContadas,
    dineroMovido: tabla.dineroMovido,
  }

  const texto = () => {
    const lineas = [`♠ ${nombreLiga} — tabla de la liga`, '']
    porSaldo.forEach((p, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`
      lineas.push(`${medalla} ${p.nombre}: ${signed(p.balance)} (${pct(p.roi)}, ${p.partidas}p)`)
    })
    lineas.push('', `${tabla.partidasContadas} partidas · ${money(tabla.dineroMovido)} movidos`)
    return lineas.join('\n')
  }

  /** El número grande de la derecha cambia con el orden elegido. */
  const cifraDe = (p: Posicion) =>
    orden === 'puntos'
      ? p.puntos
      : orden === 'roi'
        ? p.roi
        : orden === 'partidas'
          ? p.partidas
          : orden === 'promedio'
            ? p.promedio
            : p.balance

  return (
    <>
      {Interruptor}

      <Podio
        top={porSaldo.slice(0, 3).map((p) => ({
          id: p.usuarioId,
          nombre: p.nombre,
          foto: p.foto,
          saldo: p.balance,
        }))}
      />

      <div className="no-scrollbar -mx-1 mb-1 flex gap-1.5 overflow-x-auto px-1">
        {ORDENES.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={orden === o.id}
            onClick={() => setOrden(o.id)}
            className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
              orden === o.id
                ? 'border-marca bg-marca text-white'
                : 'border-white/12 bg-white/8 text-tiza-suave'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1 mb-3 px-1 text-[11px] leading-snug text-tiza-suave">{ayuda}</p>

      {ordenadas.map((p, i) => (
        <Tarjeta
          key={p.usuarioId}
          puesto={i + 1}
          nombre={p.nombre}
          foto={p.foto}
          saldo={cifraDe(p)}
          bajo={
            <>
              <span className="truncate">
                {p.partidas} {p.partidas === 1 ? 'partida' : 'partidas'} · ganó {p.ganadas}
                {!p.esMiembro && ' · ya no está'}
              </span>
              <Racha n={p.rachaActual} />
              <Titulos titulos={p.titulos} max={1} />
            </>
          }
          pies={[
            { k: 'Rendim.', v: pct(p.roi), clase: claseSaldo(p.roi) },
            { k: 'Por noche', v: signed(p.promedio), clase: claseSaldo(p.promedio) },
            { k: 'Mejor', v: signed(p.mejor), clase: 'text-win' },
            { k: 'Podios', v: String(p.podios) },
          ]}
        />
      ))}

      <section className="panel">
        <p className="panel-title">
          <span>La liga en números</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="stat">
            <div className="stat-k">Partidas</div>
            <div className="stat-v">{tabla.partidasContadas}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Dinero movido</div>
            <div className="stat-v">{money(tabla.dineroMovido)}</div>
          </div>
        </div>
        {tabla.partidasAbiertas > 0 && (
          <p className="mt-3 mb-0 text-[12px] leading-snug text-ink-soft">
            Hay {tabla.partidasAbiertas} sin cerrar. No cuentan hasta que se cierren.
          </p>
        )}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Presumir la tabla</span>
        </p>
        <ShareBlock datos={datosImagen} texto={texto} alt="Tabla de la liga" />
      </section>
    </>
  )
}
