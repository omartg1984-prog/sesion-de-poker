import { AlertTriangle, Check, ChevronRight, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import Chip from '../../components/Chip'
import NumInput from '../../components/NumInput'
import ShareBlock from '../../components/ShareBlock'
import {
  CAMBIO_RECOMPRA,
  computeDistribution,
  dineroDeLaCaja,
  distributionText,
  type Distribution,
  type DistributionRow,
} from '../../lib/distribution'
import type { DatosTabla } from '../../lib/imagenTablas'
import { EPS, money, num } from '../../lib/money'
import { api, leerJson, type DetallePartida, type Participacion } from '../../lib/api'
import { conAviso } from '../../store/app'
import type { ChipColor, Chips } from '../../store/types'

/** Lo que cada pestaña necesita para trabajar. */
export interface PropsPestana {
  datos: DetallePartida
  colores: ChipColor[]
  puedeEditar: boolean
  /*
   * Contar las fichas del final lo puede hacer cualquiera de la mesa, no sólo un admin.
   * Es lo que hace rápido el cash out: cuatro contando en paralelo en vez de uno
   * tecleando lo de todos. El dinero —quién puso qué, a quién se le pagó— sigue
   * siendo de `puedeEditar`.
   */
  puedeContar: boolean
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

/*
 * ---- las fichas, concepto por concepto ----
 *
 * Una noche de cash no es una entrega de fichas por jugador: es la de la entrada y una
 * por cada recompra. Mientras todo iba en un solo montón, al apuntar una recompra de
 * $400 las fichas del jugador saltaban de golpe a las de $900 y nadie sabía cuántas
 * pasarle en ese momento: había que restar de cabeza sobre la mesa.
 *
 * Ahora cada concepto tiene su propio renglón con las fichas que le tocan a él solo,
 * que es exactamente lo que se le entrega en la mano.
 */

export interface Concepto {
  /** Cómo se guarda: 'entrada', 'r0', 'r1'… */
  clave: string
  rotulo: string
  monto: number
}

export const conceptosDe = (p: Participacion): Concepto[] => [
  { clave: 'entrada', rotulo: 'Entrada', monto: num(p.entrada) },
  ...recomprasDe(p).map((r, i) => ({
    clave: `r${i}`,
    rotulo: `Recompra ${i + 1}`,
    monto: num(r.dinero),
  })),
]

/** La fila del reparto que le corresponde a un concepto de alguien. */
export const idFila = (participacionId: string, clave: string) => `${participacionId}#${clave}`

/** De vuelta al jugador: las filas del reparto ya no son una por participación. */
export const participacionDeFila = (id: string) => id.split('#')[0]

/**
 * Los repartos hechos a mano, uno por concepto.
 *
 * Antes se guardaba un solo montón plano —{rojas: 4, verdes: 2}— para toda la noche.
 * Esas partidas siguen abiertas, así que ese formato se lee y se cuelga de la entrada,
 * que es donde estaba antes de que existieran las recompras por separado.
 */
export function manualesDe(p: Participacion): Record<string, Chips> {
  const crudo = leerJson<Record<string, unknown>>(p.fichas_manual, {})
  const claves = Object.keys(crudo)
  if (claves.length === 0) return {}
  const porConcepto = claves.every(
    (k) => crudo[k] !== null && typeof crudo[k] === 'object',
  )
  return porConcepto
    ? (crudo as Record<string, Chips>)
    : { entrada: crudo as unknown as Chips }
}

/**
 * Los conceptos de un torneo: el stack con el que arranca y una entrega por cada
 * recompra y cada add-on.
 *
 * En torneo todas las recompras valen lo mismo —lo dijo el que armó el torneo—, así
 * que no hace falta preguntar de cuánto fue cada una: basta con cuántas lleva.
 *
 * Los torneos de antes no traen fichas de recompra ni de add-on configuradas; ahí esas
 * entregas valen cero y no se pintan, que es lo mismo que hacía la app.
 */
export function conceptosDeTorneo(
  p: Participacion,
  stack: number,
  fichasRecompra: number,
  fichasAddOn: number,
): Concepto[] {
  const cuantos = (n: unknown) => Math.max(0, Math.floor(num(n)))
  return [
    { clave: 'entrada', rotulo: 'Fichas de entrada', monto: stack },
    ...Array.from({ length: cuantos(p.rebuys) }, (_, i) => ({
      clave: `r${i}`,
      rotulo: `Recompra ${i + 1}`,
      monto: fichasRecompra,
    })),
    ...Array.from({ length: cuantos(p.addons) }, (_, i) => ({
      clave: `a${i}`,
      rotulo: `Add-on ${i + 1}`,
      monto: fichasAddOn,
    })),
  ].filter((c) => c.clave === 'entrada' || c.monto > 0)
}

/**
 * El reparto de una noche, concepto por concepto: una fila por entrada y una por cada
 * recompra o add-on.
 *
 * El inventario se reparte entre todas las filas a la vez, no jugador por jugador: si
 * la caja se está acabando, las recompras compiten por las fichas igual que las
 * entradas.
 *
 * Sólo la entrada lleva pila de cambio completa. Lo que se entrega después lleva media
 * —`CAMBIO_RECOMPRA`—: el jugador ya tiene morralla en la mesa, pero tampoco puede
 * recibir un bloque de la ficha más grande y nada más.
 */
export function calcularRepartoPorConcepto(
  participaciones: Participacion[],
  colores: ChipColor[],
  conceptos: (p: Participacion) => Concepto[],
): Distribution {
  return computeDistribution(
    participaciones.flatMap((p) => {
      const manuales = manualesDe(p)
      return conceptos(p).map((c) => ({
        id: idFila(p.id, c.clave),
        name: c.clave === 'entrada' ? p.nombre : `${p.nombre} · ${c.rotulo}`,
        buyIn: Math.round(c.monto),
        deal: manuales[c.clave] ?? null,
        cambio: c.clave === 'entrada' ? 1 : CAMBIO_RECOMPRA,
      }))
    }),
    colores,
  )
}

export const calcularRepartoCash = (participaciones: Participacion[], colores: ChipColor[]) =>
  calcularRepartoPorConcepto(participaciones, colores, conceptosDe)

/**
 * Las fichas de un jugador, dentro de su tarjeta del registro.
 *
 * No es una pestaña aparte: el reparto se recalcula solo cuando cambian los montos o
 * quién juega, así que verlo junto al dinero que puso es donde tiene sentido.
 *
 * Llega plegado. Cinco casillas por jugador convierten el registro en un formulario
 * larguísimo, y casi nunca se tocan: el reparto sale bien solo. Plegado se ven las
 * fichas y sus cantidades en chiquito —que es lo que se mira para repartirlas— y al
 * abrirlo aparecen las casillas para corregir a mano.
 */
export function FichasDelJugador({
  fila,
  colores,
  puedeEditar,
  guardar,
  /* Qué fichas son éstas. En cash hay un renglón por concepto y hace falta decir de
     cuál: 'Entrada', 'Recompra 1'… */
  rotulo = 'Fichas',
  /* En cash las fichas son pesos y se escriben con signo; en torneo son puntos y
     escribirlas con signo de pesos es justo la confusión que hay que evitar. */
  formato = money,
}: {
  fila: DistributionRow
  colores: ChipColor[]
  puedeEditar: boolean
  /** `null` devuelve este renglón al reparto automático. */
  guardar: (fichas: Chips | null) => void
  rotulo?: string
  formato?: (n: number) => string
}) {
  const [abierto, setAbierto] = useState(false)
  const cuadra = Math.abs(fila.leftover) < EPS

  return (
    <div className="mt-3 border-t border-dashed border-paper-line pt-2.5">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
      >
        <span className="field-label shrink-0">{rotulo}</span>

        {/*
         * Plegado: la fila de fichas con su cantidad, que es lo que se mira al
         * repartirlas sobre la mesa.
         *
         * Va en rejilla de tantas columnas como colores haya, no en fila con huecos:
         * así se reparten a todo lo ancho y, si algún día la liga mete más colores,
         * siguen cabiendo en el mismo renglón en vez de salirse o irse abajo.
         */}
        <span
          className="grid min-w-0 flex-1 items-center gap-1"
          style={{ gridTemplateColumns: `repeat(${colores.length}, minmax(0, 1fr))` }}
        >
          {/* La ficha arriba y el número abajo, no lado a lado: así el número se queda
              con todo el ancho de su celda y no se corta cuando hay muchos colores. */}
          {colores.map((c) => (
            <span key={c.key} className="flex min-w-0 flex-col items-center">
              <Chip color={c} size={colores.length > 7 ? 15 : 18} />
              <b className="font-display text-[12px] leading-tight tabular-nums text-ink">
                {fila.counts[c.key] ?? 0}
              </b>
            </span>
          ))}
        </span>

        <ChevronRight
          size={15}
          strokeWidth={2.6}
          className={`shrink-0 text-ink-soft/50 transition-transform ${abierto ? 'rotate-90' : ''}`}
        />
      </button>

      {abierto && (
        <>
          {fila.manual && puedeEditar && (
            <button
              type="button"
              onClick={() => guardar(null)}
              className="mt-2 flex cursor-pointer items-center gap-1 rounded-full border-none bg-marca/20 px-2 py-0.5 text-[10px] font-bold text-marca-tinta active:scale-95"
            >
              <RotateCcw size={10} strokeWidth={3} />
              Volver al reparto automático
            </button>
          )}

          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(54px,1fr))] gap-1.5">
            {colores.map((c) => (
              <label key={c.key} className="flex flex-col items-center gap-1">
                <Chip color={c} size={26} />
                {/* Sin el valor dentro de la ficha, el nombre es lo único que
                    distingue una columna de otra. */}
                <span className="w-full truncate text-center text-[10px] font-semibold text-ink-soft">
                  {c.label}
                </span>
                <NumInput
                  value={fila.counts[c.key] ?? 0}
                  showZero
                  aria-label={`Fichas ${c.label} para ${fila.name}`}
                  className="w-full rounded-lg border border-paper-line bg-white px-0.5 py-1.5 text-center text-[14px] font-semibold outline-none focus:border-marca"
                  onChange={(v) => {
                    if (!puedeEditar) return
                    guardar({ ...fila.counts, [c.key]: v })
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}

      {/* El total se queda siempre a la vista, abierto o cerrado: es lo que dice si
          las fichas cubren lo que puso. */}
      <p className="mt-2 mb-0 flex items-center gap-1.5 text-xs text-ink-soft">
        En fichas: <b className="text-ink">{formato(fila.total)}</b>
        {cuadra ? (
          <Check size={13} strokeWidth={3} className="text-win" />
        ) : (
          <>
            <span>
              ·{' '}
              {fila.leftover > 0
                ? `faltan ${formato(fila.leftover)}`
                : `se pasa ${formato(-fila.leftover)}`}
            </span>
            <AlertTriangle size={13} strokeWidth={2.6} className="text-loss" />
          </>
        )}
      </p>
    </div>
  )
}

/**
 * El botón de "ya conté las de éste".
 *
 * Las cantidades se guardan solas mientras se teclean, pero eso en la mesa no se ve:
 * quien cuenta no sabe si lo que escribió ya salió de su teléfono, y con cuatro
 * personas contando a la vez esa duda cuesta tiempo. Este botón lo manda en el
 * momento y lo dice.
 *
 * No congela nada: si el conteo quedó mal se sigue corrigiendo, el botón vuelve a
 * ponerse en "guardar" y se aprieta otra vez.
 */
export function GuardarConteo({
  id,
  fichas,
  contado,
  deshabilitado,
}: {
  id: string
  fichas: Chips
  contado: boolean
  deshabilitado?: boolean
}) {
  const actual = JSON.stringify(fichas)
  /* Lo que ya estaba al abrir la pantalla vino del servidor: eso ya está guardado. */
  const [guardado, setGuardado] = useState(actual)
  const [guardando, setGuardando] = useState(false)
  const alDia = guardado === actual

  if (deshabilitado) return null
  if (alDia && !contado) return null

  if (alDia)
    return (
      <p className="mt-2.5 mb-0 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-win-tinta">
        <Check size={13} strokeWidth={3} />
        Conteo guardado
      </p>
    )

  return (
    <button
      type="button"
      className="btn btn-marca mt-2.5 disabled:opacity-45"
      disabled={guardando}
      onClick={async () => {
        setGuardando(true)
        const r = await conAviso(() => api.guardarParticipacion(id, { fichasFinal: fichas }))
        setGuardando(false)
        if (r) setGuardado(actual)
      }}
    >
      <Save size={16} strokeWidth={2.5} />
      {guardando ? 'Guardando…' : 'Guardar conteo'}
    </button>
  )
}

/** Cuántas fichas de cada color se están usando contra las que tiene la casa. */
/**
 * Quiénes van y con cuánto, de un vistazo y antes de la lista larga.
 *
 * Mientras se registra hay que bajar por las tarjetas de cada quien para saber quién
 * está y cuánto lleva puesto; con veinte jugadores eso es todo el scroll. Aquí arriba
 * cabe la mesa entera en dos columnas.
 */
export function ListaDeLaMesa({
  filas,
  rotulo = 'Quiénes van',
}: {
  filas: { id: string; nombre: string; monto: number }[]
  rotulo?: string
}) {
  if (filas.length === 0) return null
  const total = filas.reduce((t, f) => t + f.monto, 0)

  return (
    <section className="panel">
      <p className="panel-title">
        <span>{rotulo}</span>
      </p>

      {/* Sin rayitas entre renglones: en dos columnas, una mesa impar deja al último
          solo en su fila y la línea queda cortada a la mitad. El espacio separa igual. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-0.5 p-0">
        {filas.map((f) => (
          <li key={f.id} className="flex items-baseline justify-between gap-1.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-ink">{f.nombre}</span>
            <b className="shrink-0 font-display text-[15px] tabular-nums text-ink">
              {money(f.monto)}
            </b>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 mb-0 flex items-baseline justify-between border-t border-paper-line pt-2 text-[12px] text-ink-soft">
        <span>
          {filas.length} {filas.length === 1 ? 'jugador' : 'jugadores'}
        </span>
        <b className="font-display text-[17px] tabular-nums text-ink">{money(total)}</b>
      </p>
    </section>
  )
}

export function InventarioUsado({
  reparto,
  colores,
  /* En torneo las fichas son puntos: multiplicarlas por su valor en dinero no
     significa nada, así que la cuenta en pesos sólo sale en cash. */
  enDinero = false,
}: {
  reparto: Distribution
  colores: ChipColor[]
  enDinero?: boolean
}) {
  const caja = dineroDeLaCaja(colores, reparto)
  return (
    <section className="panel">
      <p className="panel-title">
        <span>Fichas en uso</span>
      </p>

      {enDinero && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-paper-line bg-paper-soft px-2 py-2.5 text-center">
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">En la caja</div>
            <b className="font-display text-[17px] text-ink tabular-nums">{money(caja.total)}</b>
          </div>
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">Repartido</div>
            <b className="font-display text-[17px] text-ink tabular-nums">
              {money(caja.repartido)}
            </b>
          </div>
          <div>
            <div className="text-[9.5px] tracking-[.5px] text-ink-soft uppercase">Queda</div>
            <b
              className={`font-display text-[17px] tabular-nums ${
                caja.queda < 0 ? 'text-loss' : 'text-win'
              }`}
            >
              {money(caja.queda)}
            </b>
          </div>
        </div>
      )}
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
  )
}

/**
 * El reparto de fichas, para mandarlo al chat.
 *
 * Sirve para que cada quien vea las suyas antes de sentarse y para que después nadie
 * discuta con cuántas arrancó.
 */
export function CompartirReparto({
  reparto,
  colores,
  datos,
}: {
  reparto: Distribution
  colores: ChipColor[]
  datos: DetallePartida
}) {
  const tabla: DatosTabla = {
    tipo: 'tabla',
    titulo: 'Reparto de fichas',
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    gorro: datos.liga.nombre,
    columnas: ['Jugador', ...colores.map((c) => c.label), 'Total'],
    filas: reparto.rows.map((r) => [
      r.name,
      ...colores.map((c) => String(r.counts[c.key] ?? 0)),
      Math.round(r.total).toLocaleString('es-MX'),
    ]),
    /* Las filas ya no son una por jugador: en cash hay una por entrada y una por cada
       recompra, y todas llevan la foto del mismo. */
    fotos: reparto.rows.map(
      (r) =>
        datos.participaciones.find((p) => p.id === participacionDeFila(r.id))?.foto ?? null,
    ),
    pie: `${datos.participaciones.length} jugadores`,
  }

  return (
    <ShareBlock
      datos={tabla}
      texto={() => distributionText(reparto, colores, money)}
      alt="Reparto de fichas"
    />
  )
}
