import { Plus, X } from 'lucide-react'
import MoneyInput from '../../components/MoneyInput'
import NumInput from '../../components/NumInput'
import { EPS, num } from '../../lib/money'
import { PAYOUT_PRESETS } from '../../store/defaults'
import type { ConfigTorneo } from '../../lib/api'

/*
 * Lo que hay que definir antes de cargar a nadie en un torneo.
 *
 * Antes esto vivía dentro de la partida ya creada, y se entraba a cargar jugadores con
 * la entrada en cero: a todos les tocaban cero fichas y había que volver atrás. El
 * costo de entrada es lo que decide el stack, así que va primero.
 */

const sumaPct = (t: ConfigTorneo) => t.payouts.reduce((s, x) => s + num(x.pct), 0)

export default function PasosTorneo({
  torneo,
  onCambiar,
}: {
  torneo: ConfigTorneo
  onCambiar: (t: ConfigTorneo) => void
}) {
  const suma = sumaPct(torneo)
  const cuadra = Math.abs(suma - 100) < EPS

  return (
    <>
      <p className="field-label mt-1 mb-1">Cuánto cuesta jugar</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        La entrada es igual para todos y es la que define con cuántas fichas arrancan.
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
