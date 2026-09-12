import { Check, HandCoins, Wand2 } from 'lucide-react'
import NumInput from '../../components/NumInput'
import { EPS, money, num } from '../../lib/money'
import { repartirRedondeado } from '../../lib/reparto'
import type { Participacion } from '../../lib/api'

/*
 * El reparto del dinero al final de la noche.
 *
 * Las fichas dicen cuánto le toca a cada quien al centavo, pero en la mesa hay billetes
 * de $50 y nadie trae morralla. Aquí se apunta cuánto se le dio de verdad, y lo que no
 * alcanzó para un billete más queda a la vista en vez de perderse en la cuenta.
 */

const BILLETES = [10, 20, 50, 100]

interface Props {
  /** Cada jugador con lo que le toca según sus fichas. */
  filas: { p: Participacion; nombre: string; leToca: number }[]
  totalMesa: number
  redondeo: number
  puedeEditar: boolean
  onRedondeo: (paso: number) => void
  onPago: (id: string, pagado: number | null) => void
}

export default function RepartoDinero({
  filas,
  totalMesa,
  redondeo,
  puedeEditar,
  onRedondeo,
  onPago,
}: Props) {
  const sugerido = repartirRedondeado(
    filas.map((f) => f.leToca),
    totalMesa,
    redondeo,
  )

  const yaSeRepartio = filas.some((f) => f.p.pagado !== null)
  const entregado = filas.reduce((a, f) => a + num(f.p.pagado), 0)
  const enLaMesa = totalMesa - entregado

  const aplicarSugerido = () => {
    filas.forEach((f, i) => onPago(f.p.id, sugerido.pagos[i]))
  }

  return (
    <section className="panel">
      <p className="panel-title">
        <span>El reparto del dinero</span>
      </p>
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Lo que le toca a cada quien sale de sus fichas, pero casi nunca hay morralla para
        pagarlo exacto. Apunta lo que le diste de verdad y abajo ves qué queda en la mesa.
      </p>

      {puedeEditar && (
        <>
          <div className="field-label mb-1.5">Billete más chico que traen</div>
          <div className="mb-2.5 flex gap-1.5">
            {BILLETES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onRedondeo(b)}
                className={`flex-1 cursor-pointer rounded-lg border-none px-2 py-2 text-[13px] font-bold transition-colors ${
                  redondeo === b ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
                }`}
              >
                ${b}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost mb-3" onClick={aplicarSugerido}>
            <Wand2 size={16} strokeWidth={2.4} />
            {yaSeRepartio ? 'Rehacer el reparto' : 'Repartir en billetes de $' + redondeo}
          </button>
        </>
      )}

      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
              <th className="px-1 pb-2 font-semibold">Jugador</th>
              <th className="px-1 pb-2 text-right font-semibold">Le toca</th>
              <th className="px-1 pb-2 text-right font-semibold">Se le dio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const pagado = f.p.pagado
              const dif = pagado === null ? 0 : pagado - f.leToca
              return (
                <tr key={f.p.id} className="border-t border-dashed border-paper-line">
                  <td className="max-w-[110px] truncate px-1 py-2 font-semibold text-ink">
                    {f.nombre}
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">
                    {money(f.leToca)}
                    {Math.abs(dif) > EPS && (
                      <span
                        className={`block text-[11px] ${dif > 0 ? 'text-win' : 'text-loss'}`}
                      >
                        {dif > 0 ? '+' : '−'}
                        {money(Math.abs(dif))}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-right">
                    {puedeEditar ? (
                      <span className="ml-auto flex w-[104px] items-center rounded-lg border border-paper-line bg-white px-1.5">
                        <span className="font-bold text-ink-soft">$</span>
                        <NumInput
                          value={pagado ?? 0}
                          /* Quien se quedó en ceros recibió $0 de verdad, y eso no es
                             lo mismo que no haberle repartido todavía: se muestra. */
                          showZero={pagado !== null}
                          mode="decimal"
                          placeholder={String(Math.round(sugerido.pagos[i]))}
                          aria-label={`Dinero entregado a ${f.nombre}`}
                          className="w-full border-none bg-transparent px-1 py-2 text-right text-[14px] font-semibold outline-none"
                          onChange={(v) => onPago(f.p.id, v)}
                        />
                      </span>
                    ) : (
                      <span className="font-semibold text-ink">
                        {pagado === null ? '—' : money(pagado)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {yaSeRepartio ? (
        Math.abs(enLaMesa) < EPS ? (
          <div className="balance balance-ok mt-3 mb-0">
            <Check size={16} strokeWidth={2.6} />
            Se repartió todo: no queda nada en la mesa
          </div>
        ) : (
          <div className={`balance mt-3 mb-0 ${enLaMesa > 0 ? 'balance-ok' : 'balance-off'}`}>
            <HandCoins size={16} strokeWidth={2.4} />
            {enLaMesa > 0
              ? `Quedan ${money(enLaMesa)} en la mesa`
              : `Se entregaron ${money(-enLaMesa)} de más`}
          </div>
        )
      ) : (
        <p className="mt-3 mb-0 text-center text-[12px] text-ink-soft">
          Todavía no se reparte el dinero.
          {sugerido.sobra > EPS && ` Con billetes de $${redondeo} sobrarían ${money(sugerido.sobra)}.`}
        </p>
      )}
    </section>
  )
}
