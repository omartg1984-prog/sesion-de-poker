import { Check, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import NumInput from '../../components/NumInput'
import {
  cartasVisibles,
  mueveElHeroe,
  mueveElSiguiente,
  repartir,
  resolver,
  tocaAlHeroe,
  type Entrenamiento,
} from '../../lib/entrenador'
import { NOMBRE_CALLE, bote as boteDe, comoSeDiceCorto, opciones } from '../../lib/mano'
import { money } from '../../lib/money'
import {
  asientosDe,
  azarCon,
  cuentasDeLaApuesta,
  equidadDe as parteDe,
  nombreDeLaMano,
  simular,
} from '../../lib/poker'
import { ESTILOS, estiloPorId, rivalesAlAzar, type Rival } from '../../lib/rival'
import Mesa, { type AsientoEnMesa } from './Mesa'
import { BarraPegada, Barras, CAJA, FONDOS, TINTA, type Tono } from './tonos'

/*
 * Practicar manos contra la máquina.
 *
 * La otra mitad del tab resuelve una mano que está pasando en la mesa. Ésta reparte
 * manos de verdad, una tras otra, contra gente que juega distinto entre sí: la roca que
 * sólo entra con manaza, el que paga todo, el que farolea. Se juega, se decide, y
 * acabando la mano la app dice si la decisión estuvo bien —no si se ganó o se perdió,
 * que eso es suerte—, que es lo único que se puede aprender.
 *
 * Los rivales no hacen trampa: cada uno ve sus dos cartas y las de en medio y saca sus
 * cuentas contra manos que no conoce, igual que una persona.
 */

/** Lo que tarda cada rival en mover. Suficiente para alcanzar a ver qué hizo. */
const PAUSA = 750

const MIN_JUGADORES = 2
const MAX_JUGADORES = 9

/** Nombres para la mesa, que jugar contra "Asiento 4" no se parece a nada. */
const NOMBRES = ['Chuy', 'Lalo', 'Memo', 'Beto', 'Nacho', 'Tono', 'Pancho', 'Chepe', 'Moy']

/** Con cuánto se sienta cada quien. Con ciegas de $1 y $2, 200 son cien ciegas. */
const ENTRADAS = [100, 200, 400]

/*
 * Una persona de la mesa, no una silla.
 *
 * Las fichas y el modo de jugar son de la persona y se quedan con ella aunque cambie de
 * lugar. Y cambia: el botón se mueve mano con mano, como debe ser, porque jugar siempre
 * desde el mismo asiento no enseña lo que de verdad cuesta aprender, que es que la misma
 * mano vale distinto según desde dónde se juegue.
 */
interface Persona {
  nombre: string
  rival: Rival
  fichas: number
}

export default function Entrenador() {
  const [jugadores, setJugadores] = useState(6)
  const [e, setE] = useState<Entrenamiento | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  /** Quién se sienta en cada silla esta mano. El 0 de la lista es el que practica. */
  const [enAsiento, setEnAsiento] = useState<number[]>([])
  const [giro, setGiro] = useState(0)
  const [entrada, setEntrada] = useState(200)
  const [consejo, setConsejo] = useState<{ bien: boolean; texto: string } | null>(null)
  const [caja, setCaja] = useState({ manos: 0, saldo: 0 })
  const [subirA, setSubirA] = useState(0)
  const [verEstilos, setVerEstilos] = useState(true)

  /* Un solo azar para toda la sesión: así las manos no se repiten al volver a entrar. */
  const azar = useRef(azarCon((Date.now() % 1000000) + 1))

  const asientos = useMemo(() => asientosDe(jugadores), [jugadores])
  const heroe = e?.cfg.heroe ?? 0
  const personaEn = (s: number) => personas[enAsiento[s]] as Persona | undefined
  const nombreDe = (s: number) =>
    enAsiento[s] === 0 ? 'Tú' : (personaEn(s)?.nombre ?? NOMBRES[s % NOMBRES.length])

  const nuevaMesa = (cuantos: number): Persona[] => {
    const suyos = rivalesAlAzar(cuantos, azar.current)
    return suyos.map((rival, i) => ({
      nombre: i === 0 ? 'Tú' : NOMBRES[(i - 1) % NOMBRES.length],
      rival,
      fichas: entrada,
    }))
  }

  const repartirOtra = (gente?: Persona[]) => {
    const cuantos = jugadores
    const base = gente ?? (personas.length === cuantos ? personas : nuevaMesa(cuantos))
    /* Al que se quedó sin fichas lo vuelven a sentar: es la mesa de casa, no un torneo. */
    const listos = base.map((p, i) => (i === 0 || p.fichas > 0 ? p : { ...p, fichas: entrada }))

    /* El botón se mueve: la silla 0 siempre es el botón, así que lo que gira es la gente. */
    const sillas = Array.from({ length: cuantos }, (_, s) => (s + giro) % cuantos)
    const miSilla = sillas.indexOf(0)

    setPersonas(listos)
    setEnAsiento(sillas)
    setGiro((g) => g + 1)
    setConsejo(null)
    setE(
      repartir(
        {
          jugadores: cuantos,
          heroe: miSilla,
          ciegaChica: 1,
          ciegaGrande: 2,
          fichas: sillas.map((i) => listos[i].fichas),
        },
        sillas.map((i) => listos[i].rival),
        azar.current,
      ),
    )
  }

  /* Cambiar el tamaño de la mesa, o con cuánto se entra, es empezar otra mesa. */
  useEffect(() => {
    setPersonas([])
    setEnAsiento([])
    setGiro(0)
    setE(null)
    setConsejo(null)
    setCaja({ manos: 0, saldo: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jugadores, entrada])

  /* Los rivales mueven solos, de uno en uno, para poder ver quién hizo qué. */
  useEffect(() => {
    if (!e || e.mano.terminada || tocaAlHeroe(e)) return
    const t = setTimeout(() => setE((x) => (x ? mueveElSiguiente(x, azar.current) : x)), PAUSA)
    return () => clearTimeout(t)
  }, [e])

  /* Al acabarse la mano se reparte el bote: cada quien se queda con lo que no puso más
     lo que se llevó, y con eso arranca la siguiente. */
  useEffect(() => {
    if (!e || !e.mano.terminada || e.final) return
    const r = resolver(e)
    setE(r)
    setCaja((c) => ({ manos: c.manos + 1, saldo: c.saldo + (r.final?.heroe ?? 0) }))
    setPersonas((ps) =>
      ps.map((p, i) => {
        const s = enAsiento.indexOf(i)
        if (s < 0) return p
        return { ...p, fichas: r.mano.resto[s] + (r.final?.gana[s] ?? 0) }
      }),
    )
  }, [e])

  const mano = e?.mano ?? null
  const vivos = mano ? mano.vivo.filter(Boolean).length : 0
  const sigoVivo = Boolean(mano?.vivo[heroe])
  const mesa = e ? cartasVisibles(e) : []
  const bote = mano ? boteDe(mano) : 0
  const o = mano && !mano.terminada ? opciones(mano) : null
  const meToca = Boolean(e && tocaAlHeroe(e))

  /* Lo que se lleva el héroe contra los que siguen, con las manos de ellos tapadas:
     exactamente lo que él sabe en ese momento. */
  const equidad = useMemo(() => {
    if (!e || !sigoVivo || vivos < 2) return null
    return parteDe(
      simular({
        mano: e.cartas[heroe],
        mesa,
        rivales: vivos - 1,
        iteraciones: 8000,
        azar: azarCon(e.cartas[heroe][0] * 53 + e.cartas[heroe][1] + mesa.length * 7919 + vivos),
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.cartas, mesa.length, vivos, sigoVivo])

  const meFalta = mano && sigoVivo ? Math.max(...mano.puesto) - mano.puesto[heroe] : 0
  const cuentas = equidad !== null ? cuentasDeLaApuesta(equidad, bote, meFalta) : null

  /* Lo que traigo enfrente: durante la mano, lo que queda; entre manos, lo de la cuenta. */
  const misFichas = mano ? mano.resto[heroe] + (e?.final?.gana[heroe] ?? 0) : (personas[0]?.fichas ?? entrada)

  const minimo = o?.minimo ?? 0
  useEffect(() => {
    setSubirA((v) => (v >= minimo ? v : minimo))
  }, [minimo])

  /*
   * Si la decisión estuvo bien, dicho en el momento.
   *
   * Se juzga la decisión y no el resultado: pagar con las cuentas a favor y perder la
   * mano está bien jugado, y es lo más difícil de tragar cuando se empieza.
   */
  const mover = (tipo: Parameters<typeof mueveElHeroe>[1], hasta?: number) => {
    if (!e) return
    if (cuentas && (tipo === 'seVa' || tipo === 'paga')) {
      const gana = Math.round(cuentas.tienes)
      const pide = Math.round(cuentas.necesitas)
      if (tipo === 'paga')
        setConsejo(
          cuentas.conviene
            ? { bien: true, texto: `Bien pagado: ganas ${gana} de cada 100 y te bastaban ${pide}.` }
            : {
                bien: false,
                texto: `Ahí no: ganas ${gana} de cada 100 y hacían falta ${pide}. A la larga eso cuesta.`,
              },
        )
      else
        setConsejo(
          cuentas.conviene
            ? {
                bien: false,
                texto: `Te fuiste con ${gana} de cada 100 y te bastaban ${pide}: ahí se pagaba.`,
              }
            : { bien: true, texto: `Bien tirada: ganas ${gana} de cada 100 y pedían ${pide}.` },
        )
    } else setConsejo(null)
    setE(mueveElHeroe(e, tipo, hasta))
  }

  const trae =
    e && sigoVivo && mesa.length >= 3 ? nombreDeLaMano(e.cartas[heroe], mesa) : ''

  /* El color de la pantalla: con algo que pagar manda la cuenta del bote; sin nada que
     pagar no hay nada que contestar y se queda en gris. */
  const veredicto: { tono: Tono; titulo: string; linea: string } = (() => {
    if (!e) return { tono: 'gris', titulo: 'Reparte', linea: 'Dale a repartir y jugamos una mano.' }
    if (e.final) {
      const gano = e.final.ganadores.includes(heroe)
      const quien = e.final.ganadores.map(nombreDe).join(' y ')
      return {
        tono: gano ? 'verde' : 'gris',
        titulo: gano ? `Ganaste ${money(e.final.heroe)}` : `Ganó ${quien}`,
        linea: e.final.alGolpe
          ? `Al golpe, con ${e.final.conQue.toLowerCase()}. El bote era de ${money(e.final.bote)}.`
          : `Todos se fueron. El bote de ${money(e.final.bote)} se lo llevó sin enseñar nada.`,
      }
    }
    if (!sigoVivo)
      return { tono: 'gris', titulo: 'Te fuiste', linea: 'A ver cómo acaba sin ti.' }
    if (!meToca)
      return {
        tono: 'gris',
        titulo: 'Esperando',
        linea: mano?.turno !== null ? `Está pensando ${nombreDe(mano!.turno!)}.` : '',
      }
    if (cuentas) {
      const holgura = cuentas.tienes / Math.max(cuentas.necesitas, 0.0001)
      const linea = `Ganas ${Math.round(cuentas.tienes)} de cada 100 y te piden ${Math.round(cuentas.necesitas)}.`
      if (holgura >= 1.25) return { tono: 'verde', titulo: 'Paga', linea }
      if (holgura >= 1) return { tono: 'ambar', titulo: 'Apenas alcanza', linea }
      return { tono: 'rojo', titulo: 'Tírala', linea }
    }
    return {
      tono: 'gris',
      titulo: 'Te toca',
      linea: `Nadie te pide nada. Ganas ${Math.round(equidad ?? 0)} de cada 100.`,
    }
  })()

  /*
   * El que juega va siempre abajo, aunque el botón se mueva.
   *
   * Las sillas se cuentan desde el botón, así que al girar la mesa uno acabaría dibujado
   * en un lugar distinto cada mano y no se reconocería a sí mismo. Se rota el dibujo para
   * dejarlo abajo: lo que se ve moverse es el botón, que es lo que de verdad se mueve.
   */
  const comoSeVe = [...asientos.slice(heroe), ...asientos.slice(0, heroe)]

  const enMesa: AsientoEnMesa[] = comoSeVe.map((a) => {
    const s = a.indice
    const suyas = !e ? [] : s === heroe || e.final?.alGolpe ? e.cartas[s] : []
    const ultimo = mano
      ? [...mano.movimientos].reverse().find((m) => m.jugador === s && m.calle === mano.calle)
      : undefined
    return {
      indice: s,
      nombre: nombreDe(s),
      foto: null,
      ocupado: false,
      marca: a.marca,
      yo: s === heroe,
      cartas: suyas,
      /* El renglón de abajo de la placa lleva lo que trae enfrente: es lo primero que se
         mira antes de apostarle a alguien. */
      pct: mano ? money(mano.resto[s]) : '',
      apuesta: mano ? mano.puesto[s] : 0,
      fuera: Boolean(mano && !mano.vivo[s]),
      activo: mano?.turno === s,
      accion: mano && !mano.vivo[s] ? 'Se fue' : ultimo ? comoSeDiceCorto(ultimo, money) : '',
      estilo:
        verEstilos && e && s !== heroe ? estiloPorId(e.estilos[s]).nombre.toLowerCase() : undefined,
      manda: Boolean(e?.final?.ganadores.includes(s)),
    }
  })

  return (
    <div
      className="-mx-3.5 -mt-3.5 px-3.5 pt-3.5 pb-24 transition-[background] duration-500"
      style={{ background: FONDOS[veredicto.tono] }}
    >
      <Mesa
        asientos={enMesa}
        mesa={[...mesa, ...Array(5 - mesa.length).fill(null)]}
        eligiendo={null}
        bote={bote}
        dinero={money}
        onAsiento={() => {}}
        onCarta={() => {}}
      />

      {/* La cuenta de la sesión: sin esto, practicar no se siente ir a ningún lado. */}
      <div className="mt-1 mb-3 flex items-center justify-center gap-2 text-[12px] text-tiza-suave">
        {caja.manos > 0 ? (
          <>
            <span>
              {caja.manos} {caja.manos === 1 ? 'mano' : 'manos'}
            </span>
            <span>·</span>
            <b className={caja.saldo >= 0 ? 'text-win-alto' : 'text-marca-alta'}>
              {caja.saldo >= 0 ? '+' : '−'}
              {money(Math.abs(caja.saldo))}
            </b>
            <span>·</span>
            <span>traes {money(misFichas)}</span>
          </>
        ) : (
          <span>
            Ciegas de $1 y $2, y cada quien se sienta con {money(entrada)}.
          </span>
        )}
      </div>

      {/* ---- lo que te toca hacer ---- */}
      <section className="panel">
        {!e ? (
          <>
            <p className="panel-title">
              <span>Entrenar</span>
            </p>
            <p className="mt-0 mb-2.5 text-[12.5px] leading-snug text-ink-soft">
              Se reparten manos de verdad contra rivales que juegan distinto entre sí. Juegas,
              decides, y acabando la mano te digo si la decisión estuvo bien. No si ganaste:
              eso es suerte.
            </p>
            <button type="button" className="btn btn-marca" onClick={() => repartirOtra()}>
              <Play size={17} strokeWidth={2.6} />
              Repartir
            </button>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <b className="font-display text-[14px] text-ink">
                {e.final ? 'Se acabó' : NOMBRE_CALLE[e.mano.calle]}
              </b>
              <span className="text-[12.5px] text-ink-soft">
                Traes <b className="font-display text-ink tabular-nums">{money(misFichas)}</b>
                {trae && ` · ${trae.toLowerCase()}`}
              </span>
            </div>

            {consejo && (
              <div
                className={`mb-2.5 flex items-start gap-2 rounded-xl px-3 py-2.5 ${
                  consejo.bien ? 'bg-win/12' : 'bg-loss/12'
                }`}
              >
                {consejo.bien ? (
                  <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-win" />
                ) : (
                  <X size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-loss" />
                )}
                <span className="text-[12.5px] leading-snug text-ink">{consejo.texto}</span>
              </div>
            )}

            {e.final ? (
              misFichas <= 0 ? (
                <>
                  <p className="mt-0 mb-2 text-[12.5px] leading-snug text-ink">
                    Te quedaste sin fichas. Pasa, le pasa a todos; lo que no se vale es
                    volver a entrar sin saber qué salió mal.
                  </p>
                  <button
                    type="button"
                    className="btn btn-marca"
                    onClick={() =>
                      repartirOtra(personas.map((p, i) => (i === 0 ? { ...p, fichas: entrada } : p)))
                    }
                  >
                    <Play size={17} strokeWidth={2.6} />
                    Vuelvo a entrar con {money(entrada)}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-marca" onClick={() => repartirOtra()}>
                  <Play size={17} strokeWidth={2.6} />
                  Otra mano
                </button>
              )
            ) : meToca && o ? (
              <>
                <div className="mb-2 flex gap-1.5">
                  <button
                    type="button"
                    className="flex-1 cursor-pointer rounded-lg border-none bg-[#e6e1d8] py-2.5 text-[13px] font-bold text-ink-soft active:scale-95"
                    onClick={() => mover('seVa')}
                  >
                    Me voy
                  </button>
                  <button
                    type="button"
                    className="flex-1 cursor-pointer rounded-lg border-none bg-[#e6e1d8] py-2.5 text-[13px] font-bold text-ink active:scale-95"
                    onClick={() => mover(o.pasa ? 'pasa' : 'paga')}
                  >
                    {o.pasa ? 'Paso' : o.pagarEsTodo ? `Voy con todo ${money(o.paga)}` : `Pago ${money(o.paga)}`}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <span className="field-box flex-1">
                    <NumInput
                      value={subirA}
                      mode="decimal"
                      aria-label="A cuánto subo"
                      onChange={setSubirA}
                    />
                  </span>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-lg border-none bg-marca px-4 py-2.5 text-[13px] font-bold text-white active:scale-95"
                    onClick={() => mover(o.esApuesta ? 'apuesta' : 'sube', subirA)}
                  >
                    {o.esApuesta ? 'Apuesto' : 'Subo'}
                  </button>
                </div>
                <div className="mt-1 flex gap-1.5">
                  {[
                    { k: 'Medio bote', v: Math.round(bote / 2) },
                    { k: 'El bote', v: bote },
                    { k: 'Todo', v: o.maximo },
                  ].map((x) => (
                    <button
                      key={x.k}
                      type="button"
                      onClick={() => setSubirA(Math.min(o.maximo, Math.max(o.minimo, x.v)))}
                      className="flex-1 cursor-pointer border-none bg-transparent py-1 text-[11.5px] font-semibold text-ink-soft underline active:scale-95"
                    >
                      {x.k}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-0 mb-0 text-[12.5px] leading-snug text-ink-soft">
                {sigoVivo
                  ? `Está pensando ${mano?.turno !== null && mano?.turno !== undefined ? nombreDe(mano.turno) : 'la mesa'}…`
                  : 'Ya te fuiste de ésta. A ver cómo acaba.'}
              </p>
            )}
          </>
        )}
      </section>

      {/* ---- la cuenta, cuando hay algo que pagar ---- */}
      {cuentas && meToca && (
        <section className="panel">
          <p className="panel-title">
            <span>¿Voy o no voy?</span>
          </p>
          <div className={`rounded-xl px-3.5 py-3 text-center ${CAJA[veredicto.tono]}`}>
            <b
              className={`block font-display text-[26px] leading-none tracking-[.5px] uppercase ${TINTA[veredicto.tono]}`}
            >
              {veredicto.titulo}
            </b>
            <span className="mt-1.5 block text-[12.5px] leading-snug text-ink">
              Pones {money(meFalta)} para llevarte los {money(bote)} que ya hay.
            </span>
          </div>
          <Barras ganas={cuentas.tienes} necesitas={cuentas.necesitas} tono={veredicto.tono} />
        </section>
      )}

      {/* ---- la mesa con la que se está jugando ---- */}
      <section className="panel">
        <p className="panel-title">
          <span>La mesa</span>
        </p>
        <p className="field-label mt-0 mb-1.5">Cuántos juegan</p>
        <div className="mb-3 flex gap-1">
          {Array.from(
            { length: MAX_JUGADORES - MIN_JUGADORES + 1 },
            (_, i) => i + MIN_JUGADORES,
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setJugadores(n)}
              className={`flex-1 cursor-pointer rounded-lg border-none py-1.5 text-[12.5px] font-bold transition-colors ${
                jugadores === n ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="field-label mt-0 mb-1.5">Con cuánto se sientan</p>
        <div className="mb-3 flex gap-1.5">
          {ENTRADAS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setEntrada(v)}
              className={`flex-1 cursor-pointer rounded-lg border-none py-1.5 text-[12.5px] font-bold transition-colors ${
                entrada === v ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
              }`}
            >
              {money(v)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-ghost mb-3"
          onClick={() => {
            setPersonas([])
            setEnAsiento([])
            setGiro(0)
            setE(null)
            setConsejo(null)
            setCaja({ manos: 0, saldo: 0 })
          }}
        >
          <RotateCcw size={16} strokeWidth={2.4} />
          Otra gente en la mesa
        </button>

        <label className="mb-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={verEstilos}
            onChange={(ev) => setVerEstilos(ev.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[#df1f2e]"
          />
          <span className="text-[12.5px] text-ink">Decirme cómo juega cada quien</span>
        </label>

        {/* Quién es quién, para saber a qué atenerse. En una mesa de verdad esto se
            aprende con los años; aquí se dice para que la práctica sirva de algo. */}
        {e && (
          <ul className="m-0 list-none p-0">
            {Array.from({ length: jugadores }, (_, s) => s)
              .filter((s) => s !== heroe)
              .map((s) => {
                const estilo = estiloPorId(e.estilos[s])
                return (
                  <li
                    key={s}
                    className="border-b border-dashed border-paper-line py-1.5 last:border-b-0"
                  >
                    <b className="text-[13px] text-ink">{nombreDe(s)}</b>
                    {verEstilos && (
                      <>
                        <span className="text-[13px] text-ink-soft"> · {estilo.nombre}</span>
                        <span className="block text-[11px] leading-tight text-ink-soft">
                          {estilo.ayuda}
                        </span>
                      </>
                    )}
                  </li>
                )
              })}
          </ul>
        )}

        <p className="mt-3 mb-0 text-[11.5px] leading-snug text-ink-soft/80">
          Cada quien trae dos modos de jugar y se le sale uno u otro según la mano, como en
          la mesa de verdad. Los estilos son: {ESTILOS.map((x) => x.nombre).join(', ')}.
        </p>
      </section>

      <BarraPegada tono={veredicto.tono} titulo={veredicto.titulo} linea={veredicto.linea} />
    </div>
  )
}
