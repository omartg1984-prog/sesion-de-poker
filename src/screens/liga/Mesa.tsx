import Cara from '../../components/Cara'
import { PALOS, VALORES, paloDe, valorDe } from '../../lib/poker'

/*
 * La mesa vista desde arriba, como en la tele.
 *
 * Antes era un óvalo verde con círculos: se entendía, pero no se parecía a una mesa. Lo
 * que hace que una transmisión se lea de un vistazo no es el adorno, es que cada cosa
 * esté donde la mente la busca —la madera por fuera, el paño con su luz al centro, las
 * cartas comunes en medio, el bote debajo de ellas y cada quien con su placa, su foto,
 * sus cartas y lo que lleva apostado enfrente—. Eso es lo que está armado aquí.
 *
 * Todo se toca: las cinco cartas del centro abren el mazo y cada asiento abre su panel.
 */

const ROJO = (c: number) => paloDe(c) === 1 || paloDe(c) === 2

export interface AsientoEnMesa {
  /** Su lugar contando desde el botón, igual que en `asientosDe`. */
  indice: number
  nombre: string
  foto: string | null
  /** Si hay alguien de la liga sentado ahí. */
  ocupado: boolean
  /** 'D', 'CCH', 'CG' o vacío. */
  marca: string
  yo: boolean
  /** Las que se le saben: 0 o 2. */
  cartas: number[]
  /** Lo que se lleva, ya escrito. Vacío si no hay cuenta hecha. */
  pct: string
  /** Lo que tiene apostado en esta calle. */
  apuesta: number
  /** Ya se fue de la mano. */
  fuera: boolean
  /** Le toca hablar. */
  activo: boolean
  /** Lo último que hizo en esta calle: 'Paga $8', 'Sube $20', 'Se fue'… */
  accion: string
  /** Cómo juega, cuando se está entrenando contra la máquina. */
  estilo?: string
  /** Va ganando la mano. */
  manda: boolean
}

/** Dónde cae algo puesto en el asiento `i`, con el óvalo que se le pida. */
const sitio = (i: number, de: number, rx: number, ry: number) => {
  /* Empezando abajo, que es donde se sienta uno mismo al imaginarse la mesa. */
  const ang = Math.PI / 2 + (i / de) * Math.PI * 2
  return { left: `${50 + Math.cos(ang) * rx}%`, top: `${50 + Math.sin(ang) * ry}%` }
}

function CartaChica({ valor, chica }: { valor: number; chica?: boolean }) {
  return (
    <span
      className={`flex flex-col items-center justify-center rounded-[3px] bg-white font-display leading-none font-bold shadow-sm ${
        chica ? 'h-[23px] w-[17px] text-[10px]' : 'h-9 w-[26px] text-[13px]'
      } ${ROJO(valor) ? 'text-loss' : 'text-ink'}`}
    >
      <span>{VALORES[valorDe(valor)]}</span>
      <span className={chica ? 'text-[9px]' : 'text-[12px]'}>{PALOS[paloDe(valor)]}</span>
    </span>
  )
}

/** El reverso: dos cartas que están ahí pero no se saben. */
function Reverso() {
  return (
    <span className="h-[26px] w-[19px] rounded-[3px] bg-[#8d1f2d] shadow-sm ring-1 ring-black/30">
      <span className="block h-full w-full rounded-[3px] bg-[repeating-linear-gradient(45deg,transparent_0_2px,rgba(255,255,255,.18)_2px_4px)]" />
    </span>
  )
}

/** Una ficha con lo que alguien lleva apostado. */
function Ficha({ cuanto, dinero }: { cuanto: number; dinero: (n: number) => string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-black/55 py-[2px] pr-2 pl-[3px] ring-1 ring-white/20">
      <span className="h-3 w-3 rounded-full bg-[#d8232a] ring-[1.5px] ring-white/80" />
      <span className="font-display text-[10px] leading-none font-bold text-white tabular-nums">
        {dinero(cuanto)}
      </span>
    </span>
  )
}

interface Props {
  asientos: AsientoEnMesa[]
  /** Las cinco de en medio; null es un hueco por llenar. */
  mesa: (number | null)[]
  /** Cuál hueco de la mesa se está llenando, para marcarlo. */
  eligiendo: number | null
  bote: number
  dinero: (n: number) => string
  onAsiento: (i: number) => void
  onCarta: (i: number) => void
}

