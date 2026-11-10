import { AlertTriangle, Check, Layers, Pencil, Sparkles } from 'lucide-react'
import { useState } from 'react'
import Chip from './Chip'
import ChipsGrid from './ChipsGrid'
import MoneyInput from './MoneyInput'
import Stepper from './Stepper'
import { api } from '../lib/api'
import { dineroDeLaCaja } from '../lib/distribution'
import { count, money } from '../lib/money'
import {
  armarEntrada,
  entradaDeArranque,
  entradaSugerida,
  planDeFichas,
  type Topes,
} from '../lib/plan-fichas'
import { repartoDeLaCasa } from '../lib/reparto-de-la-casa'
import { conAviso, useApp } from '../store/app'
import type { ChipColor, Chips } from '../store/types'

/*
 * El plan de las fichas: cómo se reparten y para cuántos alcanzan.
 *
 * Antes la app repartía sola y el reparto no se veía hasta que ya estaba hecho, dentro
 * de la tarjeta de cada jugador. Con cinco colores y seis en la mesa eso alcanzaba. Con
 * fichas de $50 y de $100 y veinte apuntados, no: lo que se pregunta en la mesa antes de
 * empezar es "¿cómo las repartimos y para cuántos alcanza?", y eso no se contesta
 * bajando por veinte tarjetas.
 *
 * Vive en dos lados y funciona distinto en cada uno:
 *
 * - En el registro de una noche de cash, donde la pila que se ve es la de la liga y hay
 *   que apretar un botón para dejarla guardada. Ahí se prueba sin miedo: mover el plan
 *   no le cambia las fichas a nadie hasta que se guarda.
 *
 * - En las fichas de la casa de la liga, donde el plan *es* el editor: lo que se mueve
 *   se escribe arriba al vuelo y se guarda con el botón de la hoja. Es donde se juega con
 *   él fuera de una partida, que es cuando de verdad se decide cómo se reparten.
 */

const mismas = (a: Chips, b: Chips, colores: ChipColor[]) =>
  colores.every((c) => count(a[c.key]) === count(b[c.key]))

/** "10 blancas, 8 azules y 2 moradas" */
function enPalabras(fichas: Chips, colores: ChipColor[]): string {
  const partes = colores
    .filter((c) => count(fichas[c.key]) > 0)
    .map((c) => `${count(fichas[c.key])} ${(c.label || 'fichas').toLowerCase()}`)
  if (partes.length === 0) return 'ninguna'
  if (partes.length === 1) return partes[0]
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1]
}

