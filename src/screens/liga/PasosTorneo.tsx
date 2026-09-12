import { Plus, X } from 'lucide-react'
import MoneyInput from '../../components/MoneyInput'
import NumInput from '../../components/NumInput'
import { EPS, num } from '../../lib/money'
import { PAYOUT_PRESETS } from '../../store/defaults'
import type { ConfigTorneo } from '../../lib/api'
import { asignarValores } from '../../lib/torneo'
import Chip from '../../components/Chip'
import type { ChipColor } from '../../store/types'

/*
 * Lo que hay que definir antes de cargar a nadie en un torneo: qué cuesta, qué fichas
 * da y cómo se reparte la bolsa.
 *
 * Antes esto vivía dentro de la partida ya creada y se entraba al registro con todo en
 * cero, así que a todos les tocaban cero fichas y había que volver atrás.
 *
 * Lo importante: el dinero y las fichas son dos cosas distintas. Se paga una entrada de
 * $500 y se reciben, digamos, 1,000 puntos que no se cambian por nada hasta que el
 * torneo acaba y se reparte la bolsa entre los que quedaron arriba.
 */

const sumaPct = (t: ConfigTorneo) => t.payouts.reduce((s, x) => s + num(x.pct), 0)

export default function PasosTorneo({
  torneo,
  colores,
  onCambiar,
}: {
  torneo: ConfigTorneo
  colores: ChipColor[]
  onCambiar: (t: ConfigTorneo) => void
}) {
  const suma = sumaPct(torneo)
  const cuadra = Math.abs(suma - 100) < EPS

  const stack = num(torneo.stack) || 1000
  /*
   * La ficha más chica tiene que valer lo que la ciega chica del primer nivel, que sale
   * de la profundidad estándar: cien ciegas grandes de stack. Los valores se asignan
   * solos con esa unidad y se recalculan si cambia el stack.
   */
  const unidad = Math.max(1, Math.round(stack / 200))
  const valores = torneo.valores ?? asignarValores(colores, unidad)

  const ponerStack = (v: number) =>
    onCambiar({
      ...torneo,
      stack: v,
      valores: asignarValores(colores, Math.max(1, Math.round((v || 1000) / 200))),
    })

  return (
    <>
      <p className="field-label mt-1 mb-1">Cuánto cuesta jugar</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        Lo que cada quien paga. Es igual para todos y arma la bolsa que se reparte al final.
      </p>
      <MoneyInput
        label="Entrada"
        value={torneo.buyIn}
        onChange={(v) => onCambiar({ ...torneo, buyIn: v })}
      />
      <MoneyInput
        label="Recompra"
        value={torneo.rebuyPrice}
        onChange={(v) => onCambiar({ ...torneo, rebuyPrice: v })}
      />
      <MoneyInput
        label="Add-on"
        value={torneo.addOnPrice}
        onChange={(v) => onCambiar({ ...torneo, addOnPrice: v })}
      />

      <p className="field-label mt-4 mb-1">Cuántas fichas da cada cosa</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        En torneo las fichas no son dinero: son puntos que no se cambian hasta el final. Por eso el
        stack se pone aparte de lo que cuesta.
      </p>
      <div className="mb-2">
        <span className="field-label">Fichas de la entrada</span>
        <div className="field-box mt-1">
          <NumInput
            value={stack}
            showZero
            mode="decimal"
            aria-label="Fichas de la entrada"
            onChange={ponerStack}
          />
        </div>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <span className="field-label">Por recompra</span>
          <div className="field-box mt-1">
            <NumInput
              value={num(torneo.rebuyChips) || stack}
              showZero
              mode="decimal"
              aria-label="Fichas por recompra"
              onChange={(v) => onCambiar({ ...torneo, rebuyChips: v })}
            />
          </div>
        </div>
        <div>
          <span className="field-label">Por add-on</span>
          <div className="field-box mt-1">
            <NumInput
              value={num(torneo.addOnChips) || stack}
              showZero
              mode="decimal"
              aria-label="Fichas por add-on"
              onChange={(v) => onCambiar({ ...torneo, addOnChips: v })}
            />
          </div>
        </div>
      </div>

      <p className="field-label mt-4 mb-1">Cuánto vale cada ficha esa noche</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        Se asignan solas para que alcancen y para que la más chica pague la ciega chica. Puedes
        cambiarlas.
      </p>
      <div className="mb-1 grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
        {colores.map((c) => (
          <label key={c.key} className="flex flex-col items-center gap-1">
            <Chip color={c} size={26} />
            <span className="w-full truncate text-center text-[10px] font-semibold text-ink-soft">
              {c.label}
            </span>
            <NumInput
              value={valores[c.key] ?? 0}
              showZero
              mode="decimal"
              aria-label={`Valor de ${c.label} en el torneo`}
              className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-1.5 text-center text-[14px] font-semibold outline-none focus:border-marca"
              onChange={(v) => onCambiar({ ...torneo, valores: { ...valores, [c.key]: v } })}
            />
          </label>
        ))}
      </div>

      <p className="field-label mt-4 mb-1.5">Cómo se reparten los premios</p>
      <div className="mb-2.5 flex flex-wrap gap-2">
        {PAYOUT_PRESETS.map((pr) => (
          <button
            key={pr.label}
            type="button"
            onClick={() => onCambiar({ ...torneo, payouts: pr.pcts.map((pct) => ({ pct })) })}
            className="cursor-pointer rounded-full border border-paper-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-marca hover:text-ink"
          >
            {pr.label}
          </button>
        ))}
      </div>

      {torneo.payouts.map((po, i) => (
        <div
          key={i}
          className="mb-2 flex items-center gap-2 rounded-[10px] border border-paper-line bg-paper-soft px-2.5 py-2"
        >
          <span className="min-w-[42px] font-display text-base font-bold text-ink">{i + 1}º</span>
          <div className="field-box w-[86px] shrink-0">
            <NumInput
              value={po.pct}
              mode="decimal"
              showZero
              aria-label={`Porcentaje del lugar ${i + 1}`}
              onChange={(v) =>
                onCambiar({
                  ...torneo,
                  payouts: torneo.payouts.map((x, xi) => (xi === i ? { pct: v } : x)),
                })
              }
            />
            <span className="font-bold text-ink-soft">%</span>
          </div>
          {torneo.payouts.length > 1 && (
            <button
              type="button"
              aria-label={`Quitar el lugar ${i + 1}`}
              onClick={() =>
                onCambiar({ ...torneo, payouts: torneo.payouts.filter((_, xi) => xi !== i) })
              }
              className="ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn-dashed mb-2 flex items-center justify-center gap-1.5"
        onClick={() => onCambiar({ ...torneo, payouts: [...torneo.payouts, { pct: 0 }] })}
      >
        <Plus size={15} strokeWidth={2.6} />
        Agregar lugar
      </button>

      <p
        className={`mt-0 mb-3 text-center text-[12px] font-semibold ${
          cuadra ? 'text-win' : 'text-loss'
        }`}
      >
        {cuadra ? 'Los premios suman 100%' : `Suman ${suma}%, tienen que sumar 100%`}
      </p>
    </>
  )
}
