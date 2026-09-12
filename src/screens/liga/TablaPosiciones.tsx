import { Flame, Info, Snowflake, Trophy } from 'lucide-react'
import { useState } from 'react'
import Esqueleto from '../../components/Esqueleto'
import Medalla from '../../components/Medalla'
import ShareBlock from '../../components/ShareBlock'
import Titulos from '../../components/Titulos'
import { EPS, money, signed } from '../../lib/money'
import type { DatosLiga } from '../../lib/imagenTablas'
import type { Posicion, TablaPosiciones as Tabla } from '../../lib/api'

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
    ayuda: 'Cuánto rinde por cada peso que mete. No premia al que juega más, sino al que juega mejor.',
  },
  { id: 'promedio', label: 'Por noche', ayuda: 'Lo que deja una partida típica suya.' },
  { id: 'partidas', label: 'Asistencia', ayuda: 'Quién se aparece más.' },
]

const claseSaldo = (v: number) => (v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft')
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`

function Avatar({ p, size = 36 }: { p: Posicion; size?: number }) {
  return (
    <span
      className="shrink-0 overflow-hidden rounded-full bg-ink/8"
      style={{ width: size, height: size }}
    >
      {p.foto ? (
        <img src={p.foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
          {p.nombre.charAt(0).toUpperCase()}
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

const ALTURA_ESCALON = ['h-[86px]', 'h-[62px]', 'h-[46px]']
const TONO_ESCALON = ['bg-marca', 'bg-[#c9c5bd]', 'bg-[#a9764a]']
/* El 1º y el 3º son oscuros y el 2º claro: el número se adapta o se pierde. */
const TINTA_ESCALON = ['text-white', 'text-[#17171b]', 'text-white']

/** El podio: el 1º en medio y más alto, como en el de verdad. */
function Podio({ top }: { top: Posicion[] }) {
  const orden = [1, 0, 2].filter((i) => top[i])
  return (
    <div className="mb-3.5 overflow-hidden rounded-xl bg-gradient-to-br from-[#2a1016] to-[#100e12] px-3 pt-4 pb-0 ring-1 ring-marca/35">
      <div className="flex items-end justify-center gap-2">
        {orden.map((i) => {
          const p = top[i]
          return (
            <div key={p.usuarioId} className="flex min-w-0 flex-1 flex-col items-center">
              <span className="mb-1.5 h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-marca/40">
                {p.foto ? (
                  <img src={p.foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-marca-alta">
                    {p.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center font-display text-[15px] font-semibold text-white">
                {p.nombre}
              </span>
              <span
                className="font-display text-lg font-bold"
                style={{ color: p.balance > EPS ? '#4fc785' : p.balance < -EPS ? '#ff6b6b' : '#8d8a86' }}
              >
                {signed(p.balance)}
              </span>
              <div
                className={`mt-1.5 flex w-full items-start justify-center rounded-t-lg pt-2 ${ALTURA_ESCALON[i]} ${TONO_ESCALON[i]}`}
              >
                <span className={`font-display text-xl font-bold ${TINTA_ESCALON[i]}`}>{i + 1}º</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TablaPosiciones({
  tabla,
  nombreLiga,
}: {
  tabla: Tabla | null
  nombreLiga: string
}) {
  const [orden, setOrden] = useState<Orden>('balance')

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

  // El podio y los "en positivo" siempre van por saldo: presumir es por dinero.
  const porSaldo = [...tabla.posiciones].sort((a, b) => b.balance - a.balance)
  const enPositivo = porSaldo.filter((p) => p.balance > EPS)

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

  return (
    <>
      <Podio top={porSaldo.slice(0, 3)} />

      {/* los que van arriba */}
      {enPositivo.length > 0 && (
        <section className="panel">
          <p className="panel-title">
            <span>Los que van arriba</span>
          </p>
          <ul className="m-0 list-none p-0">
            {enPositivo.map((p, i) => (
              <li
                key={p.usuarioId}
                className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
              >
                <span className="w-5 shrink-0 text-center">
                  {i < 3 ? (
                    <Medalla lugar={i + 1} size={17} />
                  ) : (
                    <span className="font-display text-sm font-bold text-ink-soft">{i + 1}</span>
                  )}
                </span>
                <Avatar p={p} size={32} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] text-ink">{p.nombre}</b>
                  <Titulos titulos={p.titulos} max={2} />
                </span>
                <span className="shrink-0 font-display font-bold text-win">{signed(p.balance)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 mb-0 text-[12px] leading-snug text-ink-soft">
            {enPositivo.length} de {tabla.posiciones.length} van con saldo a favor.
          </p>
        </section>
      )}

      {/* resumen de la liga */}
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
          <div className="stat">
            <div className="stat-k">Promedio por mesa</div>
            <div className="stat-v">{money(tabla.promedioMesa)}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Jugadores</div>
            <div className="stat-v">{tabla.posiciones.length}</div>
          </div>
        </div>
        {tabla.mayorMesa && (
          <p className="mt-2.5 mb-0 text-[13px] text-ink-soft">
            La noche más grande fue <b className="text-ink">{tabla.mayorMesa.detalle}</b> con{' '}
            <b className="text-ink">{money(tabla.mayorMesa.monto)}</b> en la mesa.
          </p>
        )}
      </section>

      {/* tabla ordenable */}
      <section className="panel">
        <p className="panel-title">
          <span>Tabla de la liga</span>
        </p>

        <div className="no-scrollbar mb-1 flex gap-1 overflow-x-auto rounded-xl bg-ink/6 p-1">
          {ORDENES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={orden === o.id}
              onClick={() => setOrden(o.id)}
              className={`flex-1 cursor-pointer rounded-lg border-none px-2.5 py-1.5 text-[12px] font-bold whitespace-nowrap transition-colors ${
                orden === o.id ? 'bg-marca text-white' : 'bg-transparent text-ink-soft'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-0 mb-2 px-1 text-[11px] leading-snug text-ink-soft">{ayuda}</p>

        <ul className="m-0 list-none p-0">
          {ordenadas.map((p, i) => (
            <li
              key={p.usuarioId}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-ink-soft">
                {i < 3 ? <Medalla lugar={i + 1} size={16} /> : i + 1}
              </span>

              <Avatar p={p} />

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <b className="truncate text-[15px] text-ink">{p.nombre}</b>
                  <Racha n={p.rachaActual} />
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {p.partidas} {p.partidas === 1 ? 'partida' : 'partidas'} · ganó {p.ganadas}
                  {p.podios > 0 && ` · ${p.podios} podio${p.podios === 1 ? '' : 's'}`}
                  {!p.esMiembro && ' · ya no está'}
                </span>
              </span>

              <span className="shrink-0 text-right">
                {orden === 'puntos' ? (
                  <>
                    <span className="block font-display font-bold text-ink">
                      {p.puntos}
                      <span className="text-[11px] font-normal text-ink-soft"> pts</span>
                    </span>
                    <span className={`block text-[11px] ${claseSaldo(p.balance)}`}>
                      {signed(p.balance)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`block font-display font-bold ${claseSaldo(p.balance)}`}>
                      {orden === 'roi'
                        ? pct(p.roi)
                        : orden === 'partidas'
                          ? p.partidas
                          : signed(orden === 'promedio' ? p.promedio : p.balance)}
                    </span>
                    <span className="block text-[11px] text-ink-soft">
                      {orden === 'balance' ? pct(p.roi) : signed(p.balance)}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* récords */}
      {tabla.records.length > 0 && (
        <section className="panel">
          <p className="panel-title">
            <span>Récords</span>
          </p>
          <ul className="m-0 list-none p-0">
            {tabla.records.map((r) => (
              <li
                key={r.etiqueta}
                className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold tracking-[.5px] text-ink-soft uppercase">
                    {r.etiqueta}
                  </span>
                  <b className="block truncate text-[15px] text-ink">{r.nombre}</b>
                </span>
                <span className="shrink-0 text-right">
                  <b className="block font-display text-[15px] text-ink">
                    {r.etiqueta === 'Mejor rendimiento'
                      ? pct(r.valor)
                      : r.etiqueta === 'Peor noche'
                        ? signed(-r.valor)
                        : r.etiqueta === 'Mejor noche'
                          ? signed(r.valor)
                          : r.valor}
                  </b>
                  {r.detalle && <span className="block text-[11px] text-ink-soft">{r.detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* el detalle completo */}
      <section className="panel">
        <p className="panel-title">
          <span>El detalle</span>
        </p>
        <div className="no-scrollbar -mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
                <th className="px-1 pb-2 font-semibold">Jugador</th>
                <th className="px-1 pb-2 text-right font-semibold">Puso</th>
                <th className="px-1 pb-2 text-right font-semibold">Sacó</th>
                <th className="px-1 pb-2 text-right font-semibold">Saldo</th>
                <th className="px-1 pb-2 text-right font-semibold">Rend.</th>
                <th className="px-1 pb-2 text-right font-semibold">Mejor</th>
                <th className="px-1 pb-2 text-right font-semibold">Peor</th>
                <th className="px-1 pb-2 text-right font-semibold">Recom.</th>
                <th className="px-1 pb-2 text-right font-semibold">Asist.</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((p) => (
                <tr key={p.usuarioId} className="border-t border-dashed border-paper-line">
                  <td className="max-w-[110px] truncate px-1 py-2 font-semibold text-ink">
                    {p.nombre}
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">{money(p.invertido)}</td>
                  <td className="px-1 py-2 text-right text-ink-soft">{money(p.recuperado)}</td>
                  <td className={`px-1 py-2 text-right font-semibold ${claseSaldo(p.balance)}`}>
                    {signed(p.balance)}
                  </td>
                  <td className={`px-1 py-2 text-right font-semibold ${claseSaldo(p.roi)}`}>
                    {pct(p.roi)}
                  </td>
                  <td className="px-1 py-2 text-right font-semibold text-win">
                    {p.mejor > EPS ? signed(p.mejor) : '—'}
                  </td>
                  <td className="px-1 py-2 text-right font-semibold text-loss">
                    {p.peor < -EPS ? signed(p.peor) : '—'}
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">
                    {p.recompras > 0 ? `${p.recompras} · ${money(p.montoRecompras)}` : '—'}
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">{p.asistencia.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* compartir */}
      <section className="panel">
        <p className="panel-title">
          <span>Presumir la tabla</span>
        </p>
        <ShareBlock datos={datosImagen} texto={texto} alt="Tabla acumulada de la liga" />
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-snug text-tiza-suave">
        <Info size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
        <span>
          Suma {tabla.partidasContadas}{' '}
          {tabla.partidasContadas === 1 ? 'partida cerrada' : 'partidas cerradas'}.
          {tabla.partidasAbiertas > 0 &&
            ` Las ${tabla.partidasAbiertas} abiertas no cuentan hasta que se cierren: sin las fichas contadas, todos aparecerían perdiendo.`}
        </span>
      </p>
    </>
  )
}
