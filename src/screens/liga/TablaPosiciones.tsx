import { Flame, Snowflake, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import Cara from '../../components/Cara'
import Esqueleto from '../../components/Esqueleto'
import Sheet from '../../components/Sheet'
import ShareBlock from '../../components/ShareBlock'
import LigaEnNumeros from './LigaEnNumeros'
import Titulos from '../../components/Titulos'
import { EPS, money, signed } from '../../lib/money'
import type { DatosLiga, DatosTabla } from '../../lib/imagenTablas'
import {
  api,
  calificacionDe,
  type NocheDeAlguien,
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

type Orden = 'puntos' | 'puntosNoche' | 'balance' | 'roi' | 'promedio' | 'partidas'

/*
 * La tabla no se ordena por dinero de entrada.
 *
 * El saldo solo dice quién ganó más pesos, y eso depende tanto de cuántas noches vino
 * y de cuánto se apostó como de qué tan bien juega: con dos noches contadas, una mano
 * grande decide la tabla entera. El campeonato mira a cuánta gente le ganaste cada
 * noche, que es lo único comparable entre una mesa de cuatro y una de ocho. El dinero
 * sigue ahí, en su propio orden.
 */
const ORDENES: { id: Orden; label: string; ayuda: string }[] = [
  {
    id: 'puntos',
    label: 'Campeonato',
    ayuda:
      'Los puntos que fue juntando noche tras noche. Aquí no importa cuánto se apostó: gana el más constante, no el que más arriesga. Lo que suma cada noche lo decide la liga, y está escrito en "Cómo se reparten los puntos".',
  },
  {
    id: 'puntosNoche',
    label: 'Nivel',
    ayuda:
      'Los mismos puntos del campeonato, pero divididos entre las noches que vino. Así se ve quién juega bien aunque venga poco —y a quién lo está cargando la asistencia—.',
  },
  { id: 'balance', label: 'Saldo', ayuda: 'Lo que lleva ganado o perdido en total.' },
  {
    id: 'roi',
    label: 'Rendimiento',
    ayuda:
      'Cuánto rinde por cada peso que mete. No premia al que juega más, sino al que juega mejor. De aquí sale la calificación: Shark de 50% para arriba, Pro de 20%, Solid de 0%, Rookie hasta −20% y Fish por debajo.',
  },
  { id: 'promedio', label: 'Por noche', ayuda: 'Lo que deja una partida típica suya.' },
  { id: 'partidas', label: 'Asistencia', ayuda: 'Quién se aparece más.' },
]

const claseSaldo = (v: number) => (v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft')
/* La vista de tabla va sobre el fondo oscuro de la liga: ahí el verde y el rojo de las
   tarjetas crema no se leen. */
const tonoOscuro = (v: number) =>
  v > EPS ? '!text-win-alto' : v < -EPS ? '!text-loss-alto' : ''

/** Las columnas de la vista de tabla. El `id` es el mismo con el que se ordena. */
const COLUMNAS: {
  id: Orden
  corto: string
  dinero?: boolean
  valor: (p: Posicion) => { texto: string; n: number }
}[] = [
  { id: 'partidas', corto: 'PJ', valor: (p) => ({ texto: String(p.partidas), n: 0 }) },
  { id: 'puntos', corto: 'Pts', valor: (p) => ({ texto: String(p.puntos), n: 0 }) },
  {
    id: 'puntosNoche',
    corto: 'Pts/n',
    valor: (p) => ({ texto: p.puntosPorNoche.toFixed(1), n: 0 }),
  },
  { id: 'balance', corto: 'Saldo', dinero: true, valor: (p) => ({ texto: signed(p.balance), n: p.balance }) },
  { id: 'roi', corto: 'Rend.', dinero: true, valor: (p) => ({ texto: pct(p.roi), n: p.roi }) },
  {
    id: 'promedio',
    corto: 'Por noche',
    dinero: true,
    valor: (p) => ({ texto: signed(p.promedio), n: p.promedio }),
  },
]
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`

/*
 * La calificación del reglamento: Shark, Pro, Solid, Rookie o Fish según el rendimiento.
 * En las tarjetas cabe el nombre; en la vista de columnas sólo el animal, con el nombre
 * al tocarlo, porque el ancho de un teléfono no da para más.
 */
function Calificacion({ p, soloEmoji }: { p: Posicion; soloEmoji?: boolean }) {
  const c = calificacionDe(p.roi, p.partidas)
  if (!c) return null
  if (soloEmoji) {
    return (
      <span className="shrink-0 text-[12px]" title={`${c.nombre} · ${c.ayuda}`}>
        {c.emoji}
      </span>
    )
  }
  return (
    <span className="shrink-0" title={c.ayuda}>
      {c.emoji} {c.nombre}
    </span>
  )
}

function fechaCorta(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
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
  top: { id: string; nombre: string; foto: string | null; cifra: string; gana: boolean }[]
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
                primero ? 'text-white' : p.gana ? 'text-win-alto' : 'text-tiza-suave'
              }`}
            >
              {p.cifra}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Las noches de una persona, una por una.
 *
 * Existe por el descarte de las mejores noches: si a alguien le quitaron una noche de
 * la suma, tiene derecho a ver cuál fue y cuánto valía. De paso contesta la pregunta
 * que la app no contestaba —"¿cómo me ha ido a mí?"— sin tener que ir noche por noche.
 */
function SusNoches({ p, onCerrar }: { p: Posicion | null; onCerrar: () => void }) {
  const noches: NocheDeAlguien[] = p?.detalle ?? []
  const fuera = noches.filter((n) => !n.cuenta).length
  return (
    <Sheet abierta={!!p} onCerrar={onCerrar} titulo={p?.nombre ?? ''}>
      {noches.length === 0 ? (
        <p className="mt-0 mb-0 text-[13px] text-ink-soft">
          De esta temporada no hay noches que mostrar.
        </p>
      ) : (
        <>
          <p className="mt-0 mb-3 text-[13px] leading-relaxed text-ink-soft">
            {fuera === 0
              ? `${noches.length} ${noches.length === 1 ? 'noche' : 'noches'}, y todas cuentan para el campeonato.`
              : `${noches.length} noches. ${fuera === 1 ? 'Una no cuenta' : `${fuera} no cuentan`} para el campeonato: la liga puso que sólo sumen tus mejores. El saldo en dinero sí las cuenta todas.`}
          </p>

          <ul className="m-0 list-none p-0">
            {noches.map((n, i) => (
              <li
                key={`${n.fecha}-${i}`}
                className={`flex items-center gap-2.5 border-b border-paper-line py-2 last:border-b-0 ${
                  n.cuenta ? '' : 'opacity-55'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] text-ink">
                    {n.nombre || fechaCorta(n.fecha)}
                  </b>
                  <span className="block text-[11px] text-ink-soft">
                    {n.nombre ? fechaCorta(n.fecha) : null}
                    {!n.cuenta && (
                      <span className={n.nombre ? 'ml-1' : ''}>· descartada</span>
                    )}
                  </span>
                </span>
                <span
                  className={`w-[72px] shrink-0 text-right font-display text-[14px] font-bold tabular-nums ${claseSaldo(n.resultado)}`}
                >
                  {signed(n.resultado)}
                </span>
                <span className="w-[52px] shrink-0 text-right">
                  <b
                    className={`font-display text-[15px] font-bold tabular-nums ${
                      n.cuenta ? 'text-ink' : 'text-ink-soft line-through'
                    }`}
                  >
                    {n.puntos}
                  </b>
                  <span className="block text-[9px] tracking-[.4px] text-ink-soft uppercase">
                    pts
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 mb-0 text-[12px] leading-snug text-ink-soft">
            Suman <b className="text-ink">{p?.puntos}</b> puntos en{' '}
            {p?.nochesContadas ?? noches.length}{' '}
            {(p?.nochesContadas ?? noches.length) === 1 ? 'noche' : 'noches'}, y el saldo de
            la temporada es{' '}
            <b className={claseSaldo(p?.balance ?? 0)}>{signed(p?.balance ?? 0)}</b> contando
            las {noches.length}.
          </p>
        </>
      )}
    </Sheet>
  )
}

/** Una tarjeta: quién, cuánto, y cuatro números al pie. */
function Tarjeta({
  puesto,
  nombre,
  foto,
  cifra,
  tono,
  bajo,
  pies,
  onAbrir,
}: {
  puesto: number
  nombre: string
  foto: string | null
  /* Ya escrita por quien llama: según el orden es dinero, porcentaje o puntos, y
     cada uno se lee distinto. Un "+14" verde en el campeonato diría que ganó catorce
     pesos. */
  cifra: string
  tono: string
  bajo?: React.ReactNode
  pies: { k: string; v: string; clase?: string }[]
  /** Si viene, el renglón de arriba se vuelve botón y abre el detalle de la persona. */
  onAbrir?: () => void
}) {
  /* El renglón de arriba es el botón y el pie no: picarle a un número para abrir otra
     cosa se siente como un error de la app. */
  const Arriba = onAbrir ? 'button' : 'div'
  return (
    <article className="mb-2 rounded-[14px] bg-paper p-3 shadow-[0_6px_16px_rgba(0,0,0,.22)]">
      <Arriba
        {...(onAbrir
          ? {
              type: 'button' as const,
              onClick: onAbrir,
              'aria-label': `Ver las noches de ${nombre}`,
            }
          : {})}
        className={`flex w-full items-center gap-2.5 border-none bg-transparent p-0 text-left ${
          onAbrir ? 'cursor-pointer active:scale-[.995]' : ''
        }`}
      >
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
        <span className={`font-display text-[19px] font-bold tabular-nums ${tono}`}>
          {cifra}
        </span>
      </Arriba>

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
  const [orden, setOrden] = useState<Orden>('puntos')
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tabla')
  /** A quién se le están viendo las noches. */
  const [mirando, setMirando] = useState<Posicion | null>(null)

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
                cifra: signed(f.resultado),
                gana: f.resultado > EPS,
              }))}
            />

            {noche.filas.map((f) => (
              <Tarjeta
                key={f.usuarioId}
                puesto={f.lugar}
                nombre={f.nombre}
                foto={f.foto}
                cifra={signed(f.resultado)}
                tono={claseSaldo(f.resultado)}
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
  const ordenadas = [...tabla.posiciones].sort((a, b) => {
    if (orden === 'puntos') return b.puntos - a.puntos || b.balance - a.balance
    if (orden === 'puntosNoche')
      return b.puntosPorNoche - a.puntosPorNoche || b.partidas - a.partidas
    if (orden === 'roi') return b.roi - a.roi
    if (orden === 'promedio') return b.promedio - a.promedio
    if (orden === 'partidas') return b.partidas - a.partidas
    return b.balance - a.balance
  })
  const ayuda = ORDENES.find((o) => o.id === orden)!.ayuda

  /*
   * El mínimo de asistencia sólo manda en el campeonato.
   *
   * Es una regla sobre quién se corona, no sobre el dinero: el que se llevó más feria se
   * la llevó aunque haya venido una noche, y taparlo sería mentir. Así que cuando la
   * tabla está ordenada por puntos, el podio salta a quien no alcanzó el mínimo; en los
   * otros órdenes, el podio es el de arriba y punto.
   *
   * Los saltados no desaparecen: siguen en la tabla, en su lugar, con su aviso.
   */
  /* El descarte de las mejores noches: cuántas cuentan de cuántas. */
  const cupo = tabla.cupoDeNoches ?? 0
  const hayDescarte = cupo > 0 && cupo < tabla.partidasContadas

  const esCampeonato = orden === 'puntos' || orden === 'puntosNoche'
  const alPodio = esCampeonato ? ordenadas.filter((p) => p.puedePodio !== false) : ordenadas
  const hayVetados = esCampeonato && alPodio.length < ordenadas.length

  const datosImagen: DatosLiga = {
    tipo: 'liga',
    titulo: nombreLiga,
    subtitulo: `${tabla.partidasContadas} ${tabla.partidasContadas === 1 ? 'partida' : 'partidas'} · por ${ORDENES.find((o) => o.id === orden)!.label.toLowerCase()}`,
    filas: ordenadas.map((p, i) => ({
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
    ordenadas.forEach((p, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`
      lineas.push(`${medalla} ${p.nombre}: ${signed(p.balance)} (${pct(p.roi)}, ${p.partidas}p)`)
    })
    lineas.push('', `${tabla.partidasContadas} partidas · ${money(tabla.dineroMovido)} movidos`)
    return lineas.join('\n')
  }

  /** El número grande de la derecha cambia con el orden elegido. */
  /*
   * Cada orden se lee distinto: el dinero lleva signo y color, el rendimiento lleva %,
   * y los puntos son puntos —sin signo y sin verde, porque no son pesos que alguien se
   * llevó a casa—.
   */
  const cifraDe = (p: Posicion): { texto: string; tono: string; gana: boolean } => {
    const dinero = (v: number) => ({ texto: signed(v), tono: claseSaldo(v), gana: v > EPS })
    if (orden === 'balance') return dinero(p.balance)
    if (orden === 'promedio') return dinero(p.promedio)
    if (orden === 'roi') return { texto: pct(p.roi), tono: claseSaldo(p.roi), gana: p.roi > EPS }
    if (orden === 'puntosNoche')
      return { texto: p.puntosPorNoche.toFixed(1), tono: 'text-ink', gana: true }
    if (orden === 'partidas') return { texto: String(p.partidas), tono: 'text-ink', gana: true }
    return { texto: String(p.puntos), tono: 'text-ink', gana: true }
  }

  return (
    <>
      {Interruptor}

      <Podio
        top={alPodio.slice(0, 3).map((p) => ({
          id: p.usuarioId,
          nombre: p.nombre,
          foto: p.foto,
          cifra: cifraDe(p).texto,
          gana: cifraDe(p).gana,
        }))}
      />

      {/* Dos maneras de mirar lo mismo: las tarjetas cuentan la historia de cada quien y
          la tabla sirve para comparar a todos de un vistazo. */}
      <div className="mb-2 flex gap-1 rounded-xl bg-black/30 p-1">
        {(
          [
            ['tarjetas', 'Tarjetas'],
            ['tabla', 'Tabla'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={vista === id}
            onClick={() => setVista(id)}
            className={`flex-1 cursor-pointer rounded-[9px] border-none py-1.5 text-[12.5px] font-bold transition-colors ${
              vista === id ? 'bg-white text-marca-tinta' : 'bg-transparent text-tiza-suave'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

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
      <p className="mt-1 mb-3 px-1 text-[11px] leading-snug text-tiza-suave">
        {ayuda}
        {/* Lo mismo con el descarte: se dice donde se ve. */}
        {hayDescarte && esCampeonato && (
          <>
            {' '}
            A cada quien le cuentan sus mejores {cupo} de {tabla.partidasContadas} noches; la
            peor se cae. El saldo en dinero sí las cuenta todas.
          </>
        )}
        {/* Hay que decir qué significa el asterisco donde se ve, no en otra pantalla. */}
        {hayVetados && (
          <>
            {' '}
            <span className="text-marca-alta">*</span> Suma puntos y sale en la tabla, pero
            {(tabla.minimoNoches ?? 0) > 0
              ? ` hay que haber venido a ${tabla.minimoNoches} ${
                  tabla.minimoNoches === 1 ? 'noche' : 'noches'
                } para subir al podio.`
              : ' le falta venir a suficientes noches para subir al podio.'}
          </>
        )}
      </p>

      {vista === 'tabla' ? (
        /*
         * Todo de un vistazo, en columnas.
         *
         * Las tarjetas enseñan una cifra grande y el resto chiquito abajo, así que para
         * comparar a cuatro personas hay que ir y venir. Aquí cada columna es un dato y
         * cada renglón una persona, que es como se lee una tabla de liga de toda la
         * vida. La columna por la que se está ordenando va resaltada.
         */
        <div className="no-scrollbar -mx-1 mb-3 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-[9.5px] tracking-[.4px] text-tiza-suave uppercase">
                <th className="px-1 pb-2 text-left font-semibold">#</th>
                <th className="px-1 pb-2 text-left font-semibold">Jugador</th>
                {COLUMNAS.map((c) => (
                  <th
                    key={c.id}
                    className={`cursor-pointer px-1.5 pb-2 text-right font-semibold ${
                      orden === c.id ? 'text-white' : ''
                    }`}
                    onClick={() => setOrden(c.id)}
                  >
                    {c.corto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((p, i) => (
                <tr key={p.usuarioId} className="border-t border-white/10">
                  <td className="px-1 py-2 font-display text-[13px] font-bold text-tiza-suave">
                    {i + 1}
                    {/* El asterisco de toda la vida: va arriba en puntos, pero no se
                        corona porque le faltó venir. Sin esto, el número uno de la
                        tabla y el primero del podio son dos nombres distintos y nadie
                        entiende por qué. */}
                    {hayVetados && p.puedePodio === false && (
                      <span className="text-marca-alta" title="Le falta venir para subir al podio">
                        *
                      </span>
                    )}
                  </td>
                  <td className="max-w-[112px] px-1 py-2">
                    <span className="flex items-center gap-1.5">
                      <Cara nombre={p.nombre} foto={p.foto} size={22} />
                      <span className="truncate font-semibold text-white">{p.nombre}</span>
                      <Calificacion p={p} soloEmoji />
                    </span>
                  </td>
                  {COLUMNAS.map((c) => {
                    const v = c.valor(p)
                    return (
                      <td
                        key={c.id}
                        className={`px-1.5 py-2 text-right font-display tabular-nums ${
                          orden === c.id ? 'font-bold text-white' : 'text-tiza-suave'
                        } ${c.dinero ? tonoOscuro(v.n) : ''}`}
                      >
                        {v.texto}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        ordenadas.map((p, i) => (
          <Tarjeta
            key={p.usuarioId}
            puesto={i + 1}
            nombre={p.nombre}
            foto={p.foto}
            cifra={cifraDe(p).texto}
            tono={cifraDe(p).tono}
            onAbrir={() => setMirando(p)}
            bajo={
              <>
                <span className="truncate">
                  {p.partidas} {p.partidas === 1 ? 'partida' : 'partidas'} · ganó {p.ganadas}
                  {!p.esMiembro && ' · ya no está'}
                </span>
                {hayVetados && p.puedePodio === false && (
                  <span className="shrink-0 rounded bg-marca/15 px-1.5 py-px text-[10.5px] font-semibold text-marca-alta">
                    le falta venir
                  </span>
                )}
                <Calificacion p={p} />
                <Racha n={p.rachaActual} />
                <Titulos titulos={p.titulos} max={1} />
              </>
            }
            pies={[
              { k: 'Rendim.', v: pct(p.roi), clase: claseSaldo(p.roi) },
              { k: 'Por noche', v: signed(p.promedio), clase: claseSaldo(p.promedio) },
              { k: 'Mejor', v: signed(p.mejor), clase: 'text-win' },
              /* Con descarte encendido, cuántas noches le contaron es más interesante
                 que los podios —que casi siempre son cero— y además es lo que explica
                 su número de puntos. Sin descarte, los podios de siempre. */
              hayDescarte && p.nochesContadas !== undefined
                ? {
                    k: 'Cuentan',
                    v: `${p.nochesContadas} de ${p.partidas}`,
                    clase: p.nochesContadas < p.partidas ? 'text-marca' : 'text-ink',
                  }
                : { k: 'Podios', v: String(p.podios) },
            ]}
          />
        ))
      )}

      {/* Lo que cuenta la temporada cuando ya pasaron varias noches: récords, cara a
          cara, cómo se ha movido el saldo y quién juega parejo. */}
      <LigaEnNumeros tabla={tabla} />

      <section className="panel">
        <p className="panel-title">
          <span>Presumir la tabla</span>
        </p>
        <ShareBlock datos={datosImagen} texto={texto} alt="Tabla de la liga" />
      </section>

      <SusNoches p={mirando} onCerrar={() => setMirando(null)} />
    </>
  )
}
