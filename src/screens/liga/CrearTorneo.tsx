import { ArrowLeft, ArrowRight, Check, Coins, Share2, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { AvatarEditable } from '../../components/Avatar'
import { linkDePartida } from '../../components/Invitacion'
import { compartirTextoNativo, esNativo } from '../../lib/nativo'
import { copyText } from '../../lib/portapapeles'
import Chip from '../../components/Chip'
import MoneyInput from '../../components/MoneyInput'
import NumInput from '../../components/NumInput'
import SelectorJugador from '../../components/SelectorJugador'
import ShareBlock from '../../components/ShareBlock'
import { api, type ConfigTorneo, type Miembro } from '../../lib/api'
import { computeDistribution } from '../../lib/distribution'
import type { DatosTabla } from '../../lib/imagenTablas'
import { money, num } from '../../lib/money'
import {
  calcularEstructura,
  coloresDelTorneo,
  fichasPorPrecio,
  horaMas,
  minutosEntre,
  planFichas,
  stackSugerido,
  tramosDe,
  type Estructura as Tabla,
  type Tramo,
  type ValoresTorneo,
} from '../../lib/torneo'
import { resumenDeTorneo, tablaDeReglas } from '../../lib/resumenTorneo'
import TablaCiegas from '../partida/TablaCiegas'
import Premios, { premiosCuadran, type Premio } from './Premios'
import { conAviso, useApp } from '../../store/app'
import type { ChipColor } from '../../store/types'

/*
 * Armar un torneo, en orden.
 *
 * El orden importa porque cada cosa depende de la anterior: cuántos son decide cuántas
 * fichas hay por cabeza, lo que cuesta la entrada decide lo que dan la recompra y el
 * add-on, y las horas deciden cuántos niveles caben. Por eso no es un formulario largo
 * sino unos pasos, y el último es un plan ya calculado que se acepta o se corrige.
 *
 * Del dinero manda la mesa; de las fichas manda la app. Los puntos no salen más baratos
 * por recomprar: dan lo mismo por peso que la entrada.
 */

const PASOS = ['Quiénes', 'Costo', 'Tiempo', 'El plan']
const NIVELES = [10, 15, 20, 30]
const CADA_CUANTOS = [0, 3, 4, 6]
const DURACION_DESCANSO = [10, 15, 20, 30]

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * El instante exacto de una fecha más una hora del reloj de aquí.
 *
 * Se resuelve en el teléfono porque es donde se sabe la zona horaria; el servidor sólo
 * compara instantes. Guardar un "20:00" suelto cerraría el registro seis horas antes.
 */
function instanteDe(fecha: string, hora: string): string | null {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  if (![a, m, d, h, min].every(Number.isFinite)) return null
  return new Date(a, m - 1, d, h, min).toISOString()
}

/** "dom 13 de sep", que es como se habla de una fecha, no "2026-09-13". */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const miles = (n: number) => Math.round(n).toLocaleString('es-MX')

function Opciones({
  valor,
  opciones,
  etiqueta,
  onElegir,
}: {
  valor: number
  opciones: number[]
  etiqueta?: (o: number) => string
  onElegir: (v: number) => void
}) {
  return (
    <div className="flex gap-1.5">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onElegir(o)}
          className={`flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[13px] font-bold transition-colors ${
            valor === o ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
          }`}
        >
          {etiqueta ? etiqueta(o) : o}
        </button>
      ))}
    </div>
  )
}

interface Props {
  ligaId: string
  nombreLiga: string
  /** Para armar el link con el que cada quien se apunta solo. */
  codigoLiga: string
  /** Quién está creando el torneo: es el jefe de la noche salvo que digan otra cosa. */
  yoId: string
  miembros: Miembro[]
  colores: ChipColor[]
  /** La partida ya existe: hay que refrescar la lista de la liga. */
  onCreada: () => void
  onIrAlTorneo: (partidaId: string) => void
}

