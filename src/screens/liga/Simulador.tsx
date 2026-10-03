import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Sheet from '../../components/Sheet'
import {
  PALOS,
  VALORES,
  carta,
  nombreDeLaMano,
  paloDe,
  simular,
  valorDe,
  type Simulacion,
} from '../../lib/poker'

/*
 * El simulador: con qué frecuencia gana tu mano.
 *
 * No adivina ni opina: reparte veinte mil veces lo que falta —las cartas de los rivales
 * y lo que queda por salir— y cuenta cuántas de esas veces ganas. Es la misma cuenta que
 * hacen los programas de los profesionales, sólo que explicada.
 *
 * La posición no entra en ese número y es a propósito: las cartas ganan lo mismo desde
 * donde sea. Lo que cambia con la posición es si conviene meterse, y eso se dice aparte
 * en vez de esconderlo dentro de un porcentaje que dejaría de ser cierto.
 */

/** Los siete huecos, en el orden en que salen las cartas. */
const HUECOS = [
  { i: 0, grupo: 'Tu mano', etiqueta: '1ª' },
  { i: 1, grupo: 'Tu mano', etiqueta: '2ª' },
  { i: 2, grupo: 'Flop', etiqueta: '1ª' },
  { i: 3, grupo: 'Flop', etiqueta: '2ª' },
  { i: 4, grupo: 'Flop', etiqueta: '3ª' },
  { i: 5, grupo: 'Turn', etiqueta: '' },
  { i: 6, grupo: 'River', etiqueta: '' },
] as const

const POSICIONES = [
  { id: 'temprana', label: 'Temprana', exige: 1.6 },
  { id: 'media', label: 'Media', exige: 1.35 },
  { id: 'tardia', label: 'Tardía', exige: 1.15 },
  { id: 'ciega', label: 'Ciega', exige: 1.25 },
] as const
type Posicion = (typeof POSICIONES)[number]['id']

const ROJO = (c: number) => paloDe(c) === 1 || paloDe(c) === 2

/** Una carta dibujada, o el hueco vacío si todavía no se elige. */
function Carta({
  valor,
  onClick,
  chica = false,
  activa = false,
}: {
  valor: number | null
  onClick?: () => void
  chica?: boolean
  activa?: boolean
}) {
  const vacia = valor === null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg border font-display leading-none font-bold transition-colors ${
        chica ? 'h-11 w-9 text-[15px]' : 'h-14 w-11 text-[19px]'
      } ${
        vacia
          ? `border-dashed bg-white/60 text-ink-soft/40 ${activa ? 'border-marca' : 'border-paper-line'}`
          : `border-paper-line bg-white ${ROJO(valor) ? 'text-loss' : 'text-ink'}`
      } ${onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
    >
      {vacia ? (
        '+'
      ) : (
        <>
          <span>{VALORES[valorDe(valor)]}</span>
          <span className={chica ? 'text-[13px]' : 'text-[16px]'}>{PALOS[paloDe(valor)]}</span>
        </>
      )}
    </button>
  )
}

