import { Check, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Cara from '../../components/Cara'
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
import type { Miembro } from '../../lib/api'
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
import {
  MANOS_PARA_PERFIL,
  RESUMEN_VACIO,
  perfilDe,
  punteria,
  type Resumen,
} from '../../lib/perfil'
import { ESTILOS, estiloPorId, rivalesAlAzar, type Rival } from '../../lib/rival'
import Mesa, { type AsientoEnMesa } from './Mesa'
import { BarraConRaya, BarraPegada, CAJA, FONDOS, TINTA, TiraConRaya, type Tono } from './tonos'

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

/** Lo que tarda cada rival en mover. Sin esto la mano pasa antes de poder leerla. */
const PAUSA = 1200

/** Lo que se queda en pantalla el aviso de que viene una carta nueva. */
const ANUNCIO = 1700

/** Cómo se anuncia cada calle antes de destapar las cartas. */
const VIENE: Record<string, string> = {
  flop: 'Ahí viene el flop',
  turn: 'Ahí viene el turn',
  river: 'Ahí viene el river',
}

/** Cuántas cartas de en medio se ven en cada calle. */
const CARTAS_DE_CALLE: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

const MIN_JUGADORES = 2
const MAX_JUGADORES = 9

/** Un renglón del historial: lo que se hizo en una mano y cómo salió. */
interface Apunte {
  mano: number
  texto: string
  bien: boolean | null
}

/** Nombres para la mesa, que jugar contra "Asiento 4" no se parece a nada. */
const NOMBRES = ['Chuy', 'Lalo', 'Memo', 'Beto', 'Nacho', 'Tono', 'Pancho', 'Chepe', 'Moy']

/** Con cuánto se sienta cada quien. Con ciegas de $1 y $2, 200 son cien ciegas. */
const ENTRADA_POR_DEFECTO = 200

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
  foto: string | null
  rival: Rival
  fichas: number
  /* Lo que se le ha visto hacer, que es de lo único que se le puede leer el juego. */
  manos: number
  jugadas: number
  subio: number
}