export default function CrearTorneo({
  ligaId,
  nombreLiga,
  codigoLiga,
  yoId,
  miembros,
  colores,
  onCreada,
  onIrAlTorneo,
}: Props) {
  const avisar = useApp((s) => s.avisar)

  const [paso, setPaso] = useState(1)
  const [ocupado, setOcupado] = useState(false)
  const [creada, setCreada] = useState<string | null>(null)

  const [fecha, setFecha] = useState(hoy())
  const [nombre, setNombre] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  /*
   * Para cuántos se arma el torneo cuando todavía no hay nadie marcado.
   *
   * Se puede crear el torneo vacío y mandar el link, como en cash, pero las fichas no
   * se pueden repartir entre nadie: de cuántos sean dependen los valores, el stack y
   * cuánto alcanza la caja. Así que se pregunta, y si luego llegan más o menos, el
   * plan se vuelve a calcular desde la partida.
   */
  const [esperados, setEsperados] = useState(8)
  /* Quién funge de banco esa noche. */
  const [jefe, setJefe] = useState(yoId)

  const [buyIn, setBuyIn] = useState(500)
  const [rebuyPrice, setRebuyPrice] = useState(400)
  const [addOnPrice, setAddOnPrice] = useState(300)
  const [recomprasEsperadas, setRecomprasEsperadas] = useState(0)
  const [addOnsEsperados, setAddOnsEsperados] = useState(0)
  /* La cara de la noche. Se elige aquí porque es cuando se tiene a la mano el cartel
     que alguien hizo para el grupo; después se puede cambiar desde la partida. */
  const [foto, setFoto] = useState<string | null>(null)
  /* Lo que sale de la bolsa para la cena. Se puede dejar en 0 y ponerlo a media noche,
     cuando llega la cuenta, desde la pestaña de resultado. */
  const [cenaPorPersona, setCenaPorPersona] = useState(0)
  /* Hasta qué nivel se puede comprar. 0 = toda la noche. */
  const [recomprasHasta, setRecomprasHasta] = useState(0)
  const [addOnsHasta, setAddOnsHasta] = useState(0)

  const [horaInicio, setHoraInicio] = useState('20:00')
  const [horaFin, setHoraFin] = useState('01:00')
  const [porNivel, setPorNivel] = useState(15)
  const [cadaNiveles, setCadaNiveles] = useState(4)
  const [minDescanso, setMinDescanso] = useState(20)

  /* Lo que el plan propone se guarda como `null`: así sigue moviéndose con todo lo
     demás hasta que alguien lo toca a mano a propósito. */
  const [stackManual, setStackManual] = useState<number | null>(null)
  const [valoresManual, setValoresManual] = useState<ValoresTorneo | null>(null)
  const [tablaManual, setTablaManual] = useState<Tabla | null>(null)
  const [payouts, setPayouts] = useState<Premio[]>([{ pct: 50 }, { pct: 30 }, { pct: 20 }])

  /* ---- todo lo que se recalcula solo ---- */

  const jugadores = elegidos.length
  /* Con gente marcada manda la mesa de verdad; sin nadie, lo que se calcula. */
  const paraCalcular = Math.max(2, jugadores || esperados)
  const stack = stackManual ?? stackSugerido(buyIn)

  const plan = planFichas({
    colores,
    jugadores: paraCalcular,
    stack,
    fichasRecompra: fichasPorPrecio(rebuyPrice, buyIn, stack),
    fichasAddOn: fichasPorPrecio(addOnPrice, buyIn, stack),
    recomprasEsperadas,
    addOnsEsperados,
  })
  const valores = valoresManual ?? plan.valores
  const fichaMasChica = Math.min(...Object.values(valores))
  const fichasRecompra = fichasPorPrecio(rebuyPrice, buyIn, stack, fichaMasChica)
  const fichasAddOn = fichasPorPrecio(addOnPrice, buyIn, stack, fichaMasChica)
  const coloresTorneo = coloresDelTorneo(colores, valores)

  const minutos = minutosEntre(horaInicio, horaFin)
  const automatica = calcularEstructura({
    jugadores: paraCalcular,
    stackInicial: stack,
    fichaMasChica,
    minutosDeseados: minutos,
    minutosPorNivel: porNivel,
    descanso: cadaNiveles > 0 ? { cadaNiveles, minutos: minDescanso } : null,
  })
  const estructura = tablaManual ?? automatica

  /* Sin nadie marcado se reparte entre los que se calculan: el plan tiene que enseñar
     con cuántas fichas arranca cada quien, no un montón de ceros. */
  const paraRepartir =
    jugadores > 0
      ? elegidos.map((id) => ({
          id,
          name: miembros.find((m) => m.id === id)?.nombre ?? '',
          buyIn: stack,
          deal: null,
        }))
      : Array.from({ length: paraCalcular }, (_, i) => ({
          id: `sitio${i}`,
          name: `Jugador ${i + 1}`,
          buyIn: stack,
          deal: null,
        }))
  const reparto = computeDistribution(paraRepartir, coloresTorneo)

  const bolsa =
    paraCalcular * num(buyIn) +
    recomprasEsperadas * num(rebuyPrice) +
    addOnsEsperados * num(addOnPrice) -
    paraCalcular * num(cenaPorPersona)

  /* Mover el stack tira los valores y la tabla hechos a mano: se calcularon con otro
     número y dejarían un plan que no cierra. */
  const cambiarStack = (v: number) => {
    setStackManual(v)
    setValoresManual(null)
    setTablaManual(null)
  }

  /** Cualquier cosa del tiempo rehace la escalera de ciegas. */
  const cambiarTiempo =
    <T,>(poner: (v: T) => void) =>
    (v: T) => {
      poner(v)
      setTablaManual(null)
    }

  /* Todo lo que define el torneo, en un solo objeto: es lo que se guarda y también lo
     que lee la imagen de reglas, para que las dos digan exactamente lo mismo. */
  const torneoArmado: ConfigTorneo = {
    buyIn,
    rebuyPrice,
    addOnPrice,
    payouts,
    stack,
    rebuyChips: fichasRecompra,
    addOnChips: fichasAddOn,
    valores,
    recomprasEsperadas,
    addOnsEsperados,
    recomprasHasta,
    addOnsHasta,
    cenaPorPersona,
    horaInicio,
    horaFin,
  }

  /* ---- crear ---- */

  const crear = async () => {
    if (ocupado) return
    setOcupado(true)
    const torneo = torneoArmado
    const r = await conAviso(() =>
      api.crearPartida(ligaId, {
        fecha,
        nombre: nombre.trim() || undefined,
        tipo: 'torneo',
        torneo,
        jefeId: jefe,
        foto,
        /* La hora a la que se quedó es también hasta cuándo se apunta uno solo. */
        registroHasta: instanteDe(fecha, horaInicio),
      }),
    )
    if (!r) {
      setOcupado(false)
      return
    }
    const id = r.partida.id
    /* Los jugadores y la escalera van en la misma tanda: el torneo tiene que quedar
       listo para arrancar, no a medio armar. */
    /* Un torneo puede nacer vacío: se manda el link y cada quien se apunta. */
    if (elegidos.length > 0)
      await conAviso(() =>
        api.cargarJugadores(
          id,
          elegidos.map((usuarioId) => ({ usuarioId, entrada: buyIn })),
        ),
      )
    await conAviso(() => api.guardarPartida(id, { estructura }))
    setOcupado(false)
    setCreada(id)
    setPaso(5)
    onCreada()
    avisar('Torneo listo')
  }

  /*
   * El link para que cada quien se apunte solo, igual que en cash.
   *
   * Es lo que hace que un torneo se pueda armar sin perseguir a nadie: se manda al
   * grupo y la lista se llena sola hasta la hora de arranque. Al abrirlo sale de qué
   * consta el torneo y hay que aceptarlo para entrar.
   */
  const compartirLink = async () => {
    if (!creada) return
    const link = linkDePartida(creada, codigoLiga)
    const cuando = nombre.trim() || fechaLarga(fecha)
    const texto = `🏆 Torneo en ${nombreLiga} — ${cuando}\nEmpieza ${horaInicio} · entrada ${money(buyIn)}\nApúntate aquí:\n${link}`
    try {
      if (esNativo()) {
        await compartirTextoNativo(texto, 'Invitación al torneo')
        return
      }
      if (navigator.share) {
        await navigator.share({ title: cuando, text: texto })
        return
      }
    } catch {
      /* si cancela o el teléfono no deja, queda el portapapeles */
    }
    avisar((await copyText(texto)) ? 'Link copiado' : 'No se pudo copiar')
  }

  /* Las reglas en texto, para quien prefiere pegarlas que mandar la imagen. */
  const textoReglas = () => {
    const r = resumenDeTorneo(torneoArmado)
    const lineas = [`🏆 ${nombreLiga} — ${nombre.trim() || fechaLarga(fecha)}`, '']
    for (const c of r.compras)
      lineas.push(
        `${c.que}: ${money(c.dinero)} → ${miles(c.fichas)} fichas${c.hasta ? ` (${c.hasta})` : ''}`,
      )
    if (r.cenaPorPersona > 0)
      lineas.push(`Cena: ${money(r.cenaPorPersona)} por persona, sale de la bolsa`)
    lineas.push('', 'Se reparte:')
    for (const pr of r.premios) lineas.push(`  ${pr.lugar}º · ${pr.pct}%`)
    lineas.push('', `Empieza ${horaInicio}`)
    return lineas.join('\n')
  }

  /* ---- lo que se comparte ---- */

  const filaDe = (t: Tramo) =>
    t.tipo === 'descanso'
      ? ['Descanso', `${t.minutos} min`, horaMas(horaInicio, t.desdeMinuto)]
      : [
          `Nivel ${t.nivel.nivel}`,
          `${miles(t.nivel.chica)} / ${miles(t.nivel.grande)}`,
          horaMas(horaInicio, t.desdeMinuto),
        ]

  const imagen: DatosTabla = {
    tipo: 'tabla',
    titulo: 'Torneo',
    subtitulo: nombre.trim() || fechaLarga(fecha),
    gorro: nombreLiga,
    columnas: ['Nivel', 'Ciegas', 'A las'],
    filas: tramosDe(estructura).map(filaDe),
    pie: `Entrada ${money(buyIn)} · ${miles(stack)} fichas`,
  }

  const texto = () => {
    const lineas = [
      `🏆 ${nombreLiga} · ${nombre.trim() || fechaLarga(fecha)}`,
      '',
      `Arranca ${horaInicio}, se acaba cerca de las ${horaMas(horaInicio, estructura.duracionMinutos)}`,
      `Entrada ${money(buyIn)} → ${miles(stack)} fichas`,
    ]
    const hasta = (nivel: number) =>
      nivel > 0 ? ` (hasta que acabe el nivel ${nivel})` : ''
    if (num(rebuyPrice) > 0)
      lineas.push(
        `Recompra ${money(rebuyPrice)} → ${miles(fichasRecompra)} fichas${hasta(recomprasHasta)}`,
      )
    if (num(addOnPrice) > 0)
      lineas.push(
        `Add-on ${money(addOnPrice)} → ${miles(fichasAddOn)} fichas${hasta(addOnsHasta)}`,
      )
    lineas.push('', 'Premios:')
    payouts.forEach((po, i) => lineas.push(`  ${i + 1}º · ${num(po.pct)}%`))
    lineas.push('', 'Ciegas:')
    for (const t of tramosDe(estructura)) {
      const [que, cuanto, cuando] = filaDe(t)
      lineas.push(`  ${cuando} · ${que} · ${cuanto}`)
    }
    return lineas.join('\n')
  }

  /* ---- pantalla ---- */

  const Encabezado = () => (
    <div className="mb-4 flex gap-1">
      {PASOS.map((p, i) => (
        <span
          key={p}
          className={`flex-1 rounded-full py-1 text-center text-[10px] font-bold tracking-[.4px] uppercase ${
            i + 1 === paso
              ? 'bg-marca text-white'
              : i + 1 < paso
                ? 'bg-marca/18 text-marca-tinta'
                : 'bg-ink/8 text-ink-soft/60'
          }`}
        >
          {p}
        </span>
      ))}
    </div>
  )

  const Navegar = ({ puede, rotulo }: { puede: boolean; rotulo: string }) => (
    <div className="mt-1 mb-2 flex gap-2">
      {paso > 1 && (
        <button
          type="button"
          className="btn btn-ghost w-auto shrink-0 px-4"
          onClick={() => setPaso(paso - 1)}
        >
          <ArrowLeft size={17} strokeWidth={2.4} />
          Atrás
        </button>
      )}
      <button
        type="button"
        className="btn btn-marca disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!puede}
        onClick={() => setPaso(paso + 1)}
      >
        {rotulo}
        <ArrowRight size={17} strokeWidth={2.4} />
      </button>
    </div>
  )

  if (paso === 1)
    return (
      <>
        <Encabezado />
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Marca a los que van a jugar. De cuántos sean dependen las fichas que le tocan a cada quien
          y lo que va a durar el torneo.
        </p>

        <ul className="m-0 mb-3 list-none p-0">
          {miembros.map((m) => (
            <li
              key={m.id}
              className="border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={elegidos.includes(m.id)}
                  className="h-5 w-5 shrink-0"
                  onChange={(e) =>
                    setElegidos((s) =>
                      e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id),
                    )
                  }
                />
                <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{m.nombre}</b>
              </label>
            </li>
          ))}
        </ul>

        <div className="mb-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-ink-soft">
          <Users size={15} strokeWidth={2.4} />
          {jugadores === 0 ? 'Nadie todavía' : `${jugadores} en la mesa`}
        </div>

        {/* Se puede armar el torneo sin marcar a nadie y mandar el link, igual que en
            cash. Pero las fichas hay que repartirlas entre alguien: de cuántos sean
            dependen los valores, el stack y si alcanza la caja. */}
        {jugadores === 0 && (
          <div className="mb-4 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
            <span className="field-label">Para cuántos lo armo</span>
            <p className="mt-0.5 mb-1.5 text-[12px] leading-snug text-ink-soft">
              No marques a nadie si prefieres mandar el link y que cada quien se apunte
              solo. Dime nada más para cuántos calculo las fichas; si al final son otros,
              el plan se vuelve a hacer desde la partida.
            </p>
            <div className="field-box">
              <NumInput
                value={esperados}
                showZero
                aria-label="Para cuántos lo armo"
                onChange={setEsperados}
              />
            </div>
          </div>
        )}

        <label className="mb-3 block">
          <span className="field-label">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
          />
        </label>

        {/* El nombre y la foto van juntos: son las dos cosas con las que se reconoce
            esta noche en la lista y en el link que se manda al grupo. */}
        <div className="mb-4 flex items-end gap-3">
          <label className="min-w-0 flex-1 block">
            <span className="field-label">Nombre (opcional)</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Torneo de cumpleaños"
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>
          <AvatarEditable
            foto={foto}
            nombre={nombre || 'Torneo'}
            size={52}
            etiqueta="Foto del torneo"
            onCambiar={setFoto}
            onError={avisar}
          />
        </div>

        <div className="mb-4">
          <span className="field-label">Quién lleva el banco</span>
          <p className="mt-0.5 mb-1.5 text-[12px] leading-snug text-ink-soft">
            Recibe el dinero y es el único que puede cerrar el torneo al final.
          </p>
          <SelectorJugador
            titulo="¿Quién lleva el banco?"
            valor={jefe}
            onChange={(id) => setJefe(id ?? yoId)}
            opciones={miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.foto }))}
          />
        </div>

        <Navegar puede={paraCalcular >= 2 && (jugadores === 0 || jugadores >= 2)} rotulo="Continuar" />
        {jugadores === 1 && (
          <p className="mt-0 mb-2 text-center text-[12px] text-ink-soft">
            Un torneo necesita al menos dos. Déjalo sin nadie si vas a mandar el link.
          </p>
        )}
        {jugadores === 0 && esperados < 2 && (
          <p className="mt-0 mb-2 text-center text-[12px] text-ink-soft">
            Dime para cuántos lo armo: dos por lo menos.
          </p>
        )}
      </>
    )

  if (paso === 2)
    return (
      <>
        <Encabezado />
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Tú pones el dinero; las fichas las saca la app. Lo que dan la recompra y el add-on es la
          misma proporción que la entrada, para que nadie compre puntos más baratos.
        </p>

        <MoneyInput label="Entrada" value={buyIn} onChange={setBuyIn} />
        <MoneyInput label="Recompra" value={rebuyPrice} onChange={setRebuyPrice} />
        <MoneyInput label="Add-on" value={addOnPrice} onChange={setAddOnPrice} />
        <MoneyInput label="Cena por persona" value={cenaPorPersona} onChange={setCenaPorPersona} />
        <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
          Si la entrada incluye cena, ponla aquí: sale de la bolsa antes de repartir
          premios. Déjala en 0 y la pones después, cuando llegue la cuenta.
        </p>

        {/* Hasta cuándo se compra. Es la regla que se discute a media noche, cuando al
            que se quedó sin fichas le urge una más; puesta por escrito antes de empezar
            —y aceptada por cada quien al apuntarse— ya no se discute. */}
        {(num(rebuyPrice) > 0 || num(addOnPrice) > 0) && (
          <>
            <p className="field-label mt-1 mb-1">Hasta cuándo se puede comprar</p>
            <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
              En 0 se compra toda la noche. Esta regla sale en la invitación, y quien se
              apunta tiene que marcar que la leyó.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {num(rebuyPrice) > 0 && (
                <div>
                  <span className="field-label">Recompras hasta el nivel</span>
                  <div className="field-box mt-1">
                    <NumInput
                      value={recomprasHasta}
                      showZero
                      aria-label="Recompras hasta el nivel"
                      onChange={setRecomprasHasta}
                    />
                  </div>
                </div>
              )}
              {num(addOnPrice) > 0 && (
                <div>
                  <span className="field-label">Add-on hasta el nivel</span>
                  <div className="field-box mt-1">
                    <NumInput
                      value={addOnsHasta}
                      showZero
                      aria-label="Add-on hasta el nivel"
                      onChange={setAddOnsHasta}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-1 mb-2">
          <span className="field-label">Puntos con los que arranca cada quien</span>
          <p className="mt-0.5 mb-1 text-[12px] leading-snug text-ink-soft">
            Las fichas del torneo son puntos, no pesos. De este número salen las ciegas y lo
            que dan la recompra y el add-on.
          </p>
          <div className="field-box">
            <NumInput
              value={stack}
              showZero
              mode="decimal"
              aria-label="Puntos con los que arranca cada quien"
              onChange={cambiarStack}
            />
          </div>
        </div>

        <div className="mt-1 mb-4 rounded-xl border border-paper-line bg-paper-soft px-3 py-2.5">
          <p className="field-label mt-0 mb-1.5">Lo que da cada cosa</p>
          <ul className="m-0 list-none p-0 text-[13px]">
            <li className="flex justify-between py-0.5">
              <span className="text-ink-soft">Entrada {money(buyIn)}</span>
              <b className="text-ink">{miles(stack)} fichas</b>
            </li>
            {num(rebuyPrice) > 0 && (
              <li className="flex justify-between py-0.5">
                <span className="text-ink-soft">Recompra {money(rebuyPrice)}</span>
                <b className="text-ink">{miles(fichasRecompra)} fichas</b>
              </li>
            )}
            {num(addOnPrice) > 0 && (
              <li className="flex justify-between py-0.5">
                <span className="text-ink-soft">Add-on {money(addOnPrice)}</span>
                <b className="text-ink">{miles(fichasAddOn)} fichas</b>
              </li>
            )}
          </ul>
        </div>

        <p className="field-label mt-0 mb-1">Cuántas calculas que van a salir</p>
        <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
          No es adivinar por gusto: si no se cuentan, las fichas alcanzan al arrancar y se acaban a
          media noche.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <span className="field-label">Recompras</span>
            <div className="field-box mt-1">
              <NumInput
                value={recomprasEsperadas}
                showZero
                aria-label="Recompras que calculas"
                onChange={setRecomprasEsperadas}
              />
            </div>
          </div>
          <div>
            <span className="field-label">Add-ons</span>
            <div className="field-box mt-1">
              <NumInput
                value={addOnsEsperados}
                showZero
                aria-label="Add-ons que calculas"
                onChange={setAddOnsEsperados}
              />
            </div>
          </div>
        </div>

        <Navegar puede={num(buyIn) > 0} rotulo="Continuar" />
        {num(buyIn) <= 0 && (
          <p className="mt-0 mb-2 text-center text-[12px] text-ink-soft">
            Falta cuánto cuesta entrar.
          </p>
        )}
      </>
    )

  if (paso === 3)
    return (
      <>
        <Encabezado />
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          A qué hora se juega. De ahí sale cuántos niveles caben y qué tan rápido tienen que subir
          las ciegas para que termine a esa hora.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="field-label">Empieza</span>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => cambiarTiempo(setHoraInicio)(e.target.value)}
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>
          <label className="block">
            <span className="field-label">Se acaba</span>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => cambiarTiempo(setHoraFin)(e.target.value)}
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>
        </div>
        <p className="mt-0 mb-4 text-center text-[13px] font-semibold text-ink-soft">
          {minutos > 0
            ? `${Math.floor(minutos / 60)} h ${minutos % 60 ? `${minutos % 60} min` : ''}`.trim()
            : 'Pon las dos horas'}
        </p>

        <div className="mb-4">
          <span className="field-label">Cada cuántos minutos suben las ciegas</span>
          <div className="mt-1">
            <Opciones valor={porNivel} opciones={NIVELES} onElegir={cambiarTiempo(setPorNivel)} />
          </div>
        </div>

        <div className="mb-4">
          <span className="field-label">Descanso cada cuántos niveles</span>
          <div className="mt-1">
            <Opciones
              valor={cadaNiveles}
              opciones={CADA_CUANTOS}
              etiqueta={(o) => (o === 0 ? 'Sin' : String(o))}
              onElegir={cambiarTiempo(setCadaNiveles)}
            />
          </div>
        </div>

        {cadaNiveles > 0 && (
          <div className="mb-4">
            <span className="field-label">De cuántos minutos es el descanso</span>
            <div className="mt-1">
              <Opciones
                valor={minDescanso}
                opciones={DURACION_DESCANSO}
                onElegir={cambiarTiempo(setMinDescanso)}
              />
            </div>
            <p className="mt-1.5 mb-0 text-[12px] leading-snug text-ink-soft">
              Es el rato para cenar. El reloj lo cuenta solo y avisa cuándo se vuelve.
            </p>
          </div>
        )}

        <Navegar puede={minutos >= 30} rotulo="Ver el plan" />
        {minutos < 30 && (
          <p className="mt-0 mb-2 text-center text-[12px] text-ink-soft">
            Con menos de media hora no hay torneo que armar.
          </p>
        )}
      </>
    )

  if (paso === 4)
    return (
      <>
        <Encabezado />
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Esto es lo que sale de lo que pusiste. Cambia lo que quieras: todo lo demás se vuelve a
          calcular solo.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div className="stat">
            <div className="stat-k">Bolsa estimada</div>
            <div className="stat-v">{money(bolsa)}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Arranca con</div>
            <div className="stat-v">{Math.round(estructura.profundidad)} ciegas</div>
          </div>
          <div className="stat">
            <div className="stat-k">Va a durar</div>
            <div className="stat-v">{Math.round(estructura.duracionMinutos / 60)} h</div>
          </div>
          <div className="stat">
            <div className="stat-k">Termina cerca de</div>
            <div className="stat-v">{horaMas(horaInicio, estructura.duracionMinutos)}</div>
          </div>
        </div>

        {plan.aviso && <div className="balance balance-off">{plan.aviso}</div>}
        {estructura.aviso && <div className="balance balance-off">{estructura.aviso}</div>}
        {reparto.anyOver && (
          <div className="balance balance-off">
            No alcanzan las fichas de algún color para repartir estos stacks.
          </div>
        )}
        {reparto.anyShortfall && (
          <div className="balance balance-off">
            Con las fichas que hay no se puede armar el stack exacto de todos. Baja el stack o mete
            menos jugadores.
          </div>
        )}

        <p className="field-label mt-4 mb-1">Cuánto vale cada ficha esa noche</p>
        <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
          En torneo las fichas no son dinero: son puntos. Valen esto para que alcancen y para que la
          más chica pague la ciega chica.
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
                onChange={(v) => setValoresManual({ ...valores, [c.key]: v })}
              />
            </label>
          ))}
        </div>
        {valoresManual && (
          <button
            type="button"
            className="btn btn-ghost mt-1 mb-2"
            onClick={() => setValoresManual(null)}
          >
            Volver a los valores que propone la app
          </button>
        )}

        <p className="field-label mt-4 mb-1.5">Así arranca cada quien</p>
        <ul className="m-0 mb-3 list-none p-0">
          {colores.map((c) => {
            const uso = reparto.usage[c.key]
            const cadaQuien = reparto.rows[0]?.counts[c.key] ?? 0
            return (
              <li
                key={c.key}
                className="flex items-center justify-between border-b border-dashed border-paper-line py-2 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Chip color={c} />
                  <span className="truncate font-semibold text-ink">{c.label}</span>
                  <span className="shrink-0 text-[12px] text-ink-soft">
                    de {miles(valores[c.key] ?? 0)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {/* Con la caja justa, algún color puede no entrar al arranque.
                      Decirlo evita que parezca que la cuenta salió mal. */}
                  {cadaQuien > 0 ? (
                    <>
                      <b className="font-display text-[15px] text-ink">{cadaQuien} c/u</b>
                      <span
                        className={`ml-2 text-[12px] ${uso?.over ? 'text-loss' : 'text-ink-soft'}`}
                      >
                        {uso?.used ?? 0}/{uso?.inventory ?? 0}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-ink-soft">no alcanzó para el arranque</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="field-label mt-4 mb-1.5">Cómo se reparten los premios</p>
        <Premios payouts={payouts} onCambiar={setPayouts} />

        <p className="field-label mt-4 mb-1.5">Las ciegas</p>
        <p className="mt-0 mb-2 text-[12px] leading-snug text-ink-soft">
          Puedes cambiar cualquier ciega a mano; la grande se ajusta al doble.
        </p>
        <TablaCiegas estructura={estructura} horaInicio={horaInicio} onCambiar={setTablaManual} />

        <div className="mt-4 mb-2 flex gap-2">
          <button
            type="button"
            className="btn btn-ghost w-auto shrink-0 px-4"
            onClick={() => setPaso(3)}
          >
            <ArrowLeft size={17} strokeWidth={2.4} />
            Atrás
          </button>
          <button
            type="button"
            className="btn btn-marca disabled:cursor-not-allowed disabled:opacity-45"
            disabled={ocupado || !premiosCuadran(payouts)}
            onClick={() => void crear()}
          >
            <Trophy size={17} strokeWidth={2.4} />
            Crear el torneo
          </button>
        </div>
        {!premiosCuadran(payouts) && (
          <p className="mt-0 mb-2 text-center text-[12px] text-loss">
            Los premios tienen que sumar 100% antes de crearlo.
          </p>
        )}
      </>
    )

  /* ---- ya quedó ---- */
  return (
    <>
      <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-win/12 px-3 py-2.5 text-[14px] font-semibold text-win-tinta">
        <Check size={17} strokeWidth={2.8} />
        El torneo quedó armado
      </div>

      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Mándalo al grupo para que todos lleguen sabiendo a qué hora, con cuánto y cómo suben las
        ciegas.
      </p>

      <ShareBlock datos={imagen} texto={texto} alt="Resumen del torneo" />

      {/* Las reglas aparte de las ciegas: son dos cosas que se preguntan distinto
          —"¿a qué hora sube?" y "¿hasta cuándo recompro?"— y una sola imagen con todo
          no se lee en el chat. */}
      <p className="field-label mt-4 mb-1.5">Y las reglas, en su propia imagen</p>
      <ShareBlock
        datos={tablaDeReglas(torneoArmado, {
          titulo: nombre.trim() || fechaLarga(fecha),
          liga: nombreLiga,
        })}
        texto={textoReglas}
        alt="Reglas del torneo"
      />

      {/* El link va aparte del resumen: el resumen se lee, el link se aprieta y te
          apunta. */}
      <button type="button" className="btn btn-share mt-3 mb-2" onClick={() => void compartirLink()}>
        <Share2 size={17} strokeWidth={2.4} />
        Mandar el link para que se apunten
      </button>
      {jugadores === 0 && (
        <p className="mt-0 mb-2 text-center text-[12px] leading-snug text-ink-soft">
          No hay nadie apuntado todavía. Con el link cada quien entra solo hasta las{' '}
          <b className="text-ink">{horaInicio}</b>.
        </p>
      )}

      <button
        type="button"
        className="btn btn-marca mb-2"
        onClick={() => creada && onIrAlTorneo(creada)}
      >
        <Coins size={17} strokeWidth={2.4} />
        Ir al torneo
      </button>
    </>
  )
}
