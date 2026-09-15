import { AlertTriangle, Check, ChevronRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import Chip from '../../components/Chip'
import NumInput from '../../components/NumInput'
import ShareBlock from '../../components/ShareBlock'
import {
  computeDistribution,
  dineroDeLaCaja,
  distributionText,
  type Distribution,
  type DistributionRow,
} from '../../lib/distribution'
import type { DatosTabla } from '../../lib/imagenTablas'
import { EPS, money, num } from '../../lib/money'
import { leerJson, type DetallePartida, type Participacion } from '../../lib/api'
import type { ChipColor, Chips } from '../../store/types'

/** Lo que cada pestaña necesita para trabajar. */
export interface PropsPestana {
  datos: DetallePartida
  colores: ChipColor[]
  puedeEditar: boolean
  /*
   * Contar las fichas del final lo puede hacer cualquiera de la mesa, no sólo un admin.
   * Es lo que hace rápido el cash out: cuatro contando en paralelo en vez de uno
   * tecleando lo de todos. El dinero —quién puso qué, a quién se le pagó— sigue
   * siendo de `puedeEditar`.
   */
  puedeContar: boolean
  tocar: (
    id: string,
    enPantalla: Partial<Participacion>,
    aGuardar: Record<string, unknown>,
  ) => void
  recargar: () => void
}

export interface Recompra {
  dinero: number
}

/**
 * Con cuánto entra alguien a una partida cash si nadie dice otra cosa.
 *
 * Casi todos entran con esto, así que arrancar en cero obligaba a teclear el mismo
 * número una vez por jugador. Se puede cambiar por persona antes de guardar.
 */
export const ENTRADA_POR_DEFECTO = 500

export const recomprasDe = (p: Participacion) => leerJson<Recompra[]>(p.recompras, [])

export const invertidoDe = (p: Participacion) =>
  num(p.entrada) + recomprasDe(p).reduce((a, r) => a + num(r.dinero), 0)

export const finalDe = (p: Participacion, colores: ChipColor[]) => {
  const fichas = leerJson<Chips>(p.fichas_final, {})
  return colores.reduce((t, c) => t + num(fichas[c.key]) * num(c.value), 0)
}

/** Color del número según gane, pierda o quede igual. Sobre fondo oscuro. */
export const tonoOscuro = (v: number) => (v > EPS ? '#4fc785' : v < -EPS ? '#ff6b6b' : '#8d8a86')

/** Clase de Tailwind para el número sobre las tarjetas crema. */
export const claseClara = (v: number) =>
  v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft'

/**
 * Reparto de fichas. El objetivo de cada jugador lo decide quien llama: en cash es lo
 * que puso al entrar, en torneo es el stack igual para todos.
 */
export function calcularReparto(
  participaciones: Participacion[],
  colores: ChipColor[],
  objetivo: (p: Participacion) => number,
): Distribution {
  return computeDistribution(
    participaciones.map((p) => ({
      id: p.id,
      name: p.nombre,
      buyIn: Math.round(objetivo(p)),
      deal: p.fichas_manual ? leerJson<Chips>(p.fichas_manual, {}) : null,
    })),
    colores,
  )
}

/**
 * Las fichas de un jugador, dentro de su tarjeta del registro.
 *
 * No es una pestaña aparte: el reparto se recalcula solo cuando cambian los montos o
 * quién juega, así que verlo junto al dinero que puso es donde tiene sentido.
 *
 * Llega plegado. Cinco casillas por jugador convierten el registro en un formulario
 * larguísimo, y casi nunca se tocan: el reparto sale bien solo. Plegado se ven las
 * fichas y sus cantidades en chiquito —que es lo que se mira para repartirlas— y al
 * abrirlo aparecen las casillas para corregir a mano.
 */
export function FichasDelJugador({
  fila,
  colores,
  puedeEditar,
  tocar,
  /* En cash las fichas son pesos y se escriben con signo; en torneo son puntos y
     escribirlas con signo de pesos es justo la confusión que hay que evitar. */
  formato = money,
}: {
  fila: DistributionRow
  colores: ChipColor[]
  puedeEditar: boolean
  tocar: PropsPestana['tocar']
  formato?: (n: number) => string
}) {
  const [abierto, setAbierto] = useState(false)
  const cuadra = Math.abs(fila.leftover) < EPS

  return (
    <div className="mt-3 border-t border-dashed border-paper-line pt-2.5">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
      >
        <span className="field-label shrink-0">Fichas</span>

        {/*
         * Plegado: la fila de fichas con su cantidad, que es lo que se mira al
         * repartirlas sobre la mesa.
         *
         * Va en rejilla de tantas columnas como colores haya, no en fila con huecos:
         * así se reparten a todo lo ancho y, si algún día la liga mete más colores,
         * siguen cabiendo en el mismo renglón en vez de salirse o irse abajo.
         */}
        <span
          className="grid min-w-0 flex-1 items-center gap-1"
          style={{ gridTemplateColumns: `repeat(${colores.length}, minmax(0, 1fr))` }}
        >
          {/* La ficha arriba y el número abajo, no lado a lado: así el número se queda
              con todo el ancho de su celda y no se corta cuando hay muchos colores. */}
          {colores.map((c) => (
            <span key={c.key} className="flex min-w-0 flex-col items-center">
              <Chip color={c} size={colores.length > 7 ? 15 : 18} />
              <b className="font-display text-[12px] leading-tight tabular-nums text-ink">
                {fila.counts[c.key] ?? 0}
              </b>
            </span>
          ))}
        </span>

        <ChevronRight
          size={15}
          strokeWidth={2.6}
          className={`shrink-0 text-ink-soft/50 transition-transform ${abierto ? 'rotate-90' : ''}`}
        />
      </button>

      {abierto && (
        <>
          {fila.manual && puedeEditar && (
            <button
              type="button"
              onClick={() => tocar(fila.id, { fichas_manual: null }, { fichasManual: null })}
              className="mt-2 flex cursor-pointer items-center gap-1 rounded-full border-none bg-marca/20 px-2 py-0.5 text-[10px] font-bold text-marca-tinta active:scale-95"
            >
              <RotateCcw size={10} strokeWidth={3} />
              Volver al reparto automático
            </button>
          )}

          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(54px,1fr))] gap-1.5">
            {colores.map((c) => (
              <label key={c.key} className="flex flex-col items-center gap-1">
                <Chip color={c} size={26} />
                {/* Sin el valor dentro de la ficha, el nombre es lo único que
                    distingue una columna de otra. */}
                <span className="w-full truncate text-center text-[10px] font-semibold text-ink-soft">
                  {c.label}
                </span>
                <NumInput
                  value={fila.counts[c.key] ?? 0}
                  showZero
                  aria-label={`Fichas ${c.label} para ${fila.name}`}
                  className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-1.5 text-center text-[14px] font-semibold outline-none focus:border-marca"
                  onChange={(v) => {
                    if (!puedeEditar) return
                    const nuevas = { ...fila.counts, [c.key]: v }
                    tocar(
                      fila.id,
                      { fichas_manual: JSON.stringify(nuevas) },
                      { fichasManual: nuevas },
                    )
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}

      {/* El total se queda siempre a la vista, abierto o cerrado: es lo que dice si
          las fichas cubren lo que puso. */}
      <p className="mt-2 mb-0 flex items-center gap-1.5 text-xs text-ink-soft">
        En fichas: <b className="text-ink">{formato(fila.total)}</b>
        {cuadra ? (
          <Check size={13} strokeWidth={3} className="text-win" />
        ) : (
          <>
            <span>
              ·{' '}
              {fila.leftover > 0
                ? `faltan ${formato(fila.leftover)}`
                : `se pasa ${formato(-fila.leftover)}`}
            </span>
            <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
          </>
        )}
      </p>
    </div>
  )
}

/** Cuántas fichas de cada color se están usando contra las que tiene la casa. */
/**
 * Quiénes van y con cuánto, de un vistazo y antes de la lista larga.
 *
 * Mientras se registra hay que bajar por las tarjetas de cada quien para saber quién
 * está y cuánto lleva puesto; con veinte jugadores eso es todo el scroll. Aquí arriba
 * cabe la mesa entera en dos columnas.
 */
export function ListaDeLaMesa({
  filas,
  rotulo = 'Quiénes van',
}: {
  filas: { id: string; nombre: string; monto: number }[]
  rotulo?: string
}) {
  if (filas.length === 0) return null
  const total = filas.reduce((t, f) => t + f.monto, 0)

  return (
    <section className="panel">
      <p className="panel-title">
        <span>{rotulo}</span>
      </p>

      {/* Sin rayitas entre renglones: en dos columnas, una mesa impar deja al último
          solo en su fila y la línea queda cortada a la mitad. El espacio separa igual. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-0.5 p-0">
        {filas.map((f) => (
          <li key={f.id} className="flex items-baseline justify-between gap-1.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-ink">{f.nombre}</span>
            <b className="shrink-0 font-display text-[15px] tabular-nums text-ink">
              {money(f.monto)}
            </b>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 mb-0 flex items-baseline justify-between border-t border-paper-line pt-2 text-[12px] text-ink-soft">
        <span>
          {filas.length} {filas.length === 1 ? 'jugador' : 'jugadores'}
        </span>
        <b className="font-display text-[17px] tabular-nums text-ink">{money(total)}</b>
      </p>
    </section>
  )
}

export function InventarioUsado({
  reparto,
  colores,
  /* En torneo las fichas son puntos: multiplicarlas por su valor en dinero no
     significa nada, así que la cuenta en pesos sólo sale en cash. */
  enDinero = false,
}: {
  reparto: Distribution
  colores: ChipColor[]
  enDinero?: boolean
}) {
  const caja = dineroDeLaCaja(colores, reparto)
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Fichas en uso</span>
      </p>

      {enDinero && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-paper-line bg-paper-soft px-2 py-2.5 text-center">
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">En la caja</div>
            <b className="font-display text-[17px] text-ink tabular-nums">{money(caja.total)}</b>
          </div>
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">Repartido</div>
            <b className="font-display text-[17px] text-ink tabular-nums">
              {money(caja.repartido)}
            </b>
          </div>
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">Queda</div>
            <b
              className={`font-display text-[17px] tabular-nums ${
                caja.queda < 0 ? 'text-loss' : 'text-win'
              }`}
            >
              {money(caja.queda)}
            </b>
          </div>
        </div>
      )}
      {reparto.anyOver && (
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>Estás repartiendo más fichas de las que tiene la liga en algún color.</span>
        </div>
      )}
      <ul className="m-0 list-none p-0">
        {colores.map((c) => {
          const u = reparto.usage[c.key]
          return (
            <li
              key={c.key}
              className="flex items-center justify-between border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <span className="flex items-center gap-2">
                <Chip color={c} />
                <span className="font-semibold text-ink">{c.label}</span>
              </span>
              <span className={`font-display font-bold ${u.over ? 'text-loss' : 'text-ink-soft'}`}>
                {u.used} / {u.inventory}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * El reparto de fichas, para mandarlo al chat.
 *
 * Sirve para que cada quien vea las suyas antes de sentarse y para que después nadie
 * discuta con cuántas arrancó.
 */
export function CompartirReparto({
  reparto,
  colores,
  datos,
}: {
  reparto: Distribution
  colores: ChipColor[]
  datos: DetallePartida
}) {
  const tabla: DatosTabla = {
    tipo: 'tabla',
    titulo: 'Reparto de fichas',
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    gorro: datos.liga.nombre,
    columnas: ['Jugador', ...colores.map((c) => c.label), 'Total'],
    filas: reparto.rows.map((r) => [
      r.name,
      ...colores.map((c) => String(r.counts[c.key] ?? 0)),
      Math.round(r.total).toLocaleString('es-MX'),
    ]),
    fotos: reparto.rows.map(
      (r) => datos.participaciones.find((p) => p.id === r.id)?.foto ?? null,
    ),
    pie: `${reparto.rows.length} jugadores`,
  }

  return (
    <ShareBlock
      datos={tabla}
      texto={() => distributionText(reparto, colores, money)}
      alt="Reparto de fichas"
    />
  )
}
