import { AlertTriangle, Check, Minus, Plus, RotateCcw } from 'lucide-react'
import ContadorFichas from '../../components/ContadorFichas'
import Medalla from '../../components/Medalla'
import NumInput from '../../components/NumInput'
import ShareBlock from '../../components/ShareBlock'
import Premios from '../liga/Premios'
import RepartoDinero from './RepartoDinero'
import { leerJson, type ConfigTorneo, type Participacion } from '../../lib/api'
import { money, num } from '../../lib/money'
import type { DatosTornecash } from '../../lib/shareImage'
import { avisosDe, bolsaDe, cuotaDeRecompra, tablaTornecash } from '../../lib/tornecash'
import type { Chips } from '../../store/types'
import { GuardarConteo, type PropsPestana } from './comun'

export type PestanaTornecash = 'jugadores' | 'resultado'

export const PESTANAS_TORNECASH: { id: PestanaTornecash; label: string }[] = [
  { id: 'jugadores', label: 'La noche' },
  { id: 'resultado', label: 'Resultado' },
]

/** Los puntos se escriben pelones. No son pesos, y ponerles signo es la confusión. */
const puntos = (n: number) => Math.round(n).toLocaleString('es-MX')
const conSigno = (n: number) => (n >= 0 ? '+' : '−') + puntos(Math.abs(n))
const tonoPuntos = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-ink-soft')