export default function Simulador({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [cartas, setCartas] = useState<(number | null)[]>(Array(7).fill(null))
  const [eligiendo, setEligiendo] = useState<number | null>(null)
  const [rivales, setRivales] = useState(3)
  const [posicion, setPosicion] = useState<Posicion>('media')
  const [resultado, setResultado] = useState<Simulacion | null>(null)
  const [calculando, setCalculando] = useState(false)

  const mano = useMemo(() => cartas.slice(0, 2).filter((c): c is number => c !== null), [cartas])
  const mesa = useMemo(() => cartas.slice(2).filter((c): c is number => c !== null), [cartas])
  const usadas = useMemo(
    () => new Set(cartas.filter((c): c is number => c !== null)),
    [cartas],
  )

  /* La mesa sólo tiene sentido completa: medio flop no es una situación de juego. */
  const mesaValida = mesa.length === 0 || mesa.length === 3 || mesa.length === 4 || mesa.length === 5
  const sinHuecos =
    cartas.slice(2, 2 + mesa.length).every((c) => c !== null) &&
    cartas.slice(2 + mesa.length).every((c) => c === null)
  const listo = mano.length === 2 && mesaValida && sinHuecos

  /*
   * La simulación son veinte mil manos y bloquea el hilo un instante. Se manda al
   * siguiente turno del reloj para que el toque que la dispara se sienta inmediato.
   */
  useEffect(() => {
    if (!listo) {
      setResultado(null)
      return
    }
    setCalculando(true)
    const t = setTimeout(() => {
      setResultado(simular({ mano, mesa, rivales }))
      setCalculando(false)
    }, 30)
    return () => clearTimeout(t)
  }, [listo, rivales, cartas, mano, mesa])

  const poner = (valor: number) => {
    if (eligiendo === null) return
    setCartas((cs) => cs.map((c, i) => (i === eligiendo ? valor : c)))
    /* Salta al siguiente hueco vacío: elegir cinco cartas no debe ser diez toques. */
    setEligiendo((i) => {
      const siguiente = cartas.findIndex((c, k) => k > (i ?? -1) && c === null)
      return siguiente >= 0 ? siguiente : null
    })
  }

  const limpiar = () => {
    setCartas(Array(7).fill(null))
    setEligiendo(null)
    setResultado(null)
  }

  const trae = listo && mesa.length >= 3 ? nombreDeLaMano(mano, mesa) : ''
  /* Lo que te tocaría si todas las manos valieran igual: el punto de comparación. */
  const justo = 100 / (rivales + 1)
  const exige = POSICIONES.find((p) => p.id === posicion)!.exige
  const equidad = resultado ? resultado.gano + resultado.empate / 2 : 0
  const vale = equidad >= justo * exige

  const Barra = ({ pct, color }: { pct: number; color: string }) => (
    <div className="h-2 overflow-hidden rounded-full bg-ink/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, pct)}%` }} />
    </div>
  )

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Simulador de manos">
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        Pon tus cartas y las que ya estén en la mesa. La app reparte la mano veinte mil
        veces y cuenta cuántas ganas.
      </p>

      {/* ---- tus cartas y la mesa ---- */}
      {(['Tu mano', 'Flop', 'Turn', 'River'] as const).map((grupo) => {
        const huecos = HUECOS.filter((h) => h.grupo === grupo)
        return (
          <div key={grupo} className="mb-2.5 flex items-center gap-3">
            <span className="w-[62px] shrink-0 text-[12px] font-semibold text-ink-soft">
              {grupo}
            </span>
            <div className="flex gap-1.5">
              {huecos.map((h) => (
                <Carta
                  key={h.i}
                  valor={cartas[h.i]}
                  activa={eligiendo === h.i}
                  onClick={() => setEligiendo(eligiendo === h.i ? null : h.i)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ---- el mazo, para elegir ---- */}
      {eligiendo !== null && (
        <div className="mt-3 mb-3 rounded-xl border border-paper-line bg-paper-soft p-2">
          <p className="mt-0 mb-1.5 text-center text-[12px] font-semibold text-ink-soft">
            Elige la carta
          </p>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <div className="grid w-max gap-1" style={{ gridTemplateRows: 'repeat(4, auto)' }}>
              {PALOS.map((_, palo) => (
                <div key={palo} className="flex gap-1">
                  {/* De la A para abajo: las altas son las que se consultan, y así
                      quedan a la vista sin tener que arrastrar el renglón. */}
                  {VALORES.map((_, i) => VALORES.length - 1 - i).map((valor) => {
                    const c = carta(valor, palo)
                    const ocupada = usadas.has(c)
                    return (
                      <Carta
                        key={c}
                        valor={c}
                        chica
                        onClick={ocupada ? undefined : () => poner(c)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- contra cuántos y desde dónde ---- */}
      <div className="mt-3 mb-2">
        <span className="field-label">Contra cuántos juegas</span>
        <div className="mt-1 flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRivales(n)}
              className={`flex-1 cursor-pointer rounded-lg border-none py-2 text-[13px] font-bold transition-colors ${
                rivales === n ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className="field-label">Tu posición en la mesa</span>
        <div className="mt-1 flex gap-1.5">
          {POSICIONES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPosicion(p.id)}
              className={`flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[12px] font-bold whitespace-nowrap transition-colors ${
                posicion === p.id ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- el resultado ---- */}
      {!listo ? (
        <div className="balance balance-ok mb-2">
          <span>
            {mano.length < 2
              ? 'Pon tus dos cartas para empezar. La mesa puedes dejarla vacía.'
              : 'El flop va completo: pon las tres o quítalas.'}
          </span>
        </div>
      ) : (
        <section className="panel">
          <p className="panel-title">
            <span>{trae ? `Traes ${trae.toLowerCase()}` : 'Antes del flop'}</span>
          </p>

          {calculando || !resultado ? (
            <p className="m-0 py-6 text-center text-[13px] text-ink-soft">Repartiendo manos…</p>
          ) : (
            <>
              <div className="text-center">
                <div className="font-display text-[46px] leading-none font-bold text-win">
                  {resultado.gano.toFixed(1)}%
                </div>
                <div className="mt-1 text-[12px] text-ink-soft">de las veces ganas</div>
              </div>

              <ul className="m-0 mt-3 list-none p-0">
                {[
                  { k: 'Ganas', v: resultado.gano, color: 'bg-win' },
                  { k: 'Empatas', v: resultado.empate, color: 'bg-tiza' },
                  { k: 'Pierdes', v: resultado.perdi, color: 'bg-loss' },
                ].map((f) => (
                  <li key={f.k} className="mb-1.5 last:mb-0">
                    <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                      <span className="text-ink-soft">{f.k}</span>
                      <b className="font-display text-ink tabular-nums">{f.v.toFixed(1)}%</b>
                    </div>
                    <Barra pct={f.v} color={f.color} />
                  </li>
                ))}
              </ul>

              {/* Contra qué se compara: lo que te tocaría si todas las manos valieran
                  igual. Sin eso, un 25% no dice nada por sí solo. */}
              <p className="mt-3 mb-0 text-[12.5px] leading-snug text-ink-soft">
                Repartiendo a ciegas entre {rivales + 1} te tocaría{' '}
                <b className="text-ink">{justo.toFixed(1)}%</b>. Con estas cartas vas{' '}
                <b className={equidad >= justo ? 'text-win' : 'text-loss'}>
                  {equidad >= justo ? 'arriba' : 'abajo'}
                </b>{' '}
                de eso.
              </p>

              <div
                className={`mt-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-snug ${
                  vale ? 'bg-win/10 text-win-tinta' : 'bg-ink/8 text-ink-soft'
                }`}
              >
                <b>
                  {vale
                    ? `Desde posición ${POSICIONES.find((p) => p.id === posicion)!.label.toLowerCase()}, da para jugarla.`
                    : `Desde posición ${POSICIONES.find((p) => p.id === posicion)!.label.toLowerCase()}, está floja.`}
                </b>{' '}
                La posición no cambia el porcentaje de arriba —las cartas ganan lo mismo
                desde donde sea—; cambia cuánto margen necesitas, porque hablando primero
                juegas sin saber qué hicieron los demás.
              </div>
            </>
          )}
        </section>
      )}

      {cartas.some((c) => c !== null) && (
        <button type="button" className="btn btn-ghost mb-2" onClick={limpiar}>
          <RotateCcw size={16} strokeWidth={2.4} />
          Empezar de nuevo
        </button>
      )}
    </Sheet>
  )
}