export default function Mesa({
  asientos,
  mesa,
  eligiendo,
  bote,
  dinero,
  onAsiento,
  onCarta,
}: Props) {
  const de = asientos.length
  /* Con mucha gente las placas se estorban: la mesa crece para que quepan. */
  const alto = de <= 6 ? 286 : 316

  return (
    <div className="relative mx-auto select-none" style={{ height: alto, maxWidth: 300 }}>
      {/* el mueble */}
      <div
        className="absolute inset-x-[30px] inset-y-[52px] rounded-[999px]"
        style={{
          background: 'linear-gradient(180deg,#7a4e28 0%,#5a3718 55%,#331d0c 100%)',
          boxShadow: '0 12px 26px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      />
      {/* el paño, con su luz al centro como la de la tele */}
      <div
        className="absolute inset-x-[42px] inset-y-[64px] rounded-[999px]"
        style={{
          background: 'radial-gradient(ellipse at 50% 34%, #17985a 0%, #0c7540 44%, #064a28 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.08), inset 0 10px 26px rgba(0,0,0,.33)',
        }}
      />
      {/* la línea de la pista, que es lo que le da el aire de mesa de verdad */}
      <div className="absolute inset-x-[49px] inset-y-[71px] rounded-[999px] border border-white/10" />

      {/* las cartas de en medio y el bote */}
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
        <div className="flex gap-1">
          {mesa.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onCarta(i)}
              aria-label={`Carta ${i + 1} de la mesa`}
              className={`flex h-9 w-[26px] cursor-pointer items-center justify-center rounded-[3px] border-none p-0 active:scale-95 ${
                c === null
                  ? `border border-dashed bg-black/20 ${
                      eligiendo === i ? 'border-[#ffd98a] bg-black/35' : 'border-white/30'
                    }`
                  : 'border-none bg-transparent'
              }`}
            >
              {c === null ? (
                <span className="font-display text-[14px] leading-none font-bold text-white/35">
                  +
                </span>
              ) : (
                <CartaChica valor={c} />
              )}
            </button>
          ))}
        </div>
        {bote > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-[3px] ring-1 ring-white/15">
            <span className="text-[8.5px] font-bold tracking-[1px] text-white/55 uppercase">
              Bote
            </span>
            <span className="font-display text-[13px] leading-none font-bold text-white tabular-nums">
              {dinero(bote)}
            </span>
          </span>
        )}
      </div>

      {/* la gente */}
      {asientos.map((a, i) => (
        <div
          key={a.indice}
          className="absolute z-10 flex w-[62px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2px]"
          style={sitio(i, de, 40, 40)}
        >
          {/* El botón del repartidor va pegado a su placa y no suelto en el paño: suelto
              le caía encima a las cartas del que está en esa silla. */}
          {a.marca === 'D' && (
            <span className="absolute -right-1.5 bottom-0 z-10 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-white font-display text-[9.5px] leading-none font-bold text-ink shadow">
              D
            </span>
          )}
          {/* La burbuja de lo que acaba de hacer, como en las transmisiones: con eso se
              sigue la mano mirando la mesa y no una lista. */}
          <span className="flex h-[15px] items-center">
            {a.accion && (
              <span
                className={`rounded-full px-1.5 py-[1px] text-[8.5px] leading-none font-bold tracking-[.2px] uppercase ring-1 ${
                  a.fuera
                    ? 'bg-black/60 text-white/60 ring-white/10'
                    : 'bg-black/75 text-white ring-white/25'
                }`}
              >
                {a.accion}
              </span>
            )}
          </span>
          <span className="flex h-[23px] gap-[2px]">
            {a.cartas.length === 2 ? (
              a.cartas.map((c) => <CartaChica key={c} valor={c} chica />)
            ) : a.fuera ? null : (
              <>
                <Reverso />
                <Reverso />
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => onAsiento(a.indice)}
            aria-label={`Asiento ${a.indice + 1}: ${a.nombre}`}
            className={`flex w-full cursor-pointer items-center gap-1 rounded-lg border-none py-[3px] pr-1 pl-[3px] text-left ring-1 transition-colors active:scale-95 ${
              a.fuera
                ? 'bg-black/55 opacity-45 ring-white/10'
                : a.activo
                  ? 'bg-[#f0a81e] ring-[#ffd98a]'
                  : a.yo
                    ? 'bg-marca ring-marca-alta'
                    : 'bg-black/65 ring-white/15'
            }`}
          >
            {/* La cara sólo cuando hay alguien: en un asiento vacío sería la inicial de
                "libre", que no dice nada. */}
            {(a.ocupado || a.yo) && <Cara nombre={a.nombre} foto={a.foto} size={18} />}
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[9.5px] leading-tight font-semibold ${
                  a.activo ? 'text-[#4a2f00]' : 'text-white'
                }`}
              >
                {a.nombre}
              </span>
              <span
                className={`block font-display text-[11px] leading-tight font-bold tabular-nums ${
                  a.activo ? 'text-[#4a2f00]' : a.manda ? 'text-[#7bf0a8]' : 'text-white/80'
                }`}
              >
                {a.fuera ? 'se fue' : a.pct || a.marca}
              </span>
            </span>
          </button>
          {/* Cómo juega ése, para poder leerlo: en la mesa de verdad eso se aprende con
              los años, aquí se dice para que la práctica sirva de algo. */}
          {a.estilo && (
            <span className="max-w-full truncate text-[8.5px] leading-none font-bold tracking-[.2px] text-white/55 uppercase">
              {a.estilo}
            </span>
          )}
        </div>
      ))}

      {/* lo que cada quien lleva apostado, enfrente de su lugar */}
      {asientos.map((a, i) =>
        a.apuesta > 0 ? (
          <div
            key={`f${a.indice}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={sitio(i, de, 27, 26)}
          >
            <Ficha cuanto={a.apuesta} dinero={dinero} />
          </div>
        ) : null,
      )}

    </div>
  )
}
