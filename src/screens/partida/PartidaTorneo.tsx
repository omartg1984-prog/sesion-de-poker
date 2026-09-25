import { AlertTriangle } from 'lucide-react'
import Medalla from '../../components/Medalla'
import MoneyInput from '../../components/MoneyInput'
import SelectorJugador from '../../components/SelectorJugador'
import ShareBlock from '../../components/ShareBlock'
import Stepper from '../../components/Stepper'
import { EPS, money, num, signed } from '../../lib/money'
import type { DatosTorneo } from '../../lib/shareImage'
import type { DatosFichas } from '../../lib/imagenTablas'
import type { ConfigTorneo, Participacion } from '../../lib/api'
import { coloresDelTorneo } from '../../lib/torneo'
import { desgloseDeBolsa, premioDelLugar } from '../../lib/bolsaTorneo'
import { resumenDeTorneo, tablaDeReglas } from '../../lib/resumenTorneo'
import type { Chips } from '../../store/types'
import Estructura from './Estructura'
import PasosTorneo from '../liga/PasosTorneo'
import Reloj from './Reloj'
import { leerJson } from '../../lib/api'
import {
  RELOJ_PARADO,
  retirosDe,
  segundosCorridos,
  type Estructura as Tabla,
  type RelojTorneo,
} from '../../lib/torneo'
import {
  CompartirReparto,
  FichasDelJugador,
  conceptosDeTorneo,
  idFila,
  manualesDe,
  InventarioUsado,
  ListaDeLaMesa,
  calcularRepartoPorConcepto,
  claseClara,
  type PropsPestana,
} from './comun'

export type PestanaTorneo = 'torneo' | 'jugadores' | 'resultado'

export const PESTANAS_TORNEO: { id: PestanaTorneo; label: string }[] = [
  { id: 'torneo', label: 'Torneo' },
  { id: 'jugadores', label: 'Registro' },
  { id: 'resultado', label: 'Resultado' },
]

export const TORNEO_POR_DEFECTO: ConfigTorneo = {
  buyIn: 0,
  rebuyPrice: 0,
  addOnPrice: 0,
  payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }],
}

/* ---- dinero del torneo ---- */

export const pagadoPor = (p: Participacion, t: ConfigTorneo) =>
  num(t.buyIn) + num(p.rebuys) * num(t.rebuyPrice) + num(p.addons) * num(t.addOnPrice)

/** Todo el dinero que puso la mesa, cena incluida. */
export const bolsaDe = (ps: Participacion[], t: ConfigTorneo) =>
  ps.reduce((s, p) => s + pagadoPor(p, t), 0)

/* El desglose de la noche, que es lo único que cuadra al final: la cena sale de lo
   recaudado y los premios se calculan sobre lo que queda. */
const desgloseDe = (ps: Participacion[], t: ConfigTorneo) =>
  desgloseDeBolsa(
    ps.length,
    ps.reduce((a, p) => a + num(p.rebuys), 0),
    ps.reduce((a, p) => a + num(p.addons), 0),
    t,
  )

const sumaPct = (t: ConfigTorneo) => t.payouts.reduce((s, x) => s + num(x.pct), 0)

/* Las fichas del torneo son puntos, no pesos: nada de signo de dólares. */
const enFichas = (n: number) => Math.round(n).toLocaleString('es-MX')

/**
 * Cuántos minutos tarde arrancó, comparado con la hora a la que se quedó.
 *
 * La hora planeada es texto suelto ("20:00") y la real es un instante, así que hay que
 * plantar la primera en el día de la partida antes de restarlas.
 */
function minutosDeRetraso(fecha: string, planeada: string | undefined, real: string): number {
  if (!planeada) return 0
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = planeada.split(':').map(Number)
  if (![a, m, d, h, min].every(Number.isFinite)) return 0
  const prometida = new Date(a, m - 1, d, h, min).getTime()
  return Math.max(0, Math.round((Date.parse(real) - prometida) / 60000))
}

/* La ficha más chica que va a haber en la mesa. Los torneos viejos no traen valores de
   torneo, y ahí manda el valor en dinero de la liga. */
