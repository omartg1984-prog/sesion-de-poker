import { AlertTriangle, Check, ClipboardCopy, Pencil, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import Chip from '../components/Chip'
import NumInput from '../components/NumInput'
import { copyText } from '../lib/backup'
import { computeDistribution, distributionText } from '../lib/distribution'
import type { DealPlayer } from '../lib/distribution'
import { EPS, money, num } from '../lib/money'
import { useSession } from '../store/session'
import type { Player, SessionState } from '../store/types'

/** Cuánto le toca en fichas a cada jugador: su entrada en cash, el buy-in en torneo. */
function buyInOf(p: Player, s: Pick<SessionState, 'mode' | 'tournament'>): number {
  return s.mode === 'torneo' ? Math.round(num(s.tournament.buyIn)) : Math.round(num(p.entrada.money))
}

export default function RepartoScreen() {
  const colors = useSession((s) => s.colors)
  const players = useSession((s) => s.players)
  const mode = useSession((s) => s.mode)
  const tournament = useSession((s) => s.tournament)
  const ignoreFlag = useSession((s) => s.ignoreInventory)
  const setIgnoreInventory = useSession((s) => s.setIgnoreInventory)
  const setDeal = useSession((s) => s.setDeal)
  const clearDeal = useSession((s) => s.clearDeal)
  const clearAllDeals = useSession((s) => s.clearAllDeals)
  const showToast = useSession((s) => s.showToast)

  const hasInventory = colors.some((c) => num(c.inventory) > 0)
  const ignore = ignoreFlag || !hasInventory

  const dist = useMemo(() => {
    const deal: DealPlayer[] = players.map((p, i) => ({
      id: p.id,
      name: p.name || `Jugador ${i + 1}`,
      buyIn: buyInOf(p, { mode, tournament }),
      deal: p.deal,
    }))
    return computeDistribution(deal, colors, ignore)
  }, [players, colors, mode, tournament, ignore])

  return (
    <>
      <section className="panel">
        <p className="panel-title">
          <span>Reparto de fichas</span>
        </p>
        <p className="mt-0 mb-2.5 text-[13px] text-ink-soft">
          Se recalcula solo según los jugadores y los montos. Puedes <b>editar a mano</b> las fichas
          de cualquiera; los demás se reacomodan para aprovechar el inventario.
        </p>

        {!hasInventory ? (
          <div className="balance balance-off">
            <AlertTriangle size={16} strokeWidth={2.4} />
            <span>
              Aún no dices cuántas fichas tienes. Ponlo en Ajustes (el engrane, arriba a la
              derecha). Mientras tanto el reparto va sin límite.
            </span>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-soft">
            <input
              type="checkbox"
              className="h-[18px] w-[18px]"
              checked={ignoreFlag}
              onChange={(e) => setIgnoreInventory(e.target.checked)}
            />
            Ignorar inventario (fichas ilimitadas)
          </label>
        )}

        <button type="button" className="btn-dashed mt-3" onClick={clearAllDeals}>
          <RotateCcw size={15} strokeWidth={2.6} />
          Recalcular todo en automático
        </button>
      </section>

      {dist.rows.map((r, i) => (
        <section key={r.id} className="panel">
          <div className="m-0 mb-3 flex items-center gap-2 font-display text-xl font-semibold tracking-[.5px]">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-felt text-[13px] text-white">
              {i + 1}
            </span>
            <span className="min-w-0 truncate font-semibold">{r.name}</span>
            {r.manual && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-[#7a5d20]">
                <Pencil size={11} strokeWidth={2.8} />
                Manual
              </span>
            )}
            <span className="ml-auto font-body text-base font-bold text-ink-soft">
              {money(r.buyIn)}
            </span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1.5">
            {colors.map((c) => (
              <label key={c.key} className="flex flex-col items-center gap-1">
                <Chip color={c} />
                <span className="sr-only">{c.label || 'Color'}</span>
                <NumInput
                  value={r.counts[c.key] ?? 0}
                  showZero
                  aria-label={`Fichas ${c.label || c.key} para ${r.name}`}
                  className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-2 text-center text-[15px] font-semibold outline-none focus:border-gold"
                  onChange={(v) => setDeal(r.id, { ...r.counts, [c.key]: v })}
                />
              </label>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-2.5">
            <p className="m-0 text-xs text-ink-soft">
              {r.buyIn <= 0 && r.total === 0 ? (
                'Sin entrada capturada'
              ) : Math.abs(r.leftover) < EPS ? (
                <>
                  Total: <b className="text-ink">{money(r.total)}</b>{' '}
                  <Check size={13} strokeWidth={3} className="inline text-win" />
                </>
              ) : r.leftover > 0 ? (
                <>
                  Total: <b className="text-ink">{money(r.total)}</b> · faltan {money(r.leftover)}{' '}
                  <AlertTriangle size={13} strokeWidth={2.6} className="inline text-loss" />
                </>
              ) : (
                <>
                  Total: <b className="text-ink">{money(r.total)}</b> · te pasas {money(-r.leftover)}{' '}
                  <AlertTriangle size={13} strokeWidth={2.6} className="inline text-loss" />
                </>
              )}
            </p>
            {r.manual && (
              <button
                type="button"
                className="icon-btn ml-auto h-[34px] w-auto gap-1.5 px-3 text-[13px] font-bold"
                title="Volver al reparto automático"
                onClick={() => clearDeal(r.id)}
              >
                <RotateCcw size={13} strokeWidth={2.8} />
                Auto
              </button>
            )}
          </div>
        </section>
      ))}

      <section className="panel">
        <p className="panel-title">
          <span>Inventario usado</span>
        </p>

        {dist.anyOver ? (
          <div className="balance balance-off">
            <AlertTriangle size={16} strokeWidth={2.4} />
            <span>
              Estás repartiendo más fichas de las que tienes en algún color. Ajusta a mano o baja
              cantidades.
            </span>
          </div>
        ) : dist.anyShortfall ? (
          <div className="balance balance-off">
            <AlertTriangle size={16} strokeWidth={2.4} />
            <span>
              No alcanzó para repartir exacto a todos. Agrega más fichas chicas al inventario,
              sube su cantidad, o edita a mano.
            </span>
          </div>
        ) : null}

        <ul className="m-0 mb-3.5 list-none p-0">
          {colors.map((c) => {
            const u = dist.usage[c.key]
            return (
              <li
                key={c.key}
                className="flex items-center justify-between border-b border-dashed border-paper-line px-1 py-2.5 font-semibold last:border-b-0"
              >
                <span className="flex items-center gap-2">
                  <Chip color={c} />
                  <span>{c.label}</span>
                </span>
                <span className={`font-display font-bold ${u.over ? 'text-loss' : 'text-ink-soft'}`}>
                  {ignore
                    ? `${u.used} repartidas`
                    : u.over
                      ? `${u.used} / ${u.inventory} · te pasas`
                      : `${u.used} / ${u.inventory}  (sobran ${u.inventory - u.used})`}
                </span>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="btn btn-share"
          onClick={async () =>
            showToast(
              (await copyText(distributionText(dist, colors, money))) ? 'Copiado' : 'No se pudo copiar',
            )
          }
        >
          <ClipboardCopy size={17} strokeWidth={2.4} />
          Copiar reparto
        </button>
      </section>
    </>
  )
}
