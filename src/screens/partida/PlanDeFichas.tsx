import { AlertTriangle, Check, Layers, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import Chip from '../../components/Chip'
import ChipsGrid from '../../components/ChipsGrid'
import Stepper from '../../components/Stepper'
import { dineroDeLaCaja } from '../../lib/distribution'
import { count, money } from '../../lib/money'
import {
  armarEntrada,
  cuantasAguanta,
  entradaDeArranque,
  entradaSugerida,
  loQueQueda,
  planDeFichas,
  type Topes,
} from '../../lib/plan-fichas'
import { repartoDeLaCasa } from '../../lib/reparto-de-la-casa'
import type { ChipColor, Chips } from '../../store/types'

/*
 * El plan de las fichas de la noche.
 *
 * Antes la app repartía sola y el reparto no se veía hasta que ya estaba hecho, dentro
 * de la tarjeta de cada jugador. Con cinco colores y seis en la mesa eso alcanzaba. Con
 * fichas de $50 y de $100 y veinte apuntados, no: lo que se pregunta en la mesa antes de
 * empezar es "¿cómo las repartimos y para cuántos alcanza?", y eso no se contesta
 * bajando por veinte tarjetas.
 *
 * Vive dentro de cada partida y no en la configuración de la liga porque el número de
 * jugadores cambia cada viernes, y el reparto con él: el mismo puñado que sobra para
 * ocho no alcanza para dieciocho. Lo que se decida aquí se puede dejar guardado para las
 * noches que vienen, pero se decide aquí, con la gente ya apuntada.
 */

const mismas = (a: Chips, b: Chips, colores: ChipColor[]) =>
  colores.every((c) => count(a[c.key]) === count(b[c.key]))

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
  objetivo,
  pilas: pilasBase,
  deDonde,
  repartidas,
  puedeEditar,
  onGuardar,
}: {
  colores: ChipColor[]
  /** Con cuánto entra la mayoría: lo que tienen que sumar las fichas de la pila. */
  objetivo: number
  /** Para cuántas pilas arranca la cuenta. */
  pilas: number
  /** De dónde sale ese número, en una línea: "Hoy van 14 apuntados". */
  deDonde?: string
  /** Lo que ya salió de la caja esta noche, color por color. */
  repartidas: Chips
  puedeEditar: boolean
  /** Deja este reparto puesto y se lo da a todos los apuntados. */
  onGuardar: (fichas: Chips) => Promise<boolean>
}) {
  /** La pila que se está probando. `null` = la que la app va a repartir. */
  const [tocada, setTocada] = useState<Chips | null>(null)
  /** Para cuántas pilas se está haciendo la cuenta. `null` = las de hoy. */
  const [cuantas, setCuantas] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  if (colores.length === 0 || objetivo <= 0) return null

  const arranque = entradaDeArranque(colores, objetivo)
  const pila = tocada ?? arranque.fichas
  /* Siempre al menos una: la cuenta de "aguanta para cero" no le sirve a nadie. */
  const pilas = Math.max(1, cuantas ?? pilasBase)
  const plan = planDeFichas(colores, objetivo, pila, pilas)
  const caja = dineroDeLaCaja(colores)

  /* Lo que la liga ya tiene puesto, para no ofrecer guardar lo que ya está guardado. */
  const casa = repartoDeLaCasa(colores)
  const yaPuesto =
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

  /*
   * Lo que queda en la caja.
   *
   * Con la cuenta puesta en los de hoy es lo que hay de verdad: el inventario menos lo
   * que ya salió, apuntado jugador por jugador. Pero el contador de arriba está para
   * preguntarse "¿y si llegan cuatro más?", y entonces esto tiene que moverse con él:
   * quedarse quieto es contestar otra pregunta. Cada pila de más se lleva su puñado;
   * cada una de menos lo devuelve.
   */
  const demas = pilas - Math.max(0, pilasBase)
  const salidas: Chips = {}
  for (const c of colores)
    salidas[c.key] = Math.max(0, count(repartidas[c.key]) + demas * count(pila[c.key]))
  const resto = loQueQueda(colores, salidas)
  const paraRecompras = cuantasAguanta(resto.colores, pila)
  /** La cuenta no va en los de hoy: lo de abajo es un "y si", no lo que hay. */
  const suponiendo = demas !== 0

  const guardar = async () => {
    setGuardando(true)
    const ok = await onGuardar(pila)
    setGuardando(false)
    if (ok) setTocada(null)
  }

  return (
    <section className="panel">
      <p className="panel-title">
        <Layers size={15} strokeWidth={2.6} />
        <span>El plan de las fichas</span>
      </p>

      <p className="m-0 mb-3 text-[13px] leading-snug text-ink-soft">
        {yaPuesto ? (
          <>
            Esto es lo que se le pone en la mano al que entra con{' '}
            <b className="text-ink">{money(objetivo)}</b>. Al que entre con otra cosa, la app se
            las reparte sola.
          </>
        ) : (
          <>
            Así propongo repartirle las fichas al que entra con{' '}
            <b className="text-ink">{money(objetivo)}</b>. Muévelo a tu gusto y déjalo puesto
            con el botón que está ahí mismo.
          </>
        )}
      </p>

      {/* La pila. Al que puede editar se le dan las casillas en vez del dibujo: es el
          mismo renglón de fichas, pero para moverlo. */}
      <div className="rounded-xl border border-paper-line bg-paper-soft px-2.5 py-3">
        {puedeEditar ? (
          <ChipsGrid
            colors={colores}
            chips={pila}
            showZero
            onChange={(key, v) => setTocada({ ...pila, [key]: Math.max(0, Math.floor(v)) })}
          />
        ) : (
          <Pila fichas={pila} colores={colores} />
        )}
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

        {/*
         * Los botones van aquí dentro, pegados a las casillas.
         *
         * Afuera del recuadro quedaban a un renglón de distancia de lo que acabas de
         * mover, y en un teléfono eso basta para no verlos: se mueve una ficha, se mira
         * el total, y el botón que deja el cambio puesto estaba fuera del cuadro que
         * estabas mirando. Dentro, lo que mueves y lo que lo guarda son la misma cosa.
         */}
        {puedeEditar && (
          <div className="mt-3 border-t border-dashed border-paper-line pt-3">
            {/*
             * El botón está siempre, aunque el reparto sea el que ya estaba guardado.
             * Escondiéndolo cuando no había cambiado, quien quería volver a repartirle a
             * todos —porque alguien tenía fichas corregidas, o porque se apuntó más
             * gente— se quedaba sin botón y sin saber por qué.
             */}
            <button
              type="button"
              className="btn btn-marca disabled:opacity-45"
              disabled={guardando || !plan.cuadra || vacia}
              onClick={() => void guardar()}
            >
              {guardando
                ? 'Guardando…'
                : yaPuesto
                  ? 'Dárselo así a todos'
                  : 'Dejarlo así y dárselo a todos'}
            </button>

            <div className="mt-2 flex flex-wrap gap-2">
              {/*
               * La sugerencia es el reparto que la casa quiere casi siempre —toda la
               * morralla y nada de fichas de $100—, así que se ofrece sola en vez de
               * esconderse. Apretarla mueve las casillas de arriba: se ve aplicada, no
               * descrita.
               */}
              {haySugerencia && (
                <button
                  type="button"
                  className="btn-dashed flex flex-1 items-center justify-center gap-1.5"
                  onClick={() => setTocada(sugerida.fichas)}
                >
                  <Sparkles size={14} strokeWidth={2.6} />
                  Como sugiere la app
                </button>
              )}

              {/* La salida para el dedo chueco: si se movió una casilla sin querer, hay
                  cómo volver a lo que estaba sin acordarse de los números. */}
              {tocada && casa && Math.abs(casa.total - objetivo) < 1e-9 && (
                <button
                  type="button"
                  className="btn-dashed flex flex-1 items-center justify-center gap-1.5"
                  onClick={() => setTocada(null)}
                >
                  <RotateCcw size={14} strokeWidth={2.6} />
                  Dejarlo como estaba
                </button>
              )}
            </div>

            <p className="mt-2 mb-0 text-[11.5px] leading-snug text-ink-soft">
              Se les da a todos los apuntados que entraron con {money(objetivo)} —aunque ya
              les hubieras corregido las fichas a mano— y queda puesto para las noches que
              vienen. Después puedes volver a corregirle a quien quieras.
            </p>
          </div>
        )}
      </div>

      {vacia ? (
        <p className="mt-3 mb-0 text-[13px] leading-snug text-ink-soft">
          Sin fichas en la entrada la app reparte sola, según el dinero de cada quien.
        </p>
      ) : (
        <>
          {/* Hasta dónde aguanta la caja repartiendo así: la pregunta de la mesa. */}
          <div className="mt-3 rounded-xl bg-noche-linea px-3.5 py-3 text-paper">
            <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
              Este reparto aguanta
            </span>
            {/* Las pilas se cuentan por lo que valen de verdad y no por lo que se quería
                que valieran: con un reparto a medias, decir "pilas de $500" cuando suman
                $400 es mentirle a quien está probando. */}
            <b className="font-display text-2xl">
              {plan.entregas === Infinity ? '—' : plan.entregas} pilas de {money(plan.total)}
            </b>
            {plan.seAcabaPrimero && (
              <span className="mt-1 block text-[11.5px] leading-snug opacity-80">
                Se acaban primero las {(plan.seAcabaPrimero.label || 'fichas').toLowerCase()}:
                hay {count(plan.seAcabaPrimero.inventory)} y cada pila lleva{' '}
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
            <Stepper value={pilas} onChange={(v) => setCuantas(Math.max(1, v))} label="jugador" />
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
                  <b className="text-ink">{money(caja.total)}</b>. Para tantos hacen falta más
                  fichas, o entrar con menos.
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
                      onClick={() => setTocada(ajuste.fichas)}
                    >
                      <Sparkles size={14} strokeWidth={2.6} />
                      Usar este reparto
                    </button>
                  )}
                </>
              ) : (
                <p className="m-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
                  Y moviendo el reparto tampoco cuadran los {money(objetivo)} exactos para{' '}
                  {pilas}. Habría que cambiarlo a mano, o repartirle a menos gente de una vez y
                  recoger fichas antes de las recompras.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/*
       * La feria que queda, color por color.
       *
       * Es la cuenta de media noche: alguien pide una recompra y hay que saber con qué
       * armársela. En pesos no basta —puede haber $3,000 en la caja y ni una ficha chica
       * para dar cambio—, así que va una por una, y baja sola conforme se van apuntando
       * las entradas y las recompras.
       */}
      <div className="mt-3 border-t border-dashed border-paper-line pt-3">
        {/* El título dice de cuál de las dos cuentas se trata: lo que hay, o lo que
            quedaría si le repartes a los que estás contando arriba. */}
        <p className="field-label mb-1">
          {suponiendo
            ? `Quedaría en la caja con ${pilas} ${pilas === 1 ? 'pila' : 'pilas'}`
            : 'Queda en la caja'}
        </p>

        {/*
         * Un solo renglón, el mismo de las fichas que faltan en el cash out: la ficha y
         * cuántas quedan, nada más. Un renglón por color con nombre y pesos era una lista
         * tan larga como la mesa, y para armar una recompra no se lee: se ve.
         *
         * Reparte el hueco que sobra en vez de llevar separación fija, y si la caja está
         * llena —tres dígitos en los siete colores— se recorre de lado como el del cash
         * out. Lo que no hace es partirse en dos renglones: eso ya era otra lista.
         */}
        <div className="no-scrollbar flex items-center justify-between gap-x-2 overflow-x-auto rounded-lg bg-paper-soft px-2.5 py-2">
          {colores.map((c) => {
            const quedan = count(resto.fichas[c.key])
            return (
              <span
                key={c.key}
                className={`flex shrink-0 items-center gap-1 ${quedan === 0 ? 'opacity-35' : ''}`}
                title={c.label}
              >
                <Chip color={c} size={18} />
                <b className="font-display text-[14px] tabular-nums text-ink">{quedan}</b>
              </span>
            )
          })}
        </div>

        <p className="mt-2.5 mb-0 text-[12.5px] leading-snug text-ink-soft">
          <b className="text-ink">{money(resto.dinero)}</b> en fichas
          {!vacia && plan.cuadra && (
            <>
              {' · '}
              {paraRecompras.entregas > 0
                ? `alcanzan para ${paraRecompras.entregas} ${
                    paraRecompras.entregas === 1 ? 'recompra' : 'recompras'
                  } de ${money(plan.total)}`
                : 'ya no alcanzan para otra pila completa'}
              {paraRecompras.entregas > 0 && paraRecompras.seAcabaPrimero && (
                <>
                  , y las primeras que se van a acabar son las{' '}
                  {(paraRecompras.seAcabaPrimero.label || 'fichas').toLowerCase()}
                </>
              )}
            </>
          )}
        </p>
      </div>
    </section>
  )
}
