import { AlertTriangle, Check, Minus, Plus } from 'lucide-react'
import ContadorFichas from '../../components/ContadorFichas'
import Medalla from '../../components/Medalla'
import NumInput from '../../components/NumInput'
import Premios from '../liga/Premios'
import RepartoDinero from './RepartoDinero'
import { leerJson, type ConfigTorneo } from '../../lib/api'
import { money, num, signed } from '../../lib/money'
import { avisosDe, bolsaDe, enPuntos, fichasDadas, tablaTornecash } from '../../lib/tornecash'
import type { Chips } from '../../store/types'
import { GuardarConteo, ListaDeLaMesa, claseClara, type PropsPestana } from './comun'

export type PestanaTornecash = 'jugadores' | 'final' | 'resultado'

export const PESTANAS_TORNECASH: { id: PestanaTornecash; label: string }[] = [
  { id: 'jugadores', label: 'Registro' },
  { id: 'final', label: 'Conteo' },
  { id: 'resultado', label: 'Resultado' },
]

/** Los puntos de tornecash se escriben pelones: no son pesos y confundirlos cuesta. */
const puntos = (n: number) => Math.round(n).toLocaleString('es-MX')
const puntosConSigno = (n: number) => (n >= 0 ? '+' : '−') + puntos(Math.abs(n))

/*
 * Una noche de tornecash.
 *
 * Las otras dos modalidades son simples de contar: en cash las fichas son pesos, y en
 * torneo el lugar lo dice quien llevó el banco. Aquí no: se entra con una cuota, se
 * reciben fichas que valen otra cosa, y el lugar sale de restar. Por eso la pantalla
 * enseña siempre las dos columnas —lo que le dieron y con lo que acabó—, que es la
 * resta que todo el mundo va a querer comprobar a las dos de la mañana.
 */