/** La pila dibujada: la ficha arriba y cuántas van debajo. */
function Pila({ fichas, colores }: { fichas: Chips; colores: ChipColor[] }) {
  return (
    <div
      className="grid items-start gap-1"
      style={{ gridTemplateColumns: `repeat(${colores.length}, minmax(0, 1fr))` }}
    >
      {colores.map((c) => {
        const n = count(fichas[c.key])
        return (
          <div
            key={c.key}
            className={`flex min-w-0 flex-col items-center ${n === 0 ? 'opacity-35' : ''}`}
          >
            <Chip color={c} size={colores.length > 6 ? 22 : 26} />
            <b className="font-display text-[14px] leading-tight tabular-nums text-ink">{n}</b>
            {/* El nombre del color encoge antes que cortarse: con siete colores "Amarill…"
                no dice de qué ficha estamos hablando, y partido en dos renglones se lee
                peor todavía. */}
            <span
              className={`w-full truncate text-center leading-tight text-ink-soft ${
                colores.length > 6 ? 'text-[8px]' : 'text-[9.5px]'
              }`}
            >
              {c.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function PlanDeFichas({
  colores,
  objetivo: objetivoBase,
  objetivoEditable = false,
  pilas: pilasBase,
  deDonde,
  puedeEditar,
  onCambio,
  ligaId,
  recargar,
}: {
  colores: ChipColor[]
  /** Con cuánto entra la mayoría: el valor que tienen que sumar las fichas de la pila. */
  objetivo: number
  /** Deja cambiar ese monto aquí mismo, para probar cómo quedarían otras entradas. */
  objetivoEditable?: boolean
  /** Para cuántas pilas arranca la cuenta. */
  pilas: number
  /** De dónde sale ese número, en una línea: "Hoy van 14 apuntados". */
  deDonde?: string
  puedeEditar: boolean
  /**
   * Con esto el plan queda controlado desde fuera: cada cambio se escribe al vuelo en
   * las fichas de la casa y quien lo use se encarga de guardarlas. Sin esto, el plan
   * guarda solo, con su propio botón.
   */
  onCambio?: (fichas: Chips) => void
  /** Para guardar desde aquí. Hace falta cuando no hay `onCambio`. */
  ligaId?: string
  recargar?: () => void
}) {
  /** La pila que se está probando. `null` = la que tiene puesta la liga. */
  const [tocada, setTocada] = useState<Chips | null>(null)
  /** Para cuántas pilas se está haciendo la cuenta. `null` = las que trae de fuera. */
  const [cuantas, setCuantas] = useState<number | null>(null)
  /** La entrada que se está probando. `null` = la que trae de fuera. */
  const [otraEntrada, setOtraEntrada] = useState<number | null>(null)
  const controlado = !!onCambio
  const [abierto, setAbierto] = useState(controlado)
  const [guardando, setGuardando] = useState(false)
  const avisar = useApp((s) => s.avisar)

  if (colores.length === 0) return null

  const objetivo = Math.max(0, Math.round(otraEntrada ?? objetivoBase))
  const casa = repartoDeLaCasa(colores)

  /*
   * Controlado, la pila que se ve es la de la liga tal cual, sin sugerencias: si se le
   * cayera encima la del automático en cuanto deja de cuadrar, no se podría teclear —al
   * quitar las verdes el campo saltaría solo.
   */
  const deLaLiga: Chips = {}
  for (const c of colores) deLaLiga[c.key] = count(casa?.fichas[c.key])
  const arranque = controlado ? deLaLiga : entradaDeArranque(colores, objetivo).fichas
  const pila = tocada ?? arranque
  const cambiar = (fichas: Chips) => (onCambio ? onCambio(fichas) : setTocada(fichas))

  /* Siempre al menos una: la cuenta de "aguanta para cero" no le sirve a nadie. */
  const pilas = Math.max(1, cuantas ?? pilasBase)
  const plan = planDeFichas(colores, objetivo, pila, pilas)
  const caja = dineroDeLaCaja(colores)

  /* Lo que la liga ya tiene guardado, para no ofrecer guardar lo que ya está. */
  const yaGuardada =
    !!casa && Math.abs(casa.total - objetivo) < 1e-9 && mismas(pila, casa.fichas, colores)

  const sugerida = entradaSugerida(colores, objetivo)
  const haySugerencia =
    Math.abs(sugerida.total - objetivo) < 1e-9 && !mismas(sugerida.fichas, pila, colores)

  /*
   * El reparto que sí aguantaría a todos: el mismo de arriba pero con tope de
   * `inventario / pilas` por color, que es lo que mete las fichas grandes cuando la
   * morralla ya no alcanza para todos.
   */
  const topes: Topes = {}
  for (const c of colores) topes[c.key] = Math.floor(count(c.inventory) / pilas)
  const ajuste = armarEntrada(colores, objetivo, pila, topes)
  const ajusteSirve =
    Math.abs(ajuste.total - objetivo) < 1e-9 && !mismas(ajuste.fichas, pila, colores)
  /* Cuando ni moviendo el reparto alcanza, es que la caja no tiene el dinero. */
  const faltaDinero = caja.total < objetivo * pilas

  const vacia = colores.every((c) => count(pila[c.key]) === 0)
  const quedan = colores.filter((c) => plan.sobra[c.key] > 0)

  const guardar = async () => {
    if (!ligaId) return
    setGuardando(true)
    const nuevos = colores.map((c) => ({ ...c, entrada: count(pila[c.key]) }))
    const r = await conAviso(() => api.guardarLiga(ligaId, { colores: nuevos }))
    setGuardando(false)
    if (r) {
      avisar('Guardado. Es el reparto de siempre')
      setTocada(null)
      recargar?.()
    }
  }

  return (
    <section className="panel">
      <p className="panel-title">
        <Layers size={15} strokeWidth={2.6} />
        <span>El plan de las fichas</span>
      </p>

      {/* Con cuánto se entra. Se puede mover para ver cómo quedarían otras entradas sin
          tener que armar una partida de mentiras. */}
      {objetivoEditable && puedeEditar && (
        <MoneyInput
          label="Se entra con"
          value={objetivo}
          onChange={(v) => setOtraEntrada(Math.max(0, Math.round(v)))}
        />
      )}

      {objetivo <= 0 ? (
        <p className="m-0 text-[13px] leading-snug text-ink-soft">
          Pon con cuánto entra cada quien y aquí sale cómo repartir las fichas y para
          cuántos alcanzan.
        </p>
      ) : (
        <>
          <p className="m-0 mb-3 text-[13px] leading-snug text-ink-soft">
            {tocada && !yaGuardada ? (
              <>
                Así quedaría la mano del que entra con{' '}
                <b className="text-ink">{money(objetivo)}</b>. Todavía no está puesto: abajo lo
                guardas.
              </>
            ) : (
              <>
                Esto es lo que se le pone en la mano al que entra con{' '}
                <b className="text-ink">{money(objetivo)}</b>. Al que entre con otra cosa, la
                app se las reparte sola.
              </>
            )}
          </p>

          {vacia ? (
            <p className="m-0 mb-3 text-[13px] leading-snug text-ink-soft">
              No hay fichas puestas en la entrada, así que la app reparte sola según el dinero
              de cada quien.
              {puedeEditar && ' Abajo puedes armar el reparto de siempre.'}
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-paper-line bg-paper-soft px-2.5 py-3">
                <Pila fichas={pila} colores={colores} />
                <p className="mt-2.5 mb-0 flex items-center justify-center gap-1.5 border-t border-dashed border-paper-line pt-2 text-[12px] text-ink-soft">
                  Suman <b className="text-ink">{money(plan.total)}</b>
                  {plan.cuadra ? (
                    <Check size={13} strokeWidth={3} className="text-win" />
                  ) : (
                    <>
                      <span className="text-loss">· no es lo que pone cada quien</span>
                      <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
                    </>
                  )}
                </p>
              </div>

              {/* Hasta dónde aguanta la caja repartiendo así: la pregunta de la mesa. */}
              <div className="mt-3 rounded-xl bg-noche-linea px-3.5 py-3 text-paper">
                <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
                  Este reparto aguanta
                </span>
                {/* Las pilas se cuentan por lo que valen de verdad, no por lo que se
                    quería que valieran: mientras el reparto no cuadre, decir "pilas de
                    $500" cuando suman $400 es mentirle a quien está probando. */}
                <b className="font-display text-2xl">
                  {plan.entregas === Infinity ? '—' : plan.entregas} pilas de{' '}
                  {money(plan.total)}
                </b>
                {plan.seAcabaPrimero && (
                  <span className="mt-1 block text-[11.5px] leading-snug opacity-80">
                    Se acaban primero las{' '}
                    {(plan.seAcabaPrimero.label || 'fichas').toLowerCase()}: hay{' '}
                    {count(plan.seAcabaPrimero.inventory)} y cada pila lleva{' '}
                    {count(pila[plan.seAcabaPrimero.key])}.
                  </span>
                )}
                <span className="mt-1 block text-[11.5px] leading-snug opacity-80">
                  Son pilas, no jugadores: cada recompra se lleva otra.
                </span>
              </div>

              {/* Para cuántas se está haciendo la cuenta. */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="field-label block">Haz la cuenta para</span>
                  {deDonde && (
                    <span className="text-[12px] leading-snug text-ink-soft">{deDonde}</span>
                  )}
                </span>
                <Stepper
                  value={pilas}
                  onChange={(v) => setCuantas(Math.max(1, v))}
                  label="jugador"
                />
              </div>

              {plan.alcanza ? (
                <div className="balance balance-ok mt-3">
                  <Check size={16} strokeWidth={2.6} />
                  <span>
                    Alcanza para las {pilas}
                    {plan.masEntregas > 0 && plan.masEntregas !== Infinity
                      ? ` y sobran fichas para ${plan.masEntregas} más`
                      : ', justo'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="balance balance-off mt-3">
                    <AlertTriangle size={16} strokeWidth={2.4} />
                    <span>
                      Para {pilas} no alcanza: este reparto da {plan.entregas}
                    </span>
                  </div>

                  {faltaDinero ? (
                    <p className="m-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
                      Y no es cómo se reparten: {pilas} pilas de {money(objetivo)} son{' '}
                      <b className="text-ink">{money(objetivo * pilas)}</b> y en la caja hay{' '}
                      <b className="text-ink">{money(caja.total)}</b>. Para tantos hacen falta
                      más fichas, o entrar con menos.
                    </p>
                  ) : ajusteSirve ? (
                    <>
                      <p className="m-0 mb-2 text-[12.5px] leading-snug text-ink-soft">
                        Así sí alcanza para {pilas}, con las mismas fichas que hay:
                      </p>
                      <div className="rounded-xl border border-dashed border-marca/50 bg-[#fdf4f4] px-2.5 py-3">
                        <Pila fichas={ajuste.fichas} colores={colores} />
                      </div>
                      {puedeEditar && (
                        <button
                          type="button"
                          className="btn-dashed mt-2 flex items-center justify-center gap-1.5"
                          onClick={() => cambiar(ajuste.fichas)}
                        >
                          <Sparkles size={14} strokeWidth={2.6} />
                          Usar este reparto
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="m-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
                      Y moviendo el reparto tampoco cuadran los {money(objetivo)} exactos para{' '}
                      {pilas}. Habría que cambiarlo a mano, o repartirle a menos gente de una
                      vez y recoger fichas antes de las recompras.
                    </p>
                  )}
                </>
              )}

              {plan.alcanza && quedan.length > 0 && (
                <p className="m-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
                  Después de las {pilas} quedan{' '}
                  <b className="text-ink">{money(plan.sobraEnDinero)}</b> en la caja para las
                  recompras y el cambio: {enPalabras(plan.sobra, colores)}.
                </p>
              )}
            </>
          )}

          {puedeEditar && (
            <>
              {/*
               * La sugerencia va aquí arriba y no escondida en el editor: es el reparto que
               * la casa quiere casi siempre —toda la morralla y nada de fichas de $100—, y
               * se aprieta una vez al año. Al apretarlo se cambia la pila de arriba, así que
               * se ve aplicado en el momento en vez de leerlo descrito.
               */}
              {haySugerencia && (
                <button
                  type="button"
                  className="btn-dashed mb-2 flex items-center justify-center gap-1.5"
                  onClick={() => cambiar(sugerida.fichas)}
                >
                  <Sparkles size={14} strokeWidth={2.6} />
                  Repartirlas como sugiere la app
                </button>
              )}

              {tocada && !yaGuardada && (
                <>
                  <button
                    type="button"
                    className="btn btn-marca mb-2 disabled:opacity-45"
                    disabled={guardando || !plan.cuadra}
                    onClick={() => void guardar()}
                  >
                    {guardando ? 'Guardando…' : 'Que éste sea el reparto de siempre'}
                  </button>
                  <p className="mt-0 mb-3 text-[11.5px] leading-snug text-ink-soft">
                    Guardarlo lo deja puesto para esta noche y para las que vienen, y se les da
                    así a todos los que entren con {money(objetivo)}. A quien ya le hayas
                    corregido las fichas a mano no se le mueve nada.
                  </p>
                </>
              )}

              {/* Controlado, el editor arranca abierto: ahí el plan *es* el editor y
                  esconderlo detrás de un botón sería esconder para qué sirve la hoja. */}
              <button
                type="button"
                aria-expanded={abierto}
                className="btn-dashed flex items-center justify-center gap-1.5"
                onClick={() => setAbierto((a) => !a)}
              >
                <Pencil size={14} strokeWidth={2.6} />
                {abierto ? 'Listo' : 'Cambiar el reparto a mano'}
              </button>

              {abierto && (
                <div className="mt-3">
                  <ChipsGrid
                    colors={colores}
                    chips={pila}
                    showZero
                    onChange={(key, v) =>
                      cambiar({ ...pila, [key]: Math.max(0, Math.floor(v)) })
                    }
                  />
                  {controlado && (
                    <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft">
                      Lo que muevas aquí son las fichas de la entrada de siempre, y se guarda
                      con el botón de hasta abajo.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
