import { AlertTriangle, Check, RotateCcw } from 'lucide-react'
import Chip from '../../components/Chip'
import NumInput from '../../components/NumInput'
import { computeDistribution, type Distribution } from '../../lib/distribution'
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

/** Pestaña de reparto, idéntica en cash y en torneo salvo por el objetivo. */
export function PestanaReparto({
  reparto,
  colores,
  puedeEditar,
  tocar,
  nota,
}: {
  reparto: Distribution
  colores: ChipColor[]
  puedeEditar: boolean
  tocar: PropsPestana['tocar']
  nota: string
}) {
  return (
    <>
      <section className="panel">
        <p className="panel-title">
          <span>Reparto de fichas</span>
        </p>
        <p className="m-0 text-[13px] leading-snug text-ink-soft">{nota}</p>
      </section>

      {reparto.rows.map((r) => (
        <section key={r.id} className="panel">
          <div className="mb-2.5 flex items-center gap-2">
            <b className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
              {r.name}
            </b>
            {r.manual && puedeEditar && (
              <button
                type="button"
                onClick={() => tocar(r.id, { fichas_manual: null }, { fichasManual: null })}
                className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-marca/20 px-2 py-1 text-[11px] font-bold text-marca-tinta active:scale-95"
              >
                <RotateCcw size={11} strokeWidth={3} />
                Auto
              </button>
            )}
            <span className="font-bold text-ink-soft">{money(r.buyIn)}</span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1.5">
            {colores.map((c) => (
              <label key={c.key} className="flex flex-col items-center gap-1">
                <Chip color={c} size={30} />
                {/* Sin el valor dentro de la ficha, el nombre es lo único que
                    distingue una columna de otra. */}
                <span className="w-full truncate text-center text-[10px] font-semibold text-ink-soft">
                  {c.label}
                </span>
                <NumInput
                  value={r.counts[c.key] ?? 0}
                  showZero
                  aria-label={`Fichas ${c.label} para ${r.name}`}
                  className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-2 text-center text-[15px] font-semibold outline-none focus:border-marca"
                  onChange={(v) => {
                    if (!puedeEditar) return
                    const nuevas = { ...r.counts, [c.key]: v }
                    tocar(r.id, { fichas_manual: JSON.stringify(nuevas) }, { fichasManual: nuevas })
                  }}
                />
              </label>
            ))}
          </div>

          <p className="mt-2.5 mb-0 flex items-center gap-1.5 text-xs text-ink-soft">
            Total: <b className="text-ink">{money(r.total)}</b>
            {Math.abs(r.leftover) < EPS ? (
              <Check size={13} strokeWidth={3} className="text-win" />
            ) : (
              <>
                <span>
                  · {r.leftover > 0 ? `faltan ${money(r.leftover)}` : `te pasas ${money(-r.leftover)}`}
                </span>
                <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
              </>
            )}
          </p>
        </section>
      ))}

      <section className="panel">
        <p className="panel-title">
          <span>Inventario usado</span>
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
    </>
  )
}