export default function PartidaTornecash({
  pestana,
  datos,
  colores,
  puedeEditar,
  puedeContar,
  tocar,
  torneo,
  cambiarTorneo,
  onRedondeo,
}: PropsPestana & {
  pestana: PestanaTornecash
  torneo: ConfigTorneo
  cambiarTorneo: (t: ConfigTorneo) => void
  onRedondeo: (paso: number) => void
}) {
  const tabla = tablaTornecash(datos.participaciones, torneo, colores)
  const bolsa = bolsaDe(datos.participaciones, torneo)
  const avisos = avisosDe(datos.participaciones, torneo)

  /** El nombre de cada quien, que la tabla sólo trae la participación. */
  const nombreDe = (id: string) => datos.participaciones.find((p) => p.id === id)?.nombre ?? ''

  /* ------------------------------------------------ registro y recompras */
  if (pestana === 'jugadores') {
    const cambiarRecompras = (id: string, cuantas: number) =>
      tocar(id, { rebuys: Math.max(0, cuantas) }, { rebuys: Math.max(0, cuantas) })

    return (
      <>
        <ListaDeLaMesa
          filas={datos.participaciones.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            monto: num(torneo.buyIn) * (1 + num(p.rebuys)),
          }))}
        />

        <section className="panel">
          <p className="panel-title">
            <span>Cómo va la bolsa</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-noche-linea px-3 py-2.5 text-paper">
              <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
                Se ha juntado
              </span>
              <b className="font-display text-2xl">{money(bolsa)}</b>
            </div>
            <div className="rounded-xl border border-paper-line bg-white px-3 py-2.5">
              <span className="block text-[10px] tracking-[.6px] text-ink-soft uppercase">
                Entradas y recompras
              </span>
              <b className="font-display text-2xl text-ink">
                {datos.participaciones.reduce((a, p) => a + 1 + num(p.rebuys), 0)}
              </b>
            </div>
          </div>
        </section>

        {/* Las recompras, una por una. La regla de la casa va escrita arriba porque es
            justo la que se discute a las once y media, con alguien recién quebrado. */}
        <section className="panel">
          <p className="panel-title">
            <span>Recompras</span>
          </p>
          <p className="mt-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
            Las que quiera cada quien, siempre a{' '}
            <b className="text-ink">{money(num(torneo.buyIn))}</b>, y cada una da otras{' '}
            <b className="text-ink">{puntos(num(torneo.stack))}</b> fichas.{' '}
            <b className="text-ink">Sólo cuando se queda en ceros</b>: no se le echan fichas
            encima a las que ya trae.
          </p>

          {datos.participaciones.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 border-t border-dashed border-paper-line py-2.5 first:border-t-0"
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm font-semibold text-ink">{p.nombre}</b>
                <span className="block text-[11.5px] leading-tight text-ink-soft">
                  puso {money(num(torneo.buyIn) * (1 + num(p.rebuys)))} · le dieron{' '}
                  {puntos(fichasDadas(p, torneo))} fichas
                </span>
              </span>

              <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-paper-line bg-white">
                <button
                  type="button"
                  disabled={!puedeEditar || num(p.rebuys) === 0}
                  aria-label={`Una recompra menos de ${p.nombre}`}
                  onClick={() => cambiarRecompras(p.id, num(p.rebuys) - 1)}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-ink/6 text-ink active:scale-90 disabled:opacity-30"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <span className="w-10 text-center font-display text-lg font-bold text-ink tabular-nums">
                  {num(p.rebuys)}
                </span>
                <button
                  type="button"
                  disabled={!puedeEditar}
                  aria-label={`Una recompra más de ${p.nombre}`}
                  onClick={() => cambiarRecompras(p.id, num(p.rebuys) + 1)}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-ink/6 text-ink active:scale-90 disabled:opacity-30"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </section>

        {puedeEditar && <Ajustes torneo={torneo} cambiar={cambiarTorneo} colores={colores} />}
      </>
    )
  }

  /* ------------------------------------------------ el conteo del final */
  if (pestana === 'final') {
    return (
      <>
        <section className="panel">
          <p className="panel-title">
            <span>Contar las fichas</span>
          </p>
          <p className="mt-0 mb-0 text-[12.5px] leading-snug text-ink-soft">
            De aquí sale el lugar de cada quien. Lo que cuenta no son las fichas que tiene
            enfrente, sino <b className="text-ink">lo que le ganó a la noche</b>: esas fichas
            menos todas las que le dieron al entrar y al recomprar. Cualquiera de la mesa puede
            capturar un conteo.
          </p>
        </section>

        {tabla.map((x) => {
          const p = x.jugador
          const fichas = leerJson<Chips>(p.fichas_final, {})
          /*
           * Quedarse en ceros aquí es lo más normal del mundo —es la condición para
           * recomprar—, así que "contado" no puede salir de tener fichas: sale de que
           * alguien de verdad haya capturado el conteo.
           */
          const yaContado = p.contadas_por !== null || x.finales > 0
          return (
            <section
              key={p.id}
              className={`panel ${yaContado ? '' : 'opacity-95 ring-1 ring-marca/25'}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
                  {p.nombre}
                </b>
                {yaContado ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-win/12 px-2 py-0.5 text-[11px] font-bold text-win-tinta">
                    <Check size={11} strokeWidth={3} />
                    Contado
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-marca/20 px-2 py-0.5 text-[11px] font-bold text-marca-tinta">
                    Falta
                  </span>
                )}
              </div>

              <ContadorFichas
                colores={colores}
                fichas={fichas}
                valores={torneo.valores}
                formato={puntos}
                deshabilitado={!puedeContar}
                onChange={(key, v) => {
                  const nuevas = { ...fichas, [key]: v }
                  tocar(p.id, { fichas_final: JSON.stringify(nuevas) }, { fichasFinal: nuevas })
                }}
              />

              <GuardarConteo
                id={p.id}
                fichas={fichas}
                contado={yaContado}
                deshabilitado={!puedeContar}
              />

              {/* La resta, siempre a la vista: es la que todos van a querer comprobar. */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-paper-line bg-white px-2.5 py-2">
                  <span className="block text-[10px] tracking-[.5px] text-ink-soft uppercase">
                    Le dieron
                  </span>
                  <b className="font-display text-lg text-ink-soft tabular-nums">
                    {puntos(x.dadas)}
                  </b>
                </div>
                <div className="rounded-xl border border-paper-line bg-white px-2.5 py-2">
                  <span className="block text-[10px] tracking-[.5px] text-ink-soft uppercase">
                    Acabó con
                  </span>
                  <b className="font-display text-lg text-ink tabular-nums">{puntos(x.finales)}</b>
                </div>
                <div className="rounded-xl bg-noche-linea px-2.5 py-2 text-paper">
                  <span className="block text-[10px] tracking-[.5px] uppercase opacity-70">
                    Le ganó
                  </span>
                  <b
                    className="font-display text-lg tabular-nums"
                    style={{ color: x.neta > 0 ? '#4fc785' : x.neta < 0 ? '#ff6b6b' : '#8d8a86' }}
                  >
                    {puntosConSigno(x.neta)}
                  </b>
                </div>
              </div>
            </section>
          )
        })}
      </>
    )
  }

  /* ------------------------------------------------ cómo quedó la noche */
  return (
    <>
      {avisos.length > 0 && (
        <section className="panel ring-1 ring-marca/30">
          <p className="panel-title">
            <span>Antes de cerrar</span>
          </p>
          <ul className="m-0 list-none p-0">
            {avisos.map((a, i) => (
              <li key={i} className="flex items-start gap-2 py-1">
                <AlertTriangle size={14} strokeWidth={2.6} className="mt-0.5 shrink-0 text-marca" />
                <span className="text-[12.5px] leading-snug text-ink">{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <p className="panel-title">
          <span>Cómo quedaron</span>
        </p>
        <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
          Por lo que le ganó cada quien a la noche. La bolsa de{' '}
          <b className="text-ink">{money(bolsa)}</b> se reparte entre los de arriba.
        </p>

        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
                <th className="px-1 pb-2 font-semibold">Jugador</th>
                <th className="px-1 pb-2 text-right font-semibold">Le ganó</th>
                <th className="px-1 pb-2 text-right font-semibold">Cobra</th>
                <th className="px-1 pb-2 text-right font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((x) => (
                <tr key={x.jugador.id} className="border-t border-dashed border-paper-line">
                  <td className="max-w-[150px] px-1 py-2">
                    <span className="flex items-center gap-1.5">
                      {x.saco > 0 && <Medalla lugar={x.lugar} size={14} />}
                      <span className="truncate font-semibold text-ink">{nombreDe(x.jugador.id)}</span>
                    </span>
                    <span className="block text-[10.5px] leading-tight text-wrap text-ink-soft">
                      {x.lugar}º · puso {money(x.puso)}
                      {num(x.jugador.rebuys) > 0 &&
                        ` · ${num(x.jugador.rebuys)} ${num(x.jugador.rebuys) === 1 ? 'recompra' : 'recompras'}`}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-right font-display whitespace-nowrap tabular-nums text-ink">
                    {puntosConSigno(x.neta)}
                  </td>
                  <td className="px-1 py-2 text-right font-display whitespace-nowrap tabular-nums text-ink">
                    {x.saco > 0 ? money(x.saco) : '—'}
                  </td>
                  <td
                    className={`px-1 py-2 text-right font-display whitespace-nowrap tabular-nums ${claseClara(x.resultado)}`}
                  >
                    {signed(x.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* A quién ya se le pagó y a quién no. Sólo salen los que cobran: en tornecash
          el que no alcanzó lugar no recibe nada y ponerlo en la lista de pagos nada
          más estorba a las dos de la mañana. */}
      <RepartoDinero
        filas={tabla
          .filter((x) => x.saco > 0)
          .map((x) => ({ p: x.jugador, nombre: nombreDe(x.jugador.id), leToca: x.saco }))}
        totalMesa={bolsa}
        redondeo={datos.partida.redondeo ?? 50}
        puedeEditar={puedeEditar}
        titulo={datos.liga.nombre}
        subtitulo={datos.partida.nombre || datos.partida.fecha}
        onRedondeo={onRedondeo}
        onPago={(id, pagado) => tocar(id, { pagado }, { pagado })}
      />

      {puedeEditar && <Ajustes torneo={torneo} cambiar={cambiarTorneo} colores={colores} />}
    </>
  )
}

/*
 * Lo que se acordó esa noche: cuánto cuesta entrar, cuántas fichas da, cuánto vale
 * cada color y cómo se parte la bolsa.
 *
 * Va dentro de la partida y no en la liga porque cambia de una noche a otra, y porque
 * la mesa a veces decide pagar un lugar más a medio juego. Lo mismo que ya se hace en
 * los torneos.
 */
function Ajustes({
  torneo,
  cambiar,
  colores,
}: {
  torneo: ConfigTorneo
  cambiar: (t: ConfigTorneo) => void
  colores: { key: string; label: string; value: number }[]
}) {
  const valorDe = (key: string) =>
    num(torneo.valores?.[key] ?? colores.find((c) => c.key === key)?.value ?? 0)

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Lo que se acordó</span>
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="field-label">Cuota de entrada</span>
          <span className="field-box mt-1 block">
            <NumInput
              value={num(torneo.buyIn)}
              mode="decimal"
              aria-label="Cuota de entrada"
              onChange={(v) => cambiar({ ...torneo, buyIn: Math.max(0, v), rebuyPrice: Math.max(0, v) })}
            />
          </span>
        </label>
        <label className="block">
          <span className="field-label">Fichas por entrada</span>
          <span className="field-box mt-1 block">
            <NumInput
              value={num(torneo.stack)}
              mode="decimal"
              aria-label="Fichas por entrada"
              onChange={(v) => cambiar({ ...torneo, stack: Math.max(0, v) })}
            />
          </span>
        </label>
      </div>
      <p className="mt-0 mb-3 text-[11.5px] leading-snug text-ink-soft">
        La recompra cuesta lo mismo que la entrada y da las mismas fichas.
      </p>

      <p className="field-label mt-0 mb-1.5">Cuánto vale cada color esta noche</p>
      <p className="mt-0 mb-2 text-[11.5px] leading-snug text-ink-soft">
        En fichas de tornecash, no en pesos: la liga dice lo que vale en dinero, y aquí{' '}
        {money(num(torneo.buyIn))} dan {puntos(num(torneo.stack))}.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {colores.map((c) => (
          <label key={c.key} className="block">
            <span className="field-label truncate">{c.label}</span>
            <span className="field-box mt-1 block">
              <NumInput
                value={valorDe(c.key)}
                mode="decimal"
                aria-label={`Lo que vale la ficha ${c.label}`}
                onChange={(v) =>
                  cambiar({
                    ...torneo,
                    valores: { ...(torneo.valores ?? {}), [c.key]: Math.max(0, v) },
                  })
                }
              />
            </span>
          </label>
        ))}
      </div>

      <p className="field-label mt-0 mb-1.5">Cómo se parte la bolsa</p>
      <Premios
        payouts={torneo.payouts ?? []}
        onCambiar={(payouts) => cambiar({ ...torneo, payouts })}
      />
    </section>
  )
}

/** Lo que valen unas fichas en puntos, para quien lo necesite fuera de aquí. */
export { enPuntos }