const fichaMasChicaDe = (t: ConfigTorneo, colores: { key: string; value: number }[]) =>
  Math.min(...(t.valores ? Object.values(t.valores) : colores.map((c) => num(c.value) || 1)), Infinity) || 1

const premioDe = (i: number, ps: Participacion[], t: ConfigTorneo) =>
  premioDelLugar(i, desgloseDe(ps, t).premios, t)

interface Props extends PropsPestana {
  pestana: PestanaTorneo
  torneo: ConfigTorneo
  cambiarTorneo: (t: ConfigTorneo) => void
  onEstructura: (e: Tabla) => void
  onReloj: (r: RelojTorneo) => void
}

export default function PartidaTorneo({
  pestana,
  datos,
  colores,
  puedeEditar,
  tocar,
  torneo,
  cambiarTorneo,
  onEstructura,
  onReloj,
  recargar,
}: Props) {
  const ps = datos.participaciones
  const desglose = desgloseDe(ps, torneo)
  const suma = sumaPct(torneo)
  const cuadra = Math.abs(suma - 100) < EPS

  /*
   * El número grande es siempre lo que se va a repartir, no lo recaudado. Si parte del
   * dinero ya se fue en la cena, enseñar el total de arriba es lo que hace que al final
   * nadie cuadre.
   */
  const Banner = ({ titulo }: { titulo: string }) => (
    <div className="mb-3.5 rounded-xl bg-gradient-to-br from-[#2a1016] to-[#100e12] px-4 py-3.5 text-center ring-1 ring-marca/25">
      <div className="text-[10px] tracking-[1px] text-tiza-suave uppercase">{titulo}</div>
      <div className="mt-0.5 font-display text-[34px] font-bold text-marca-alta">
        {money(desglose.premios)}
      </div>
      {desglose.cena > 0 && (
        <div className="mt-0.5 text-[11.5px] text-tiza-suave">
          de {money(desglose.recaudado)} que puso la mesa · {money(desglose.cena)} son de cena
        </div>
      )}
    </div>
  )

  /* ---- configuración del torneo ---- */
  if (pestana === 'torneo') {
    const guardada = leerJson<Tabla | null>(datos.partida.estructura, null)
    const relojGuardado = leerJson<RelojTorneo>(datos.partida.reloj, RELOJ_PARADO)

    const stackDelTorneo = num(torneo.stack) || num(torneo.buyIn)
    const fichasDeLaNoche: DatosFichas = {
      tipo: 'fichas',
      titulo: 'Cuánto vale cada ficha',
      subtitulo: datos.partida.nombre || datos.partida.fecha,
      gorro: datos.liga.nombre,
      fichas: colores.map((c) => ({
        label: c.label,
        color: c.color,
        valor: torneo.valores?.[c.key] ?? num(c.value),
      })),
      pie: `Arrancas con ${enFichas(stackDelTorneo)}`,
    }

    /*
     * Los torneos armados antes de que existieran los retiros tienen la tabla guardada
     * sin ellos. En vez de obligar a recalcular las ciegas —y perder las que se hayan
     * corregido a mano— se calculan al vuelo con las denominaciones de la noche.
     */
    const estructura: Tabla | null = guardada && {
      ...guardada,
      retiros:
        guardada.retiros ??
        retirosDe(
          guardada.niveles,
          colores.map((c) => torneo.valores?.[c.key] ?? num(c.value)),
        ),
    }

    /* Las mismas reglas en texto, para quien prefiere pegarlas que mandar la imagen. */
    const textoReglas = () => {
      const r = resumenDeTorneo(torneo)
      const lineas = [
        `🏆 ${datos.liga.nombre} — ${datos.partida.nombre || datos.partida.fecha}`,
        '',
      ]
      for (const c of r.compras)
        lineas.push(
          `${c.que}: ${money(c.dinero)} → ${enFichas(c.fichas)} fichas${c.hasta ? ` (${c.hasta})` : ''}`,
        )
      if (r.cenaPorPersona > 0)
        lineas.push(`Cena: ${money(r.cenaPorPersona)} por persona, sale de la bolsa`)
      lineas.push('', 'Se reparte:')
      for (const pr of r.premios) lineas.push(`  ${pr.lugar}º · ${pr.pct}%`)
      if (torneo.horaInicio) lineas.push('', `Empieza ${torneo.horaInicio}`)
      return lineas.join('\n')
    }

    const textoFichas = () => {
      const lineas = [
        `🃏 ${datos.liga.nombre} — ${datos.partida.nombre || datos.partida.fecha}`,
        'Cuánto vale cada ficha:',
        '',
      ]
      for (const f of fichasDeLaNoche.fichas) lineas.push(`• ${f.label}: ${enFichas(f.valor)}`)
      lineas.push('', `Arrancas con ${enFichas(stackDelTorneo)}`)
      return lineas.join('\n')
    }
    return (
      <>
        {/* A qué hora se quedó, y qué tanto se corrió la hora. La de arranque de verdad
            ya la dice el letrero de arriba; repetirla aquí era decir dos veces lo
            mismo. Lo que ésta agrega es contra qué se compara. */}
        {torneo.horaInicio && (
          <p className="mt-0 mb-3 px-1 text-center text-[12px] text-tiza-suave">
            Se quedó a las <b className="text-white">{torneo.horaInicio}</b>
            {(() => {
              const tarde = datos.partida.arrancado_en
                ? minutosDeRetraso(
                    datos.partida.fecha,
                    torneo.horaInicio,
                    datos.partida.arrancado_en,
                  )
                : 0
              return tarde > 0 ? ` · arrancaron ${tarde} min tarde` : ''
            })()}
          </p>
        )}

        {estructura && (
          <Reloj
            estructura={estructura}
            reloj={relojGuardado}
            puedeEditar={puedeEditar}
            onReloj={onReloj}
            recargar={recargar}
          />
        )}

        {/*
         * Cuánto vale cada ficha esa noche, para mandar al grupo.
         *
         * Es la pregunta que más se repite en la mesa de un torneo: los mismos plásticos
         * valen otra cosa cada vez, porque los puntos salen de los montos de esa noche.
         * Con la imagen pegada en el chat se contesta sola.
         */}
        <section className="panel">
          <p className="panel-title">
            <span>Cuánto vale cada ficha</span>
          </p>
          <ShareBlock
            datos={fichasDeLaNoche}
            texto={textoFichas}
            alt="Valor de cada ficha en el torneo"
          />
        </section>

        {/* Las reglas como imagen: el link sirve para apuntarse, pero a veces sólo hace
            falta que quede escrito en el chat de qué va la noche. */}
        <section className="panel">
          <p className="panel-title">
            <span>Las reglas del torneo</span>
          </p>
          <p className="mt-0 mb-2.5 text-[12.5px] leading-snug text-ink-soft">
            Lo mismo que ve quien abre el link, en una imagen que se manda sola.
          </p>
          <ShareBlock
            datos={tablaDeReglas(torneo, {
              titulo: datos.partida.nombre || datos.partida.fecha,
              liga: datos.liga.nombre,
            })}
            texto={textoReglas}
            alt="Reglas del torneo"
          />
        </section>

        <Estructura
          jugadores={ps.length}
          stack={num(torneo.stack) || num(torneo.buyIn)}
          fichaMasChica={fichaMasChicaDe(torneo, colores)}
          valores={fichasDeLaNoche.fichas.map((f) => f.valor)}
          estructura={estructura}
          puedeEditar={puedeEditar}
          horaInicio={torneo.horaInicio}
          /* Ya arrancado, las horas se cuentan desde el reloj y no desde el plan. */
          corridosSeg={
            datos.partida.arrancado_en ? segundosCorridos(relojGuardado) : null
          }
          onGuardar={onEstructura}
        />

        <section className="panel">
          <p className="panel-title">
            <span>Costos y fichas</span>
          </p>
          {/* El mismo formulario que al crear la partida: lo que se define ahí se
              corrige aquí, sin dos versiones del mismo campo. */}
          {puedeEditar ? (
            <PasosTorneo
              torneo={torneo}
              colores={colores}
              jugadores={ps.length}
              onCambiar={cambiarTorneo}
            />
          ) : (
            <p className="m-0 text-[13px] text-ink-soft">
              Entrada {money(torneo.buyIn)} · recompra {money(torneo.rebuyPrice)} · add-on{' '}
              {money(torneo.addOnPrice)}
            </p>
          )}
        </section>
      </>
    )
  }

  /* ---- jugadores: recompras y add-ons ---- */
  if (pestana === 'jugadores') {
    /*
     * En torneo las fichas no son dinero: se reparten los puntos del stack con los
     * valores de esa noche, y las recompras y add-ons suman los suyos. Sin `stack`
     * configurado se cae al comportamiento viejo, que es lo que tienen los torneos
     * creados antes de que esto existiera.
     */
    const coloresTorneo = coloresDelTorneo(colores, torneo.valores)
    const stack = num(torneo.stack) || num(torneo.buyIn)
    /* Cada entrega lleva su renglón, igual que en cash: lo que se le pone en la mano al
       que recompra son sus fichas de recompra, no el montón de toda su noche. */
    const conceptos = (p: Participacion) =>
      conceptosDeTorneo(p, stack, num(torneo.rebuyChips), num(torneo.addOnChips))
    const reparto = calcularRepartoPorConcepto(ps, coloresTorneo, conceptos)
    /* Hasta cuándo se compra, con las mismas palabras que leyó cada quien al apuntarse. */
    const { compras } = resumenDeTorneo(torneo, ps.length)
    const conHasta = (que: string) => {
      const c = compras.find((x) => x.que === que)
      return c ? `Se puede ${c.hasta}.` : ''
    }
    const reglaRecompras = conHasta('Recompra')
    const reglaAddOns = conHasta('Add-on')
    return (
      <>
        <Banner titulo="Bolsa acumulada" />

        <ListaDeLaMesa
          filas={ps.map((p) => ({ id: p.id, nombre: p.nombre, monto: pagadoPor(p, torneo) }))}
        />

        {ps.map((p) => (
          <section key={p.id} className="panel">
            <b className="mb-3 block truncate font-display text-lg font-semibold text-ink">
              {p.nombre}
            </b>

            {(() => {
              /* Guardar un reparto a mano toca sólo su concepto: corregir las fichas de
                 una recompra no debe mover el stack que ya se entregó al empezar. */
              const guardarFichas = (clave: string) => (fichas: Chips | null) => {
                const manuales = { ...manualesDe(p) }
                if (fichas) manuales[clave] = fichas
                else delete manuales[clave]
                const vacio = Object.keys(manuales).length === 0
                tocar(
                  p.id,
                  { fichas_manual: vacio ? null : JSON.stringify(manuales) },
                  { fichasManual: vacio ? null : manuales },
                )
              }
              const pinta = (clave: string, rotulo: string) => {
                const fila = reparto.rows.find((r) => r.id === idFila(p.id, clave))
                return fila ? (
                  <FichasDelJugador
                    fila={fila}
                    colores={coloresTorneo}
                    puedeEditar={puedeEditar}
                    guardar={guardarFichas(clave)}
                    rotulo={rotulo}
                    formato={enFichas}
                  />
                ) : null
              }
              const suyos = conceptos(p)

              return (
                <>
                  {/* Las fichas de entrada van arriba, igual que en cash. */}
                  <div className="mb-3">{pinta('entrada', 'Fichas de entrada')}</div>

                  <div className="mb-1 flex items-center justify-between gap-2.5">
                    <span className="text-sm font-semibold text-ink-soft">Recompras</span>
                    <Stepper
                      label="recompra"
                      value={p.rebuys}
                      onChange={(v) => puedeEditar && tocar(p.id, { rebuys: v }, { rebuys: v })}
                    />
                  </div>
                  {/* La regla, donde se pregunta: junto al botón de sumar una más. */}
                  <p className="mt-0 mb-3 text-[11.5px] text-ink-soft">{reglaRecompras}</p>

                  {/* Un renglón por recompra: es lo que se le entrega en el momento. */}
                  {suyos
                    .filter((c) => c.clave.startsWith('r'))
                    .map((c) => (
                      <div key={c.clave} className="mb-3 rounded-xl border border-paper-line bg-paper-soft px-3 py-1">
                        {pinta(c.clave, c.rotulo)}
                      </div>
                    ))}

                  <div className="mb-1 flex items-center justify-between gap-2.5">
                    <span className="text-sm font-semibold text-ink-soft">Add-ons</span>
                    <Stepper
                      label="add-on"
                      value={p.addons}
                      onChange={(v) => puedeEditar && tocar(p.id, { addons: v }, { addons: v })}
                    />
                  </div>
                  <p className="mt-0 mb-3 text-[11.5px] text-ink-soft">{reglaAddOns}</p>

                  {suyos
                    .filter((c) => c.clave.startsWith('a'))
                    .map((c) => (
                      <div key={c.clave} className="mb-3 rounded-xl border border-paper-line bg-paper-soft px-3 py-1">
                        {pinta(c.clave, c.rotulo)}
                      </div>
                    ))}
                </>
              )
            })()}

            <p className="m-0 text-right text-xs text-ink-soft">
              Pagó: <b className="text-ink">{money(pagadoPor(p, torneo))}</b>
            </p>

          </section>
        ))}

        <InventarioUsado reparto={reparto} colores={coloresTorneo} />

        <section className="panel">
          <p className="panel-title">
            <span>Mandar el reparto</span>
          </p>
          <CompartirReparto reparto={reparto} colores={coloresTorneo} datos={datos} />
        </section>
      </>
    )
  }

  /* ---- resultado ---- */
  const totalRecompras = ps.reduce((a, p) => a + num(p.rebuys), 0)
  const totalAddons = ps.reduce((a, p) => a + num(p.addons), 0)

  const netoDe = (p: Participacion) => {
    const premio = p.lugar ? premioDe(p.lugar - 1, ps, torneo) : 0
    return premio - pagadoPor(p, torneo)
  }
  const ranking = [...ps].sort((a, b) => netoDe(b) - netoDe(a))

  const asignarLugar = (lugar: number, usuarioId: string | null) => {
    if (!puedeEditar) return
    for (const p of ps) {
      if (p.usuario_id === usuarioId) tocar(p.id, { lugar }, { lugar })
      else if (p.lugar === lugar) tocar(p.id, { lugar: 0 }, { lugar: 0 })
    }
  }

  const datosImagen: DatosTorneo = {
    tipo: 'torneo',
    titulo: 'OnlyCards',
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    bolsa: desglose.premios,
    jugadores: ps.length,
    recompras: totalRecompras,
    addons: totalAddons,
    dineroEntradas: ps.length * num(torneo.buyIn),
    dineroRecompras: totalRecompras * num(torneo.rebuyPrice),
    dineroAddons: totalAddons * num(torneo.addOnPrice),
    cena: desglose.cena,
    lugares: torneo.payouts.map((po, i) => ({
      lugar: i + 1,
      pct: num(po.pct),
      premio: premioDe(i, ps, torneo),
      ganador: ps.find((p) => p.lugar === i + 1)?.nombre ?? null,
    })),
  }

  const texto = () => {
    const lineas = [
      `🏆 ${datos.liga.nombre} · ${datos.partida.nombre || datos.partida.fecha}`,
      '',
      `Puso la mesa: ${money(desglose.recaudado)}`,
    ]
    if (desglose.cena > 0)
      lineas.push(
        `Cena: ${ps.length} × ${money(num(torneo.cenaPorPersona))} = −${money(desglose.cena)}`,
      )
    lineas.push(`Bolsa a repartir: ${money(desglose.premios)}`, '')
    torneo.payouts.forEach((po, i) => {
      const g = ps.find((p) => p.lugar === i + 1)
      lineas.push(
        `${i + 1}º (${num(po.pct)}%): ${money(premioDe(i, ps, torneo))}${g ? ` — ${g.nombre}` : ''}`,
      )
    })
    return lineas.join('\n')
  }

  return (
    <>
      <Banner titulo="Bolsa a repartir" />

      <section className="panel">
        <p className="panel-title">
          <span>De dónde sale la bolsa</span>
        </p>

        {/* Renglón por renglón y con la cuenta escrita —"8 × $500"— para que cualquiera
            la pueda rehacer en la mesa sin preguntar de dónde salió cada número. */}
        <table className="w-full border-collapse text-[13.5px]">
          <tbody>
            {desglose.entradas.map((r) => (
              <tr key={r.que} className="border-b border-dashed border-paper-line">
                <td className="py-2 font-semibold text-ink">{r.que}</td>
                <td className="py-2 text-right whitespace-nowrap text-ink-soft">
                  {r.cuantos} × {money(r.precio)}
                </td>
                <td className="w-[86px] py-2 text-right font-display font-bold text-ink tabular-nums">
                  {money(r.total)}
                </td>
              </tr>
            ))}

            <tr className="border-b border-paper-line">
              <td className="py-2 font-semibold text-ink" colSpan={2}>
                Puso la mesa
              </td>
              <td className="py-2 text-right font-display font-bold text-ink tabular-nums">
                {money(desglose.recaudado)}
              </td>
            </tr>

            {desglose.salidas.map((r) => (
              <tr key={r.que} className="border-b border-dashed border-paper-line">
                <td className="py-2 font-semibold text-ink">{r.que}</td>
                <td className="py-2 text-right whitespace-nowrap text-ink-soft">
                  {r.cuantos} × {money(r.precio)}
                </td>
                <td className="py-2 text-right font-display font-bold text-loss tabular-nums">
                  −{money(-r.total)}
                </td>
              </tr>
            ))}

            <tr>
              <td className="pt-2.5 font-display text-[15px] font-bold text-ink" colSpan={2}>
                Se reparte
              </td>
              <td className="pt-2.5 text-right font-display text-[17px] font-bold text-win tabular-nums">
                {money(desglose.premios)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* La cena se teclea aquí y no al armar el torneo porque casi siempre se sabe
            cuando llega la cuenta, a media noche. */}
        {puedeEditar && (
          <div className="mt-3 border-t border-paper-line pt-3">
            <MoneyInput
              label="Cena por persona"
              value={num(torneo.cenaPorPersona)}
              onChange={(v) => cambiarTorneo({ ...torneo, cenaPorPersona: v })}
            />
            <p className="mt-0 mb-0 text-[12px] leading-snug text-ink-soft">
              Sale de la bolsa antes de repartir premios. Se cobra una vez por persona,
              no por recompra. En 0 no se descuenta nada.
            </p>
          </div>
        )}

        {!cuadra && (
          <div className="balance balance-off mt-3 mb-0">
            <AlertTriangle size={16} strokeWidth={2.4} />
            <span>Los porcentajes suman {suma}%. Ajústalos en la pestaña Torneo.</span>
          </div>
        )}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>¿Quién ganó cada lugar?</span>
        </p>
        {torneo.payouts.map((po, i) => {
          const lugar = i + 1
          const ganador = ps.find((p) => p.lugar === lugar)
          return (
            <div
              key={i}
              className="mb-2.5 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5"
            >
              <b className="mb-2 flex items-center gap-1.5 text-sm text-ink">
                <Medalla lugar={lugar} size={15} />
                {lugar}º · {num(po.pct)}% ·{' '}
                <span className="text-win">{money(premioDe(i, ps, torneo))}</span>
              </b>
              <SelectorJugador
                titulo={`¿Quién quedó en ${lugar}º?`}
                deshabilitado={!puedeEditar}
                valor={ganador?.usuario_id ?? null}
                onChange={(id) => asignarLugar(lugar, id)}
                opciones={ps.map((p) => ({ id: p.usuario_id, nombre: p.nombre, foto: p.foto }))}
              />
            </div>
          )
        })}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Resultado por jugador</span>
        </p>
        <ul className="m-0 mb-3 list-none p-0">
          {ranking.map((r) => {
            const neto = netoDe(r)
            return (
              <li
                key={r.id}
                className="flex items-center justify-between border-b border-dashed border-paper-line py-2.5 font-semibold last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {r.lugar ? <Medalla lugar={r.lugar} /> : null}
                  <span className="truncate text-ink">{r.nombre}</span>
                </span>
                <span className={`font-display font-bold ${claseClara(neto)}`}>{signed(neto)}</span>
              </li>
            )
          })}
        </ul>

        <ShareBlock datos={datosImagen} texto={texto} alt="Resultados del torneo" />
      </section>
    </>
  )
}
