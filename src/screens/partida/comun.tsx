import { AlertTriangle, Check, RotateCcw } from 'lucide-react'
import Chip from '../../components/Chip'
import NumInput from '../../components/NumInput'
import {
  computeDistribution,
  type Distribution,
  type DistributionRow,
} from '../../lib/distribution'
import { EPS, money, num } from '../../lib/money'
import { leerJson, type DetallePartida, type Participacion } from '../../lib/api'
import type { ChipColor, Chips } from '../../store/types'

/** Lo que cada pestaña necesita para trabajar. */
export interface PropsPestana {
  datos: DetallePartida
  colores: ChipColor[]
  puedeEditar: boolean
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
 * Las fichas de un jugador, para meter dentro de su tarjeta del registro.
 *
 * No es una pestaña aparte: el reparto se recalcula solo cuando cambian los montos o
 * quién juega, así que verlo junto al dinero que puso es donde tiene sentido.
 */
export function FichasDelJugador({
  fila,
  colores,
  puedeEditar,
  tocar,
}: {
  fila: DistributionRow
  colores: ChipColor[]
  puedeEditar: boolean
  tocar: PropsPestana['tocar']
}) {
  return (
    <div className="mt-3 border-t border-dashed border-paper-line pt-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="field-label flex-1">Fichas que le tocan</span>
        {fila.manual && puedeEditar && (
          <button
            type="button"
            onClick={() => tocar(fila.id, { fichas_manual: null }, { fichasManual: null })}
            className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-marca/20 px-2 py-0.5 text-[10px] font-bold text-marca-tinta active:scale-95"
          >
            <RotateCcw size={10} strokeWidth={3} />
            Auto
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(54px,1fr))] gap-1.5">
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
                tocar(fila.id, { fichas_manual: JSON.stringify(nuevas) }, { fichasManual: nuevas })
              }}
            />
          </label>
        ))}
      </div>

      <p className="mt-2 mb-0 flex items-center gap-1.5 text-xs text-ink-soft">
        En fichas: <b className="text-ink">{money(fila.total)}</b>
        {Math.abs(fila.leftover) < EPS ? (
          <Check size={13} strokeWidth={3} className="text-win" />
        ) : (
          <>
            <span>
              · {fila.leftover > 0 ? `faltan ${money(fila.leftover)}` : `se pasa ${money(-fila.leftover)}`}
            </span>
            <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
          </>
        )}
      </p>
    </div>
  )
}

/** Cuántas fichas de cada color se están usando contra las que tiene la casa. */
export function InventarioUsado({
  reparto,
  colores,
}: {
  reparto: Distribution
  colores: ChipColor[]
}) {
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Fichas en uso</span>
      </p>
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