export default function Entrenador({ miembros }: { miembros: Miembro[] }) {
  const [jugadores, setJugadores] = useState(6)
  const [e, setE] = useState<Entrenamiento | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  /** Quién se sienta en cada silla esta mano. El 0 de la lista es el que practica. */
  const [enAsiento, setEnAsiento] = useState<number[]>([])
  const [giro, setGiro] = useState(0)
  const [entrada, setEntrada] = useState(ENTRADA_POR_DEFECTO)
  /* Lo que se está anunciando ahora mismo, y cuántas cartas se destapan al acabar. */
  const [anuncio, setAnuncio] = useState<{ texto: string; hasta: number } | null>(null)
  /** Cuántas de en medio se están viendo. Sube cuando el aviso se quita, no antes. */
  const [mostradas, setMostradas] = useState(0)
  const [consejo, setConsejo] = useState<{ bien: boolean; texto: string } | null>(null)
  const [caja, setCaja] = useState({ manos: 0, saldo: 0 })
  const [subirA, setSubirA] = useState(0)
  const [verEstilos, setVerEstilos] = useState(true)
  /* Lo que se ha hecho en toda la sesión, para decir qué tipo de jugador es. */
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_VACIO)
  const [historial, setHistorial] = useState<Apunte[]>([])
  /* Lo de esta mano, que se suma al resumen cuando se acaba. */
  const deLaMano = useRef({ jugada: false, subio: false })

  /* Un solo azar para toda la sesión: así las manos no se repiten al volver a entrar. */
  const azar = useRef(azarCon((Date.now() % 1000000) + 1))

  const asientos = useMemo(() => asientosDe(jugadores), [jugadores])
  const heroe = e?.cfg.heroe ?? 0
  const personaEn = (s: number) => personas[enAsiento[s]] as Persona | undefined
  const nombreDe = (s: number) =>
    enAsiento[s] === 0 ? 'Tú' : (personaEn(s)?.nombre ?? NOMBRES[s % NOMBRES.length])

  /*
   * La mesa se arma con la gente de la liga.
   *
   * Practicar contra "Chuy" y "Lalo" es practicar contra nadie; contra los nombres y las
   * caras de los que juegan el viernes, la cabeza sí se lo cree. Si faltan, se rellena
   * con los de siempre.
   */
  const nuevaMesa = (cuantos: number): Persona[] => {
    const suyos = rivalesAlAzar(cuantos, azar.current)
    const dePila = [...miembros].sort(() => azar.current() - 0.5)
    return suyos.map((rival, i) => {
      const suyo = i === 0 ? null : dePila[i - 1]
      return {
        nombre: i === 0 ? 'Tú' : (suyo?.nombre ?? NOMBRES[(i - 1) % NOMBRES.length]),
        foto: suyo?.foto ?? null,
        rival,
        fichas: entrada,
        manos: 0,
        jugadas: 0,
        subio: 0,
      }
    })
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
    setAnuncio(null)
    setMostradas(0)
    deLaMano.current = { jugada: false, subio: false }
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
    setResumen(RESUMEN_VACIO)
    setHistorial([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jugadores, entrada])

  /*
   * Las cartas de en medio no aparecen de golpe: primero se avisa.
   *
   * En la mesa el repartidor quema una carta, la pone y todos la ven llegar. Sin esa
   * pausa la mano pasa de una calle a otra sin que dé tiempo de entender qué cambió.
   */
  useEffect(() => {
    if (!e || anuncio) return
    const toca = e.final?.alGolpe ? 5 : CARTAS_DE_CALLE[e.mano.calle]
    if (toca <= mostradas) return
    /* Del golpe no se avisa: ahí lo que se enseña son las manos de todos. */
    const texto = e.final ? '' : VIENE[e.mano.calle]
    if (!texto) setMostradas(toca)
    else setAnuncio({ texto, hasta: toca })
  }, [e, mostradas, anuncio])

  /* El reloj del aviso vive aparte: colgado del mismo efecto que lo pone, volver a
     pintar la pantalla lo cancelaba y el aviso se quedaba ahí para siempre. */
  useEffect(() => {
    if (!anuncio) return
    const t = setTimeout(() => {
      setMostradas(anuncio.hasta)
      setAnuncio(null)
    }, ANUNCIO)
    return () => clearTimeout(t)
  }, [anuncio])

  /* Los rivales mueven solos, de uno en uno, para poder ver quién hizo qué. Mientras hay
     un aviso en pantalla nadie mueve: primero se ve la carta. */
  useEffect(() => {
    if (!e || e.mano.terminada || tocaAlHeroe(e) || anuncio) return
    const t = setTimeout(() => setE((x) => (x ? mueveElSiguiente(x, azar.current) : x)), PAUSA)
    return () => clearTimeout(t)
  }, [e, anuncio])

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
    setResumen((x) => ({
      ...x,
      manos: x.manos + 1,
      jugadas: x.jugadas + (deLaMano.current.jugada ? 1 : 0),
      subio: x.subio + (deLaMano.current.subio ? 1 : 0),
    }))

    /* Lo que hizo cada quien antes del flop, que es de donde sale leer a alguien: las
       ciegas no cuentan porque no se eligen. */
    const entro = new Set<number>()
    const subio = new Set<number>()
    for (const m of r.mano.movimientos) {
      if (m.calle !== 'preflop' || m.tipo === 'ciega') continue
      if (m.tipo === 'paga' || m.tipo === 'sube' || m.tipo === 'apuesta') entro.add(m.jugador)
      if (m.tipo === 'sube' || m.tipo === 'apuesta') subio.add(m.jugador)
    }
    setPersonas((ps) =>
      ps.map((p, i) => {
        const s = enAsiento.indexOf(i)
        if (s < 0) return p
        return {
          ...p,
          manos: p.manos + 1,
          jugadas: p.jugadas + (entro.has(s) ? 1 : 0),
          subio: p.subio + (subio.has(s) ? 1 : 0),
        }
      }),
    )
  }, [e])

  const mano = e?.mano ?? null
  const vivos = mano ? mano.vivo.filter(Boolean).length : 0
  const sigoVivo = Boolean(mano?.vivo[heroe])
  /* Lo que se ve de la mesa es lo ya destapado, que va un paso detrás del aviso. */
  const mesa = e ? cartasVisibles(e).slice(0, mostradas) : []
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

  const perfil = perfilDe(resumen)
  const tino = punteria(resumen)

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

    /* Lo que cuenta como "entrar a la mano" es poner dinero por gusto antes del flop:
       las ciegas no se eligen y por eso no dicen nada de cómo juega uno. */
    if (e.mano.calle === 'preflop') {
      if (tipo === 'paga' || tipo === 'sube' || tipo === 'apuesta')
        deLaMano.current.jugada = true
      if (tipo === 'sube' || tipo === 'apuesta') deLaMano.current.subio = true
    }

    /* Sólo se califica lo que tiene con qué calificarse: con algo que pagar y con las
       cuentas hechas. Subir no se juzga aquí, que eso depende de a quién se le sube. */
    if (cuentas && (tipo === 'seVa' || tipo === 'paga')) {
      const bien = tipo === 'paga' ? cuentas.conviene : !cuentas.conviene
      setResumen((x) => ({
        ...x,
        decisiones: x.decisiones + 1,
        buenas: x.buenas + (bien ? 1 : 0),
        pagosDeMas: x.pagosDeMas + (tipo === 'paga' && !cuentas.conviene ? 1 : 0),
        tiradasDeMas: x.tiradasDeMas + (tipo === 'seVa' && cuentas.conviene ? 1 : 0),
      }))
      setHistorial((h) =>
        [
          {
            mano: caja.manos + 1,
            texto: `${NOMBRE_CALLE[e.mano.calle].toLowerCase()}: ${
              tipo === 'paga' ? `pagaste ${money(meFalta)}` : 'te fuiste'
            } con ${Math.round(cuentas.tienes)} de cada 100 y pedían ${Math.round(cuentas.necesitas)}`,
            bien,
          },
          ...h,
        ].slice(0, 12),
      )
    }
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
    /* Acabando la mano se enseña todo, se haya llegado al golpe o no: la mitad de lo
       que se aprende es ver contra qué se estaba jugando. */
    const suyas = !e ? [] : s === heroe || e.final ? e.cartas[s] : []
    const ultimo = mano
      ? [...mano.movimientos].reverse().find((m) => m.jugador === s && m.calle === mano.calle)
      : undefined
    return {
      indice: s,
      nombre: nombreDe(s),
      foto: personaEn(s)?.foto ?? null,
      ocupado: Boolean(personaEn(s)?.foto),
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
      gano: e?.final?.gana[s],
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
      {/* La cuenta, pegada arriba: es lo que se mira a cada rato mientras se juega y no
          puede estar a dos dedos de scroll. */}
      {cuentas && (
        <TiraConRaya
          ganas={cuentas.tienes}
          necesitas={cuentas.necesitas}
          tono={veredicto.tono}
        />
      )}

      {/* El aviso de que viene una carta, encima de la mesa y sin empujar nada. */}
      <div className="relative">
        {anuncio && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
            <span className="rounded-full bg-black/80 px-4 py-2 font-display text-[15px] font-bold tracking-[.5px] text-white uppercase shadow-lg ring-1 ring-white/25">
              {anuncio.texto}
            </span>
          </div>
        )}
        <Mesa
          asientos={enMesa}
          mesa={[...mesa, ...Array(5 - mesa.length).fill(null)]}
          eligiendo={null}
          bote={bote}
          dinero={money}
          haciaGanador={e?.final?.ganadores[0] ?? null}
          onAsiento={() => {}}
          onCarta={() => {}}
        />
      </div>

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
                {!e.final && (
                  /* De dónde juegas esta mano: el botón se mueve y con él cambia todo. */
                  /* Sin "vas de": los lugares se llaman "antes del botón" o "a media
                     mesa" y con preposición delante no hay frase que aguante. */
                  <span className="font-sans text-[12px] font-semibold text-ink-soft">
                    {' · '}
                    {(asientos.find((a) => a.indice === heroe)?.nombre ?? '').toLowerCase()}
                  </span>
                )}
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

            {/* Lo que hubiera pasado si te quedas. Es la pregunta que deja una tirada, y
                sin contestarla no se puede saber si estuvo bien hecha. */}
            {e.final && (
              <div
                className={`mb-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-snug ${
                  e.final.eraLaMejor ? 'bg-[#f0a81e]/18 text-ink' : 'bg-ink/6 text-ink'
                }`}
              >
                {e.final.eraLaMejor ? (
                  sigoVivo ? (
                    <>
                      <b>Tu mano era la mejor de la mesa.</b> Bien jugada.
                    </>
                  ) : consejo && !consejo.bien ? (
                    <>
                      <b>Tu mano era la mejor de la mesa</b> y te fuiste. Ahí sí se dejó ir
                      dinero.
                    </>
                  ) : (
                    <>
                      <b>Tu mano era la mejor de la mesa</b>, pero con esas cuentas tirarla era
                      lo correcto. No se juzga por cómo salió: a la larga eso gana.
                    </>
                  )
                ) : (
                  <>
                    La mejor era la de <b>{e.final.mejorDeTodas.map(nombreDe).join(' y ')}</b>
                    {sigoVivo ? '.' : ', así que no te perdiste de nada.'}
                  </>
                )}
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
          <BarraConRaya
              ganas={cuentas.tienes}
              necesitas={cuentas.necesitas}
              tono={veredicto.tono}
            />
        </section>
      )}

      {/* ---- qué tipo de jugador eres ----
          Una mano no dice nada: se gana con basura y se pierde con ases. Lo que dice
          algo es lo que se repite, y eso sólo se ve después de un rato. */}
      {resumen.manos > 0 && (
        <section className="panel">
          <p className="panel-title">
            <span>Cómo vas jugando</span>
          </p>

          {perfil ? (
            <div className="mb-3 rounded-xl bg-noche-linea px-3.5 py-3 text-paper">
              <span className="block text-[10.5px] font-bold tracking-[.6px] text-paper/70 uppercase">
                Juegas como
              </span>
              <b className="block font-display text-[24px] leading-tight">{perfil.nombre}</b>
              <span className="mt-1 block text-[12.5px] leading-snug text-paper/85">
                {perfil.ayuda}
              </span>
              <span className="mt-1.5 block text-[12.5px] leading-snug text-[#ffd98a]">
                {perfil.consejo}
              </span>
            </div>
          ) : (
            <p className="mt-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
              Con {MANOS_PARA_PERFIL} manos te digo qué tipo de jugador eres. Llevas{' '}
              <b className="text-ink">{resumen.manos}</b>.
            </p>
          )}

          {/*
           * La tabla de la mesa: tú y cada quien, con lo que se les ha visto hacer.
           *
           * Es la misma información con la que un jugador lee a otro en una noche larga
           * —a cuántas entra, cuántas sube— y verla al lado de la tuya es lo que enseña
           * a leerse a uno mismo.
           */}
          <div className="no-scrollbar -mx-1 mb-3 overflow-x-auto px-1">
            <table className="w-full border-collapse text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
                  <th className="px-1 pb-2 font-semibold">Jugador</th>
                  <th className="px-1 pb-2 text-right font-semibold">Fichas</th>
                  <th className="px-1 pb-2 text-right font-semibold">Entra</th>
                  <th className="px-1 pb-2 text-right font-semibold">Sube</th>
                  <th className="px-1 pb-2 text-right font-semibold">Manos</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p, i) => {
                  const yo = i === 0
                  const entra = p.manos > 0 ? Math.round((p.jugadas / p.manos) * 100) : null
                  const sube = p.jugadas > 0 ? Math.round((p.subio / p.jugadas) * 100) : null
                  return (
                    <tr key={i} className="border-t border-dashed border-paper-line">
                      <td className="max-w-[108px] truncate px-1 py-2">
                        <span className="flex items-center gap-1.5">
                          {p.foto && <Cara nombre={p.nombre} foto={p.foto} size={20} />}
                          <span className={`truncate font-semibold ${yo ? 'text-marca-tinta' : 'text-ink'}`}>
                            {p.nombre}
                          </span>
                        </span>
                        {verEstilos && !yo && (
                          <span className="block text-[10px] leading-tight text-ink-soft">
                            {estiloPorId(p.rival.base).nombre}
                          </span>
                        )}
                        {yo && perfil && (
                          <span className="block text-[10px] leading-tight text-ink-soft">
                            {perfil.nombre}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-right font-display tabular-nums text-ink">
                        {money(p.fichas)}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-ink-soft">
                        {entra === null ? '—' : `${entra}%`}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-ink-soft">
                        {sube === null ? '—' : `${sube}%`}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-ink-soft">{p.manos}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-0 mb-3 text-[11.5px] leading-snug text-ink-soft">
            <b className="text-ink">Entra</b> es a cuántas manos le pone dinero por gusto, sin
            contar las ciegas; <b className="text-ink">sube</b>, de ésas, en cuántas toma la
            iniciativa. El que entra a muchas y casi no sube es el que paga la cena.
            {tino !== null && (
              <>
                {' '}De tus decisiones con algo que pagar, le has atinado al{' '}
                <b className="text-ink">{Math.round(tino)}%</b>.
              </>
            )}
          </p>

          {historial.length > 0 && (
            <>
              <p className="field-label mt-0 mb-1.5">Lo que llevas decidido</p>
              <ul className="m-0 list-none p-0">
                {historial.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 border-b border-dashed border-paper-line py-1.5 last:border-b-0"
                  >
                    {a.bien ? (
                      <Check size={13} strokeWidth={3} className="mt-0.5 shrink-0 text-win" />
                    ) : (
                      <X size={13} strokeWidth={3} className="mt-0.5 shrink-0 text-loss" />
                    )}
                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">
                      <b className="text-ink-soft">Mano {a.mano}</b> · {a.texto}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
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

        <label className="mb-3 block">
          <span className="field-label mt-0 mb-1.5 block">Con cuánto se sientan</span>
          <span className="field-box block">
            <NumInput
              value={entrada}
              mode="decimal"
              aria-label="Con cuánto se sienta cada quien"
              onChange={(v) => setEntrada(Math.max(0, v))}
            />
          </span>
          <span className="mt-1 block text-[11.5px] leading-snug text-ink-soft">
            Con ciegas de $1 y $2, {money(200)} son cien ciegas grandes, que es lo normal.
            Ponle lo que juegan en tu mesa.
          </span>
        </label>

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
