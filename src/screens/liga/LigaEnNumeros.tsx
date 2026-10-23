import { useState } from 'react'
import Cara from '../../components/Cara'
import SelectorJugador from '../../components/SelectorJugador'
import { money, signed } from '../../lib/money'
import type { Posicion, TablaPosiciones } from '../../lib/api'
import { useApp } from '../../store/app'

/*
 * Lo que cuenta la temporada cuando ya pasaron varias noches.
 *
 * La tabla de arriba dice quién va ganando. Esto dice lo otro: a quién le ganas
 * siempre, quién te tiene medido, si vienes subiendo o llevas meses cayendo, y si
 * juegas parejo o a lo bestia. Nada de aquí cambia el campeonato; es para discutirlo.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return `${d} ${MESES[m - 1]}`
}

/*
 * Las noches sin nombre se identifican por su fecha, y del servidor viene cruda.
 * "2026-08-07" no se lee; "7 de agosto" sí.
 */
const comoSeLlama = (detalle: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(detalle) ? fechaCorta(detalle) : detalle

export default function LigaEnNumeros({ tabla }: { tabla: TablaPosiciones }) {
  const yo = useApp((s) => s.usuario)
  const conHistorial = tabla.posiciones.filter((p) => p.partidas > 0)

  /* De quién se habla. Arranca en uno mismo, que es de quien se quiere saber. */
  const mio = conHistorial.find((p) => p.usuarioId === yo?.id)
  const [quien, setQuien] = useState<string | null>(null)
  const elegido = conHistorial.find((p) => p.usuarioId === quien) ?? mio ?? conHistorial[0]

  if (conHistorial.length === 0) return null

  return (
    <>
      <LaLigaEnCifras tabla={tabla} />
      <Records tabla={tabla} />

      {conHistorial.length > 1 && (
        <section className="panel">
          <p className="panel-title">
            <span>De quién hablamos</span>
          </p>
          <SelectorJugador
            titulo="¿De quién?"
            valor={elegido?.usuarioId ?? null}
            onChange={(id) => setQuien(id)}
            opciones={conHistorial.map((p) => ({
              id: p.usuarioId,
              nombre: p.nombre,
              foto: p.foto,
            }))}
          />
        </section>
      )}

      {elegido && <CaraACara tabla={tabla} yo={elegido} />}
      {elegido && <Temporada tabla={tabla} resaltado={elegido} />}
      <ParejoYMontanaRusa posiciones={conHistorial} />
    </>
  )
}

/* ------------------------------------------------------------------ las cifras */

function LaLigaEnCifras({ tabla }: { tabla: TablaPosiciones }) {
  const recompras = tabla.posiciones.reduce((a, p) => a + p.recompras, 0)

  return (
    <section className="panel">
      <p className="panel-title">
        <span>La liga en números</span>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Cifra k="Partidas" v={String(tabla.partidasContadas)} />
        <Cifra k="Dinero movido" v={money(tabla.dineroMovido)} />
        <Cifra k="Mesa promedio" v={money(tabla.promedioMesa)} />
        <Cifra
          k="La más grande"
          v={tabla.mayorMesa ? money(tabla.mayorMesa.monto) : '—'}
          pie={tabla.mayorMesa ? comoSeLlama(tabla.mayorMesa.detalle) : undefined}
        />
        <Cifra k="Jugadores" v={String(tabla.posiciones.filter((p) => p.partidas > 0).length)} />
        <Cifra k="Recompras" v={String(recompras)} />
      </div>
      {tabla.partidasAbiertas > 0 && (
        <p className="mt-3 mb-0 text-[12px] leading-snug text-ink-soft">
          Hay {tabla.partidasAbiertas} sin cerrar. No cuentan hasta que se cierren.
        </p>
      )}
    </section>
  )
}

function Cifra({ k, v, pie }: { k: string; v: string; pie?: string }) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className="stat-v">{v}</div>
      {pie && <div className="truncate text-[11px] leading-tight text-ink-soft">{pie}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ los récords */

/*
 * Los récords de la temporada.
 *
 * El servidor los venía calculando desde siempre y nadie los enseñaba. Son los que se
 * presumen: la mejor noche, la peor, la racha más larga.
 */
function Records({ tabla }: { tabla: TablaPosiciones }) {
  if (tabla.records.length === 0) return null

  /* Los que son dinero se escriben como dinero; los que son veces, pelones. */
  const esDinero = (e: string) => /noche/i.test(e)
  const esPorciento = (e: string) => /rendimiento/i.test(e)

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Los récords</span>
      </p>
      <ul className="m-0 list-none p-0">
        {tabla.records.map((r) => (
          <li
            key={r.etiqueta}
            className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-bold tracking-[.5px] text-ink-soft uppercase">
                {r.etiqueta}
              </span>
              <b className="block truncate font-display text-[17px] leading-tight text-ink">
                {r.nombre}
              </b>
              {r.detalle && (
                <span className="block truncate text-[11px] leading-tight text-ink-soft">
                  {comoSeLlama(r.detalle)}
                </span>
              )}
            </span>
            <b
              className={`shrink-0 font-display text-xl tabular-nums ${
                /peor/i.test(r.etiqueta) ? 'text-loss' : 'text-ink'
              }`}
            >
              {esDinero(r.etiqueta)
                ? signed(/peor/i.test(r.etiqueta) ? -Math.abs(r.valor) : r.valor)
                : esPorciento(r.etiqueta)
                  ? `${r.valor > 0 ? '+' : ''}${r.valor.toFixed(0)}%`
                  : String(r.valor)}
            </b>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ cara a cara */

/*
 * A quién le ganas y quién te gana.
 *
 * Es la discusión de toda la vida —"a ti siempre te gano"— y hasta ahora nadie tenía
 * con qué contestarla. Cuentan sólo las noches en que jugaron los dos, y el lugar en
 * que quedó cada uno: no el dinero, que depende de con cuánto entró cada quien.
 */
function CaraACara({ tabla, yo }: { tabla: TablaPosiciones; yo: Posicion }) {
  const nombres = new Map(tabla.posiciones.map((p) => [p.usuarioId, p]))

  const filas = tabla.caraACara
    .filter((d) => d.a === yo.usuarioId || d.b === yo.usuarioId)
    .map((d) => {
      const soyA = d.a === yo.usuarioId
      const otro = nombres.get(soyA ? d.b : d.a)
      return {
        otro,
        gane: soyA ? d.ganoA : d.ganoB,
        perdi: soyA ? d.ganoB : d.ganoA,
      }
    })
    .filter((f) => f.otro && f.gane + f.perdi > 0)
    .sort((a, b) => b.gane - b.perdi - (a.gane - a.perdi))

  if (filas.length === 0) return null

  const mejor = filas[0]
  const verdugo = filas[filas.length - 1]

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Cara a cara</span>
      </p>
      <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
        De las noches en que jugaron los dos, cuántas quedó <b className="text-ink">{yo.nombre}</b>{' '}
        arriba. El dinero no cuenta aquí: cuenta el lugar.
      </p>

      <ul className="m-0 list-none p-0">
        {filas.map((f) => {
          const dif = f.gane - f.perdi
          return (
            <li
              key={f.otro!.usuarioId}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2 last:border-b-0"
            >
              <Cara nombre={f.otro!.nombre} foto={f.otro!.foto} size={26} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                {f.otro!.nombre}
              </span>
              {f === mejor && dif > 0 && (
                <span className="shrink-0 rounded-full bg-win/12 px-2 py-0.5 text-[10px] font-bold text-win-tinta">
                  tu cliente
                </span>
              )}
              {f === verdugo && dif < 0 && (
                <span className="shrink-0 rounded-full bg-loss/12 px-2 py-0.5 text-[10px] font-bold text-loss">
                  tu verdugo
                </span>
              )}
              <b
                className={`shrink-0 font-display text-lg tabular-nums ${
                  dif > 0 ? 'text-win' : dif < 0 ? 'text-loss' : 'text-ink-soft'
                }`}
              >
                {f.gane}–{f.perdi}
              </b>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ la temporada */

/*
 * Cómo se movió el saldo de cada quien, noche por noche.
 *
 * Todas las rayas en gris y la del elegido encima, en rojo. Con una raya por jugador y
 * todas del mismo color no se entiende nada; así se lee de un vistazo si alguien viene
 * subiendo o lleva meses cayendo.
 */
function Temporada({ tabla, resaltado }: { tabla: TablaPosiciones; resaltado: Posicion }) {
  const fechas = tabla.fechas
  const conSerie = tabla.posiciones.filter((p) => p.serie.length === fechas.length && p.partidas > 0)
  if (fechas.length < 2 || conSerie.length === 0) return null

  const todos = conSerie.flatMap((p) => p.serie)
  const alto = Math.max(...todos, 0)
  const bajo = Math.min(...todos, 0)
  const rango = alto - bajo || 1

  const W = 320
  const H = 150
  const PAD_X = 6
  const PAD_Y = 10

  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, fechas.length - 1)
  const y = (v: number) => PAD_Y + ((alto - v) * (H - 2 * PAD_Y)) / rango
  const raya = (serie: number[]) => serie.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  const mia = resaltado.serie
  const cierra = mia[mia.length - 1] ?? 0

  return (
    <section className="panel">
      <p className="panel-title">
        <span>La temporada</span>
      </p>
      <p className="mt-0 mb-2.5 text-[12px] leading-snug text-ink-soft">
        El saldo de cada quien, noche por noche. En rojo va{' '}
        <b className="text-ink">{resaltado.nombre}</b>
        {fechas.length >= 30 && ' · últimas 30 noches'}.
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`Saldo por noche. ${resaltado.nombre} cierra en ${signed(cierra)}.`}
      >
        {/* La raya del cero: arriba se gana, abajo se pierde. */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          className="text-ink-soft/35"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {conSerie
          .filter((p) => p.usuarioId !== resaltado.usuarioId)
          .map((p) => (
            <polyline
              key={p.usuarioId}
              points={raya(p.serie)}
              fill="none"
              stroke="currentColor"
              className="text-ink-soft/25"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ))}
        <polyline
          points={raya(mia)}
          fill="none"
          stroke="currentColor"
          className="text-marca"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(mia.length - 1)} cy={y(cierra)} r="3.5" className="fill-marca" />
      </svg>

      <div className="mt-1 flex justify-between text-[10.5px] text-ink-soft">
        <span>{fechaCorta(fechas[0])}</span>
        <span className={cierra > 0 ? 'text-win' : cierra < 0 ? 'text-loss' : ''}>
          {resaltado.nombre.split(' ')[0]} cierra en <b>{signed(cierra)}</b>
        </span>
        <span>{fechaCorta(fechas[fechas.length - 1])}</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ cómo juegan */

/*
 * El parejo y la montaña rusa.
 *
 * Dos pueden acabar la temporada con el mismo saldo jugando de maneras opuestas. El
 * saldo no las distingue y esto sí, que es la mitad de lo que se discute en la mesa.
 */
function ParejoYMontanaRusa({ posiciones }: { posiciones: Posicion[] }) {
  const medibles = posiciones.filter((p) => p.volatilidad > 0)
  if (medibles.length < 2) return null

  const ordenados = [...medibles].sort((a, b) => a.volatilidad - b.volatilidad)
  const parejo = ordenados[0]
  const rusa = ordenados[ordenados.length - 1]

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Cómo juegan</span>
      </p>
      <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
        Cuánto se mueve el resultado de una noche a otra. Dos pueden acabar con el mismo
        saldo: uno ganando y perdiendo poquito cada viernes, el otro a lo bestia.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Extremo
          etiqueta="El más parejo"
          p={parejo}
          pie="Casi siempre deja lo mismo."
          tono="text-win"
        />
        <Extremo
          etiqueta="La montaña rusa"
          p={rusa}
          pie="Un día arrasa y al otro se hunde."
          tono="text-loss"
        />
      </div>
    </section>
  )
}

function Extremo({
  etiqueta,
  p,
  pie,
  tono,
}: {
  etiqueta: string
  p: Posicion
  pie: string
  tono: string
}) {
  return (
    <div className="stat">
      <div className="stat-k">{etiqueta}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Cara nombre={p.nombre} foto={p.foto} size={22} />
        <span className="min-w-0 truncate font-display text-base font-semibold text-ink">
          {p.nombre}
        </span>
      </div>
      <div className={`font-display text-lg font-bold ${tono}`}>
        ±{money(Math.round(p.volatilidad))}
        <span className="ml-1 font-sans text-[11px] font-normal text-ink-soft">por noche</span>
      </div>
      <div className="text-[11px] leading-tight text-ink-soft">{pie}</div>
    </div>
  )
}
