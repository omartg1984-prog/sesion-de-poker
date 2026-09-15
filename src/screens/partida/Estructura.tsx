import { AlertTriangle, Timer } from 'lucide-react'
import { useState } from 'react'
import { calcularEstructura, type Estructura as Tabla } from '../../lib/torneo'
import TablaCiegas from './TablaCiegas'

/*
 * De cuánto son las ciegas y cada cuánto suben, con el torneo ya empezado.
 *
 * La escalera nace armada en el asistente de creación; esto es para moverla en caliente:
 * llegó gente tarde, se decidió acabar antes, hay que meter otro descanso. El stack y el
 * valor de las fichas no se tocan aquí —vienen de lo que se definió abajo— para no tener
 * el mismo campo en dos lugares de la misma pantalla.
 *
 * Lo que se guarda es la tabla ya calculada, no los parámetros, para que no se mueva sola
 * a media noche si alguien cambia otra cosa.
 */

const DURACIONES = [90, 120, 180, 240]
const NIVELES = [10, 15, 20, 30]
const CADA_CUANTOS = [0, 3, 4, 6]
const DURACION_DESCANSO = [10, 15, 20, 30]

interface Props {
  jugadores: number
  /** Con cuántas fichas arranca cada quien, según lo que se definió en el torneo. */
  stack: number
  /** La ficha más chica que va a estar en la mesa: la ciega chica tiene que pagarse con ella. */
  fichaMasChica: number
  /** Todas las denominaciones, para saber en qué corte sale cada una de la mesa. */
  valores?: number[]
  estructura: Tabla | null
  puedeEditar: boolean
  /** Hora a la que se quedó de arrancar, para poner la tabla en hora de reloj. */
  horaInicio?: string
  /** Segundos corridos del reloj, si ya arrancó: con eso las horas son las de verdad. */
  corridosSeg?: number | null
  onGuardar: (e: Tabla) => void
}

export default function Estructura({
  jugadores,
  stack,
  fichaMasChica,
  valores,
  estructura,
  puedeEditar,
  horaInicio,
  corridosSeg,
  onGuardar,
}: Props) {
  const [duracion, setDuracion] = useState(estructura?.duracionMinutos ?? 180)
  const [porNivel, setPorNivel] = useState(estructura?.minutosPorNivel ?? 15)
  const [cadaNiveles, setCadaNiveles] = useState(estructura?.descanso?.cadaNiveles ?? 4)
  const [minDescanso, setMinDescanso] = useState(estructura?.descanso?.minutos ?? 20)

  const vistaPrevia = calcularEstructura({
    jugadores: Math.max(2, jugadores),
    stackInicial: stack,
    fichaMasChica,
    valores,
    minutosDeseados: duracion,
    minutosPorNivel: porNivel,
    descanso: cadaNiveles > 0 ? { cadaNiveles, minutos: minDescanso } : null,
  })
  const mostrada = estructura ?? vistaPrevia

  const Opciones = ({
    valor,
    opciones,
    sufijo,
    onElegir,
  }: {
    valor: number
    opciones: number[]
    sufijo: string
    onElegir: (v: number) => void
  }) => (
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
          {o}
          {sufijo}
        </button>
      ))}
    </div>
  )

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Ciegas y reloj</span>
      </p>

      {puedeEditar && (
        <>
          <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
            Arrancan con {Math.round(stack).toLocaleString('es-MX')} fichas. Dile cuánto quieres
            que dure y las ciegas se calculan solas para que termine a esa hora, descansos
            incluidos.
          </p>

          <div className="mb-3">
            <span className="field-label">Cuánto quieres que dure (minutos)</span>
            <div className="mt-1">
              <Opciones valor={duracion} opciones={DURACIONES} sufijo="" onElegir={setDuracion} />
            </div>
          </div>

          <div className="mb-3">
            <span className="field-label">Cada cuánto suben (minutos)</span>
            <div className="mt-1">
              <Opciones valor={porNivel} opciones={NIVELES} sufijo="" onElegir={setPorNivel} />
            </div>
          </div>

          <div className="mb-3">
            <span className="field-label">Descanso cada cuántos niveles</span>
            <div className="mt-1 flex gap-1.5">
              {CADA_CUANTOS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setCadaNiveles(o)}
                  className={`flex-1 cursor-pointer rounded-lg border-none px-1 py-2 text-[13px] font-bold transition-colors ${
                    cadaNiveles === o ? 'bg-marca text-white' : 'bg-[#e6e1d8] text-ink-soft'
                  }`}
                >
                  {o === 0 ? 'Sin' : o}
                </button>
              ))}
            </div>
          </div>

          {cadaNiveles > 0 && (
            <div className="mb-3">
              <span className="field-label">De cuántos minutos</span>
              <div className="mt-1">
                <Opciones
                  valor={minDescanso}
                  opciones={DURACION_DESCANSO}
                  sufijo=""
                  onElegir={setMinDescanso}
                />
              </div>
            </div>
          )}

          {vistaPrevia.aviso && (
            <div className="balance balance-off">
              <AlertTriangle size={16} strokeWidth={2.4} />
              <span>{vistaPrevia.aviso}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-marca mb-3"
            onClick={() => onGuardar(vistaPrevia)}
          >
            <Timer size={17} strokeWidth={2.4} />
            {estructura ? 'Recalcular las ciegas' : 'Usar esta estructura'}
          </button>
        </>
      )}

      {puedeEditar && estructura && (
        <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
          Puedes cambiar cualquier ciega a mano; la grande se ajusta al doble. Recalcular vuelve a
          poner las de la fórmula.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="stat">
          <div className="stat-k">Arranca con</div>
          <div className="stat-v">{Math.round(mostrada.profundidad)} ciegas</div>
        </div>
        <div className="stat">
          <div className="stat-k">Va a durar</div>
          <div className="stat-v">{Math.round(mostrada.duracionMinutos / 60)} h</div>
        </div>
      </div>

      <div className="mt-3">
        <TablaCiegas
          estructura={mostrada}
          horaInicio={horaInicio ?? null}
          corridosSeg={corridosSeg}
          onCambiar={puedeEditar && estructura ? onGuardar : undefined}
        />
      </div>
    </section>
  )
}
