import { AlertTriangle } from 'lucide-react'
import Medalla from '../../components/Medalla'
import SelectorJugador from '../../components/SelectorJugador'
import ShareBlock from '../../components/ShareBlock'
import Stepper from '../../components/Stepper'
import { EPS, money, num, signed } from '../../lib/money'
import type { DatosTorneo } from '../../lib/shareImage'
import type { ConfigTorneo, Participacion } from '../../lib/api'
import { coloresDelTorneo } from '../../lib/torneo'
import Estructura from './Estructura'
import PasosTorneo from '../liga/PasosTorneo'
import Reloj from './Reloj'
import { leerJson } from '../../lib/api'
import { RELOJ_PARADO, type Estructura as Tabla, type RelojTorneo } from '../../lib/torneo'
import {
  CompartirReparto,
  FichasDelJugador,
  InventarioUsado,
  calcularReparto,
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

export const bolsaDe = (ps: Participacion[], t: ConfigTorneo) =>
  ps.reduce((s, p) => s + pagadoPor(p, t), 0)

const sumaPct = (t: ConfigTorneo) => t.payouts.reduce((s, x) => s + num(x.pct), 0)

/* Las fichas del torneo son puntos, no pesos: nada de signo de dólares. */
const enFichas = (n: number) => Math.round(n).toLocaleString('es-MX')

/* La ficha más chica que va a haber en la mesa. Los torneos viejos no traen valores de
   torneo, y ahí manda el valor en dinero de la liga. */
const fichaMasChicaDe = (t: ConfigTorneo, colores: { key: string; value: number }[]) =>
  Math.min(...(t.valores ? Object.values(t.valores) : colores.map((c) => num(c.value) || 1)), Infinity) || 1

const premioDe = (i: number, ps: Participacion[], t: ConfigTorneo) => {
  const po = t.payouts[i]
  return po ? (bolsaDe(ps, t) * num(po.pct)) / 100 : 0
}

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
  const bolsa = bolsaDe(ps, torneo)
  const suma = sumaPct(torneo)
  const cuadra = Math.abs(suma - 100) < EPS

  const Banner = ({ titulo }: { titulo: string }) => (
    <div className="mb-3.5 rounded-xl bg-gradient-to-br from-[#2a1016] to-[#100e12] px-4 py-3.5 text-center ring-1 ring-marca/25">
      <div className="text-[10px] tracking-[1px] text-tiza-suave uppercase">{titulo}</div>
      <div className="mt-0.5 font-display text-[34px] font-bold text-marca-alta">
        {money(bolsa)}
      </div>
    </div>
  )

  /* ---- configuración del torneo ---- */
  if (pestana === 'torneo') {
    const estructura = leerJson<Tabla | null>(datos.partida.estructura, null)
    const relojGuardado = leerJson<RelojTorneo>(datos.partida.reloj, RELOJ_PARADO)
    return (
      <>
        {estructura && (
          <Reloj
            estructura={estructura}
            reloj={relojGuardado}
            puedeEditar={puedeEditar}
            onReloj={onReloj}
            recargar={recargar}
          />
        )}

        <Estructura
          jugadores={ps.length}
          stack={num(torneo.stack) || num(torneo.buyIn)}
          fichaMasChica={fichaMasChicaDe(torneo, colores)}
          estructura={estructura}
          puedeEditar={puedeEditar}
          horaInicio={torneo.horaInicio}
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
    const reparto = calcularReparto(
      ps,
      coloresTorneo,
      (p) =>
        stack + num(p.rebuys) * num(torneo.rebuyChips) + num(p.addons) * num(torneo.addOnChips),
    )
    return (
      <>
        <Banner titulo="Bolsa acumulada" />
        {ps.map((p) => (
          <section key={p.id} className="panel">
            <b className="mb-3 block truncate font-display text-lg font-semibold text-ink">
              {p.nombre}
            </b>

            <div className="mb-3 flex items-center justify-between gap-2.5">
              <span className="text-sm font-semibold text-ink-soft">Recompras</span>
              <Stepper
                label="recompra"
                value={p.rebuys}
                onChange={(v) => puedeEditar && tocar(p.id, { rebuys: v }, { rebuys: v })}
              />
            </div>

            <div className="mb-3 flex items-center justify-between gap-2.5">
              <span className="text-sm font-semibold text-ink-soft">Add-ons</span>
              <Stepper
                label="add-on"
                value={p.addons}
                onChange={(v) => puedeEditar && tocar(p.id, { addons: v }, { addons: v })}
              />
            </div>

            <p className="m-0 text-right text-xs text-ink-soft">
              Pagó: <b className="text-ink">{money(pagadoPor(p, torneo))}</b>
            </p>

            {(() => {
              const fila = reparto.rows.find((r) => r.id === p.id)
              return fila ? (
                <FichasDelJugador
                  fila={fila}
                  colores={coloresTorneo}
                  puedeEditar={puedeEditar}
                  tocar={tocar}
                  formato={enFichas}
                />
              ) : null
            })()}
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
    bolsa,
    jugadores: ps.length,
    recompras: totalRecompras,
    addons: totalAddons,
    dineroEntradas: ps.length * num(torneo.buyIn),
    dineroRecompras: totalRecompras * num(torneo.rebuyPrice),
    dineroAddons: totalAddons * num(torneo.addOnPrice),
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
      `Bolsa: ${money(bolsa)}`,
      '',
    ]
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
        <div className="grid grid-cols-2 gap-2.5">
          <div className="stat">
            <div className="stat-k">Jugadores</div>
            <div className="stat-v">{ps.length}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Entradas</div>
            <div className="stat-v">{money(ps.length * num(torneo.buyIn))}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Recompras</div>
            <div className="stat-v">
              {totalRecompras} · {money(totalRecompras * num(torneo.rebuyPrice))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-k">Add-ons</div>
            <div className="stat-v">
              {totalAddons} · {money(totalAddons * num(torneo.addOnPrice))}
            </div>
          </div>
        </div>

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
