import MoneyInput from '../components/MoneyInput'
import NumInput from '../components/NumInput'
import { EPS, money, payoutAmount, pctSum } from '../lib/money'
import { PAYOUT_PRESETS } from '../store/defaults'
import { useSession } from '../store/session'

/** Costos del torneo y estructura de premios. */
export default function TorneoConfigScreen() {
  const tournament = useSession((s) => s.tournament)
  const players = useSession((s) => s.players)
  const setTournamentField = useSession((s) => s.setTournamentField)
  const setPayoutPct = useSession((s) => s.setPayoutPct)
  const addPayout = useSession((s) => s.addPayout)
  const removePayout = useSession((s) => s.removePayout)
  const applyPayoutPreset = useSession((s) => s.applyPayoutPreset)

  const sum = pctSum(tournament)
  const cuadra = Math.abs(sum - 100) < EPS

  return (
    <>
      <section className="panel">
        <p className="panel-title">
          <span>Costos del torneo</span>
        </p>
        <p className="mt-0 mb-3 text-[13px] text-ink-soft">
          La entrada es igual para todos. Recompra y add-on suman a la bolsa.
        </p>
        <MoneyInput
          label="Entrada"
          value={tournament.buyIn}
          onChange={(v) => setTournamentField('buyIn', v)}
        />
        <MoneyInput
          label="Recompra"
          value={tournament.rebuyPrice}
          onChange={(v) => setTournamentField('rebuyPrice', v)}
        />
        <MoneyInput
          label="Add-on"
          value={tournament.addOnPrice}
          onChange={(v) => setTournamentField('addOnPrice', v)}
        />
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Premios por lugar (%)</span>
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {PAYOUT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="cursor-pointer rounded-[20px] border border-paper-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-gold hover:text-ink"
              onClick={() => applyPayoutPreset(preset.pcts)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {tournament.payouts.map((po, i) => (
          <div
            key={i}
            className="mb-2 flex items-center gap-2 rounded-[10px] border border-paper-line bg-paper-soft px-2.5 py-2"
          >
            <span className="min-w-[58px] font-display text-base font-bold">{i + 1}º</span>
            <div className="field-box w-[86px] shrink-0">
              <NumInput
                value={po.pct}
                mode="decimal"
                showZero
                aria-label={`Porcentaje del lugar ${i + 1}`}
                onChange={(v) => setPayoutPct(i, v)}
              />
              <span className="font-bold text-ink-soft">%</span>
            </div>
            <span className="ml-auto font-display text-[17px] font-bold text-win">
              {money(payoutAmount(i, players, tournament))}
            </span>
            <button
              type="button"
              className="icon-btn icon-btn-danger h-[30px] w-[30px] text-sm"
              aria-label={`Quitar el lugar ${i + 1}`}
              onClick={() => removePayout(i)}
            >
              ✕
            </button>
          </div>
        ))}

        <button type="button" className="btn-dashed mb-3" onClick={addPayout}>
          ＋ Agregar lugar
        </button>

        <div className={`balance ${cuadra ? 'balance-ok' : 'balance-off'} mb-0`}>
          {cuadra ? 'Suma: 100% ✓' : `Suma: ${sum}% ⚠ (debe sumar 100%)`}
        </div>
      </section>
    </>
  )
}
