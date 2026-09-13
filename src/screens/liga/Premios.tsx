import { Plus, X } from 'lucide-react'
import NumInput from '../../components/NumInput'
import { EPS, num } from '../../lib/money'
import { PAYOUT_PRESETS } from '../../store/defaults'

/*
 * Cómo se parte la bolsa. Vive aparte porque se edita en dos momentos: al planear el
 * torneo y después, si la mesa decide pagar un lugar más.
 */

export interface Premio {
  pct: number
}

export const premiosCuadran = (payouts: Premio[]) =>
  Math.abs(payouts.reduce((s, x) => s + num(x.pct), 0) - 100) < EPS

export default function Premios({
  payouts,
  onCambiar,
}: {
  payouts: Premio[]
  onCambiar: (p: Premio[]) => void
}) {
  const suma = payouts.reduce((s, x) => s + num(x.pct), 0)

  return (
    <>
      <div className="mb-2.5 flex flex-wrap gap-2">
        {PAYOUT_PRESETS.map((pr) => (
          <button
            key={pr.label}
            type="button"
            onClick={() => onCambiar(pr.pcts.map((pct) => ({ pct })))}
            className="cursor-pointer rounded-full border border-paper-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-marca hover:text-ink"
          >
            {pr.label}
          </button>
        ))}
      </div>

      {payouts.map((po, i) => (
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
              onChange={(v) => onCambiar(payouts.map((x, xi) => (xi === i ? { pct: v } : x)))}
            />
            <span className="font-bold text-ink-soft">%</span>
          </div>
          {payouts.length > 1 && (
            <button
              type="button"
              aria-label={`Quitar el lugar ${i + 1}`}
              onClick={() => onCambiar(payouts.filter((_, xi) => xi !== i))}
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
        onClick={() => onCambiar([...payouts, { pct: 0 }])}
      >
        <Plus size={15} strokeWidth={2.6} />
        Agregar lugar
      </button>

      <p
        className={`mt-0 mb-3 text-center text-[12px] font-semibold ${
          premiosCuadran(payouts) ? 'text-win' : 'text-loss'
        }`}
      >
        {premiosCuadran(payouts)
          ? 'Los premios suman 100%'
          : `Suman ${suma}%, tienen que sumar 100%`}
      </p>
    </>
  )
}
