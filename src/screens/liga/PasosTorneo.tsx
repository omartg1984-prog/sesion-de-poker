import MoneyInput from '../../components/MoneyInput'
import NumInput from '../../components/NumInput'
import { money, num } from '../../lib/money'
import type { ConfigTorneo } from '../../lib/api'
import { fichasPorPrecio, planFichas, stackSugerido } from '../../lib/torneo'
import Chip from '../../components/Chip'
import Premios from './Premios'
import type { ChipColor } from '../../store/types'

/*
 * Corregir lo que se definió al armar el torneo.
 *
 * El torneo nace en su asistente (ver CrearTorneo), con todo calculado. Esto es para
 * después: llegó uno más, se acordó subir la recompra, se decidió pagar un cuarto lugar.
 *
 * Lo importante: el dinero y las fichas son dos cosas distintas. Se paga una entrada de
 * $500 y se reciben, digamos, 10,000 puntos que no se cambian por nada hasta que el
 * torneo acaba y se reparte la bolsa. Y los puntos no salen más baratos por recomprar:
 * lo que da una recompra es la misma proporción que la entrada, así que lo calcula la
 * app y no se teclea.
 */

const miles = (n: number) => Math.round(n).toLocaleString('es-MX')

export default function PasosTorneo({
  torneo,
  colores,
  jugadores,
  onCambiar,
}: {
  torneo: ConfigTorneo
  colores: ChipColor[]
  /** Cuántos están cargados: de eso depende que las fichas alcancen. */
  jugadores: number
  onCambiar: (t: ConfigTorneo) => void
}) {
  const stack = num(torneo.stack) || stackSugerido(torneo.buyIn)
  const recomprasEsperadas = num(torneo.recomprasEsperadas)
  const addOnsEsperados = num(torneo.addOnsEsperados)

  const plan = planFichas({
    colores,
    jugadores: Math.max(2, jugadores),
    stack,
    fichasRecompra: fichasPorPrecio(torneo.rebuyPrice, torneo.buyIn, stack),
    fichasAddOn: fichasPorPrecio(torneo.addOnPrice, torneo.buyIn, stack),
    recomprasEsperadas,
    addOnsEsperados,
  })
  const valores = torneo.valores ?? plan.valores
  const aMano = JSON.stringify(valores) !== JSON.stringify(plan.valores)

  /*
   * Cualquier cambio vuelve a bajar las fichas del dinero: si no, quedaría una recompra
   * de $400 dando los puntos de cuando la entrada costaba otra cosa.
   */
  const aplicar = (cambios: Partial<ConfigTorneo>, valoresNuevos = valores) => {
    const t = { ...torneo, ...cambios }
    const s = num(t.stack) || stackSugerido(t.buyIn)
    const masChica = Math.min(...Object.values(valoresNuevos))
    onCambiar({
      ...t,
      stack: s,
      valores: valoresNuevos,
      rebuyChips: fichasPorPrecio(t.rebuyPrice, t.buyIn, s, masChica),
      addOnChips: fichasPorPrecio(t.addOnPrice, t.buyIn, s, masChica),
    })
  }

  /* Mover el stack deja los valores hechos a mano sin sentido: se calcularon con otro
     número. Vuelven a los que propone la app para ese stack. */
  const cambiarStack = (v: number) => {
    const s = Math.max(1, v)
    const conElNuevo = planFichas({
      colores,
      jugadores: Math.max(2, jugadores),
      stack: s,
      fichasRecompra: fichasPorPrecio(torneo.rebuyPrice, torneo.buyIn, s),
      fichasAddOn: fichasPorPrecio(torneo.addOnPrice, torneo.buyIn, s),
      recomprasEsperadas,
      addOnsEsperados,
    })
    aplicar({ stack: v }, conElNuevo.valores)
  }

  return (
    <>
      <p className="field-label mt-1 mb-1">Cuánto cuesta jugar</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        Lo que cada quien paga. Arma la bolsa que se reparte al final.
      </p>
      <MoneyInput label="Entrada" value={torneo.buyIn} onChange={(v) => aplicar({ buyIn: v })} />
      <MoneyInput
        label="Recompra"
        value={torneo.rebuyPrice}
        onChange={(v) => aplicar({ rebuyPrice: v })}
      />
      <MoneyInput
        label="Add-on"
        value={torneo.addOnPrice}
        onChange={(v) => aplicar({ addOnPrice: v })}
      />
      <MoneyInput
        label="Cena por persona"
        value={num(torneo.cenaPorPersona)}
        onChange={(v) => aplicar({ cenaPorPersona: v })}
      />
      <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
        Si la entrada incluye cena, sale de la bolsa antes de repartir premios. En 0 no se
        descuenta nada.
      </p>

      {/* Hasta cuándo se compra. Es la regla que se discute a media noche, cuando al
          que se quedó sin fichas le urge una recompra más: escrita antes de empezar, y
          aceptada por cada quien al apuntarse, ya no se discute. */}
      {(num(torneo.rebuyPrice) > 0 || num(torneo.addOnPrice) > 0) && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {num(torneo.rebuyPrice) > 0 && (
            <div>
              <span className="field-label">Recompras hasta el nivel</span>
              <div className="field-box mt-1">
                <NumInput
                  value={num(torneo.recomprasHasta)}
                  showZero
                  aria-label="Recompras hasta el nivel"
                  onChange={(v) => aplicar({ recomprasHasta: v })}
                />
              </div>
            </div>
          )}
          {num(torneo.addOnPrice) > 0 && (
            <div>
              <span className="field-label">Add-on hasta el nivel</span>
              <div className="field-box mt-1">
                <NumInput
                  value={num(torneo.addOnsHasta)}
                  showZero
                  aria-label="Add-on hasta el nivel"
                  onChange={(v) => aplicar({ addOnsHasta: v })}
                />
              </div>
            </div>
          )}
        </div>
      )}
      {(num(torneo.rebuyPrice) > 0 || num(torneo.addOnPrice) > 0) && (
        <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
          En 0 se puede comprar toda la noche.
        </p>
      )}

      <div className="mt-1 mb-4 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
        <p className="field-label mt-0 mb-1.5">Lo que da cada cosa</p>
        <ul className="m-0 list-none p-0 text-[13px]">
          <li className="flex justify-between py-0.5">
            <span className="text-ink-soft">Entrada {money(torneo.buyIn)}</span>
            <b className="text-ink">{miles(stack)} fichas</b>
          </li>
          {num(torneo.rebuyPrice) > 0 && (
            <li className="flex justify-between py-0.5">
              <span className="text-ink-soft">Recompra {money(torneo.rebuyPrice)}</span>
              <b className="text-ink">{miles(num(torneo.rebuyChips) || stack)} fichas</b>
            </li>
          )}
          {num(torneo.addOnPrice) > 0 && (
            <li className="flex justify-between py-0.5">
              <span className="text-ink-soft">Add-on {money(torneo.addOnPrice)}</span>
              <b className="text-ink">{miles(num(torneo.addOnChips) || stack)} fichas</b>
            </li>
          )}
        </ul>
      </div>

      <div className="mb-3">
        <span className="field-label">Fichas con las que arranca cada quien</span>
        <div className="field-box mt-1">
          <NumInput
            value={stack}
            showZero
            mode="decimal"
            aria-label="Fichas con las que arranca cada quien"
            onChange={cambiarStack}
          />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <span className="field-label">Recompras que calculas</span>
          <div className="field-box mt-1">
            <NumInput
              value={recomprasEsperadas}
              showZero
              aria-label="Recompras que calculas"
              onChange={(v) => aplicar({ recomprasEsperadas: v })}
            />
          </div>
        </div>
        <div>
          <span className="field-label">Add-ons que calculas</span>
          <div className="field-box mt-1">
            <NumInput
              value={addOnsEsperados}
              showZero
              aria-label="Add-ons que calculas"
              onChange={(v) => aplicar({ addOnsEsperados: v })}
            />
          </div>
        </div>
      </div>

      <p className="field-label mt-4 mb-1">Cuánto vale cada ficha esa noche</p>
      <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
        Se asignan solas para que alcancen y para que la más chica pague la ciega chica. Puedes
        cambiarlas.
      </p>
      {plan.aviso && <div className="balance balance-off">{plan.aviso}</div>}
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
              onChange={(v) => aplicar({}, { ...valores, [c.key]: v })}
            />
          </label>
        ))}
      </div>
      {aMano && (
        <button
          type="button"
          className="btn btn-ghost mt-1 mb-2"
          onClick={() => aplicar({}, plan.valores)}
        >
          Volver a los valores que propone la app
        </button>
      )}

      <p className="field-label mt-4 mb-1.5">Cómo se reparten los premios</p>
      <Premios payouts={torneo.payouts} onCambiar={(payouts) => onCambiar({ ...torneo, payouts })} />
    </>
  )
}