/*
 * Una noche de tornecash.
 *
 * Se juega con puntos y se paga con dinero, y son dos cosas distintas que no se mezclan
 * en ningún renglón: los puntos dicen quién quedó dónde, y el dinero entra una sola vez
 * por la cuota y sale una sola vez por los premios.
 *
 * Por eso la tabla no trae pesos y la bolsa no trae puntos.
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

  const nombreDe = (id: string) => datos.participaciones.find((p) => p.id === id)?.nombre ?? ''
  const laDe = (p: Participacion) => tabla.find((x) => x.jugador.id === p.id)!

  const recompras = datos.participaciones.reduce((a, p) => a + num(p.rebuys), 0)
  const entradas = datos.participaciones.length

  /* ------------------------------------------------ la noche, mientras se juega */
  if (pestana === 'jugadores') {
    /*
     * Al que ya acabó se le cierra y su tarjeta se va abajo, a la lista corta y en
     * orden. Así arriba queda siempre lo que falta por hacer, y la mesa se va
     * ordenando sola conforme la gente se levanta.
     */
    const abiertos = datos.participaciones.filter((p) => !p.cerrado_en)
    const cerrados = [...datos.participaciones.filter((p) => p.cerrado_en)].sort(
      (a, b) => laDe(b).neta - laDe(a).neta,
    )

    const cambiarRecompras = (id: string, cuantas: number) =>
      tocar(id, { rebuys: Math.max(0, cuantas) }, { rebuys: Math.max(0, cuantas) })

    return (
      <>
        <section className="panel">
          <p className="panel-title">
            <span>Cómo va</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-noche-linea px-3 py-2.5 text-paper">
              <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">Bolsa</span>
              <b className="font-display text-2xl">{money(bolsa)}</b>
            </div>
            <div className="rounded-xl border border-paper-line bg-white px-3 py-2.5">
              <span className="block text-[10px] tracking-[.6px] text-ink-soft uppercase">
                Entradas
              </span>
              <b className="font-display text-2xl text-ink">{entradas}</b>
            </div>
            <div className="rounded-xl border border-paper-line bg-white px-3 py-2.5">
              <span className="block text-[10px] tracking-[.6px] text-ink-soft uppercase">
                Recompras
              </span>
              <b className="font-display text-2xl text-ink">{recompras}</b>
            </div>
          </div>
          {cerrados.length > 0 && (
            <p className="mt-2.5 mb-0 text-[12px] leading-snug text-ink-soft">
              Ya cerraron <b className="text-ink">{cerrados.length}</b> de {entradas}; quedan
              abajo, en orden.
            </p>
          )}
        </section>

        {/* Uno por jugador: sus puntos, sus recompras y el botón de cerrarlo. Todo en la
            misma tarjeta, que es lo que se tiene enfrente cuando alguien se levanta. */}
        {abiertos.map((p) => {
          const x = laDe(p)
          const fichas = leerJson<Chips>(p.fichas_final, {})
          const yaContado = p.contadas_por !== null || x.finales > 0
          return (
            <section key={p.id} className="panel">
              <div className="mb-2 flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
                  {p.nombre}
                </b>
                {yaContado && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-win/12 px-2 py-0.5 text-[11px] font-bold text-win-tinta">
                    <Check size={11} strokeWidth={3} />
                    Contado
                  </span>
                )}
              </div>

              <ContadorFichas
                colores={colores}
                fichas={fichas}
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

              {/* La resta de la noche, en puntos y nada más. */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Celda rotulo="Compró" valor={puntos(x.dadas)} />
                <Celda rotulo="Hizo" valor={puntos(x.finales)} fuerte />
                <Celda rotulo="Le ganó" valor={conSigno(x.neta)} tono={tonoPuntos(x.neta)} />
              </div>

              {/* Las recompras, debajo de lo suyo: se agregan cuando hacen falta y no
                  hay que ir a buscarlas a otra lista. */}
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-paper-line pt-2.5">
                <span className="min-w-0 flex-1">
                  <b className="block text-[13px] font-semibold text-ink">Recompras</b>
                  <span className="block text-[11.5px] leading-tight text-ink-soft">
                    {num(p.rebuys) === 0
                      ? `Ninguna. Cada una son ${money(cuotaDeRecompra(torneo))} y ${puntos(num(torneo.stack))} puntos.`
                      : `${num(p.rebuys)} · lleva puestos ${money(x.puso)}`}
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

              {puedeEditar && (
                <button
                  type="button"
                  className="btn btn-marca mt-3"
                  onClick={() =>
                    tocar(p.id, { cerrado_en: new Date().toISOString() }, { cerrado: true })
                  }
                >
                  <Check size={16} strokeWidth={2.6} />
                  Cerrar a {p.nombre.split(' ')[0]}
                </button>
              )}
            </section>
          )
        })}

        {cerrados.length > 0 && (
          <section className="panel">
            <p className="panel-title">
              <span>Ya cerrados</span>
            </p>
            <ul className="m-0 list-none p-0">
              {cerrados.map((p, i) => {
                const x = laDe(p)
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 border-b border-dashed border-paper-line py-2 last:border-b-0"
                  >
                    <b className="w-5 shrink-0 text-center font-display text-sm text-ink-soft">
                      {i + 1}
                    </b>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] text-ink">{p.nombre}</b>
                      <span className="block text-[11px] leading-tight text-ink-soft">
                        hizo {puntos(x.finales)} · compró {puntos(x.dadas)}
                        {num(p.rebuys) > 0 && ` · ${num(p.rebuys)} de recompra`}
                      </span>
                    </span>
                    <b className={`shrink-0 font-display text-lg tabular-nums ${tonoPuntos(x.neta)}`}>
                      {conSigno(x.neta)}
                    </b>
                    {puedeEditar && (
                      <button
                        type="button"
                        aria-label={`Reabrir a ${p.nombre}`}
                        onClick={() => tocar(p.id, { cerrado_en: null }, { cerrado: false })}
                        className="ml-1 shrink-0 cursor-pointer rounded-lg border-none bg-ink/8 px-2 py-1.5 active:scale-95"
                      >
                        <RotateCcw size={13} strokeWidth={2.6} className="text-ink-soft" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {puedeEditar && <Ajustes torneo={torneo} cambiar={cambiarTorneo} />}
      </>
    )
  }

  /* ------------------------------------------------ cómo quedó la noche */
  const paraCompartir: DatosTornecash = {
    tipo: 'tornecash',
    titulo: datos.liga.nombre,
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    bolsa,
    cuota: num(torneo.buyIn),
    entradas,
    recompras,
    dineroEntradas: entradas * num(torneo.buyIn),
    dineroRecompras: recompras * cuotaDeRecompra(torneo),
    filas: tabla.map((x) => ({
      lugar: x.lugar,
      nombre: nombreDe(x.jugador.id),
      hizo: x.finales,
      compro: x.dadas,
      neto: x.neta,
      premio: x.saco,
      pct: bolsa > 0 ? Math.round((x.saco / bolsa) * 100) : 0,
    })),
  }

  const comoTexto = () =>
    [
      `${datos.liga.nombre} · Tornecash · ${datos.partida.nombre || datos.partida.fecha}`,
      ...tabla.map(
        (x) =>
          `${x.lugar}º ${nombreDe(x.jugador.id)} — ${conSigno(x.neta)} pts` +
          (x.saco > 0 ? ` · cobra ${money(x.saco)}` : ''),
      ),
      `Bolsa ${money(bolsa)}: ${entradas} entradas y ${recompras} recompras de ${money(num(torneo.buyIn))}.`,
    ].join('\n')

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

      {/* La tabla, en puntos y nada más: los que hizo, los que compró y la resta. */}
      <section className="panel">
        <p className="panel-title">
          <span>Cómo quedaron</span>
        </p>
        <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
          En puntos. El lugar lo da{' '}
          <b className="text-ink">lo que le ganó cada quien a la noche</b>: los puntos que hizo
          menos los que compró al entrar y al recomprar.
        </p>

        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[10px] tracking-[.5px] text-ink-soft uppercase">
              <th className="px-1 pb-2 text-left font-semibold">Jugador</th>
              <th className="px-1 pb-2 text-right font-semibold">Hizo</th>
              <th className="px-1 pb-2 text-right font-semibold">Compró</th>
              <th className="px-1 pb-2 text-right font-semibold">Le ganó</th>
            </tr>
          </thead>
          <tbody>
            {tabla.map((x) => (
              <tr key={x.jugador.id} className="border-t border-dashed border-paper-line">
                <td className="max-w-[130px] px-1 py-2">
                  <span className="flex items-center gap-1.5">
                    {x.lugar <= 3 && <Medalla lugar={x.lugar} size={14} />}
                    <span className="truncate font-semibold text-ink">
                      {nombreDe(x.jugador.id)}
                    </span>
                  </span>
                  <span className="block text-[10.5px] leading-tight text-ink-soft">
                    {x.lugar}º
                    {num(x.jugador.rebuys) > 0 && ` · ${num(x.jugador.rebuys)} de recompra`}
                  </span>
                </td>
                <td className="px-1 py-2 text-right font-display whitespace-nowrap text-ink tabular-nums">
                  {puntos(x.finales)}
                </td>
                <td className="px-1 py-2 text-right font-display whitespace-nowrap text-ink-soft tabular-nums">
                  {puntos(x.dadas)}
                </td>
                <td
                  className={`px-1 py-2 text-right font-display whitespace-nowrap tabular-nums ${tonoPuntos(x.neta)}`}
                >
                  {conSigno(x.neta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Y aparte, el dinero: de dónde salió la bolsa y cómo se parte. */}
      <section className="panel">
        <p className="panel-title">
          <span>El dinero de la noche</span>
        </p>

        <div className="mb-3 rounded-xl bg-noche-linea px-3.5 py-3 text-paper">
          <span className="block text-[10.5px] font-bold tracking-[.6px] uppercase opacity-70">
            Bolsa a repartir
          </span>
          <b className="block font-display text-[30px] leading-tight">{money(bolsa)}</b>
          <span className="mt-1 block text-[12px] leading-snug opacity-80">
            {entradas} {entradas === 1 ? 'entrada' : 'entradas'},{' '}
            {money(entradas * num(torneo.buyIn))} · {recompras}{' '}
            {recompras === 1 ? 'recompra' : 'recompras'},{' '}
            {money(recompras * cuotaDeRecompra(torneo))}
          </span>
        </div>

        <ul className="m-0 list-none p-0">
          {(torneo.payouts ?? []).map((po, i) => {
            const quien = tabla.find((x) => x.lugar === i + 1)
            return (
              <li
                key={i}
                className="flex items-center gap-2 border-b border-dashed border-paper-line py-2 last:border-b-0"
              >
                <Medalla lugar={i + 1} size={15} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] text-ink">
                    {quien ? nombreDe(quien.jugador.id) : '—'}
                  </b>
                  <span className="block text-[11px] leading-tight text-ink-soft">
                    {i + 1}º lugar · {num(po.pct)}% de la bolsa
                  </span>
                </span>
                <b className="shrink-0 font-display text-lg text-ink tabular-nums">
                  {money((bolsa * num(po.pct)) / 100)}
                </b>
              </li>
            )
          })}
        </ul>
      </section>

      <ShareBlock
        datos={paraCompartir}
        texto={comoTexto}
        alt={`Cómo quedó la noche de tornecash en ${datos.liga.nombre}`}
      />

      {/* A quién ya se le pagó. Sólo los que cobran: al que no alcanzó lugar no hay nada
          que entregarle y ponerlo aquí nada más estorba. */}
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

      {puedeEditar && <Ajustes torneo={torneo} cambiar={cambiarTorneo} />}
    </>
  )
}

/** Una de las tres cajitas de la resta. */
function Celda({
  rotulo,
  valor,
  tono = 'text-ink',
  fuerte = false,
}: {
  rotulo: string
  valor: string
  tono?: string
  fuerte?: boolean
}) {
  return (
    <div
      className={`rounded-xl px-2.5 py-2 ${fuerte ? 'bg-ink/6' : 'border border-paper-line bg-white'}`}
    >
      <span className="block text-[10px] tracking-[.5px] text-ink-soft uppercase">{rotulo}</span>
      <b className={`font-display text-lg tabular-nums ${tono}`}>{valor}</b>
    </div>
  )
}

/*
 * Lo que se acordó esa noche: cuánto cuesta entrar, cuántos puntos da y cómo se parte la
 * bolsa.
 *
 * Lo que vale cada ficha no se pregunta aquí: sale del inventario de la liga, igual que
 * siempre. La ficha es la misma y no tiene por qué valer una cosa el viernes y otra el
 * sábado.
 */
function Ajustes({
  torneo,
  cambiar,
}: {
  torneo: ConfigTorneo
  cambiar: (t: ConfigTorneo) => void
}) {
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Lo que se acordó</span>
      </p>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="field-label">Cuota de entrada</span>
          <span className="field-box mt-1 block">
            <NumInput
              value={num(torneo.buyIn)}
              mode="decimal"
              aria-label="Cuota de entrada"
              onChange={(v) =>
                cambiar({ ...torneo, buyIn: Math.max(0, v), rebuyPrice: Math.max(0, v) })
              }
            />
          </span>
        </label>
        <label className="block">
          <span className="field-label">Puntos por entrada</span>
          <span className="field-box mt-1 block">
            <NumInput
              value={num(torneo.stack)}
              mode="decimal"
              aria-label="Puntos por entrada"
              onChange={(v) => cambiar({ ...torneo, stack: Math.max(0, v) })}
            />
          </span>
        </label>
      </div>
      <p className="mt-0 mb-4 text-[11.5px] leading-snug text-ink-soft">
        La recompra cuesta lo mismo y da los mismos puntos. Lo que vale cada ficha sale del
        inventario de la liga.
      </p>

      <p className="field-label mt-0 mb-1.5">Cómo se parte la bolsa</p>
      <Premios
        payouts={torneo.payouts ?? []}
        onCambiar={(payouts) => cambiar({ ...torneo, payouts })}
      />
    </section>
  )
}
