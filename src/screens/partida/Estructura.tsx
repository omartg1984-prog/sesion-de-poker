import { AlertTriangle, Coffee, Timer } from 'lucide-react'
import { useState } from 'react'
import NumInput from '../../components/NumInput'
import { calcularEstructura, tramosDe, type Estructura as Tabla } from '../../lib/torneo'
import type { ChipColor } from '../../store/types'

/*
 * De cuánto son las ciegas y cada cuánto suben.
 *
 * No se pide "dame estas ciegas" sino "somos tantos y queremos que dure tanto": el resto
 * sale de la matemática de torneos (ver src/lib/torneo.ts). Lo que se guarda es la tabla
 * ya calculada, no los parámetros, para que no se mueva sola a media noche si alguien
 * cambia el stack.
 */

const DURACIONES = [90, 120, 180, 240]
const NIVELES = [10, 15, 20, 30]
const CADA_CUANTOS = [0, 3, 4, 6]
const DURACION_DESCANSO = [10, 15, 20, 30]

interface Props {
  jugadores: number
  colores: ChipColor[]
  estructura: Tabla | null
  puedeEditar: boolean
  onGuardar: (e: Tabla) => void
}

/* Cambiar una ciega a mano deja la tabla fuera de la fórmula, y está bien: el
   calculador propone, pero la mesa manda. */
function conNivelCambiado(e: Tabla, indice: number, chica: number): Tabla {
  return {
    ...e,
    niveles: e.niveles.map((n, i) => (i === indice ? { ...n, chica, grande: chica * 2 } : n)),
  }
}

export default function Estructura({
  jugadores,
  colores,
  estructura,
  puedeEditar,
  onGuardar,
}: Props) {
  const fichaMasChica = Math.min(...colores.map((c) => Number(c.value) || 1), 1) || 1
  const [stack, setStack] = useState(estructura?.stackInicial ?? 1000)
  const [duracion, setDuracion] = useState(estructura?.duracionMinutos ?? 180)
  const [porNivel, setPorNivel] = useState(estructura?.minutosPorNivel ?? 15)
  const [cadaNiveles, setCadaNiveles] = useState(estructura?.descanso?.cadaNiveles ?? 4)
  const [minDescanso, setMinDescanso] = useState(estructura?.descanso?.minutos ?? 20)

  const vistaPrevia = calcularEstructura({
    jugadores: Math.max(2, jugadores),
    stackInicial: stack,
    fichaMasChica,
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
            Dile con cuántas fichas arranca cada quien y cuánto quieres que dure. Las ciegas se
            calculan solas para que el torneo termine a esa hora.
          </p>

          <div className="mb-3">
            <span className="field-label">Fichas con las que arranca cada quien</span>
            <div className="field-box mt-1">
              <NumInput
                value={stack}
                showZero
                mode="decimal"
                aria-label="Stack inicial"
                onChange={setStack}
              />
            </div>
          </div>

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

      <div className="no-scrollbar mt-3 -mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
              <th className="px-1 pb-2 font-semibold">Nivel</th>
              <th className="px-1 pb-2 text-right font-semibold">Ciegas</th>
              <th className="px-1 pb-2 text-right font-semibold">Entra a las</th>
            </tr>
          </thead>
          <tbody>
            {tramosDe(mostrada).map((t, i) =>
              t.tipo === 'descanso' ? (
                <tr
                  key={`d${i}`}
                  className="border-t border-dashed border-paper-line bg-paper-soft"
                >
                  <td className="px-1 py-1.5">
                    <Coffee size={14} strokeWidth={2.4} className="text-ink-soft" />
                  </td>
                  <td className="px-1 py-1.5 text-right text-[12px] font-semibold text-ink-soft">
                    Descanso de {t.minutos} min
                  </td>
                  <td className="px-1 py-1.5 text-right text-ink-soft">
                    {Math.floor(t.desdeMinuto / 60)}:{String(t.desdeMinuto % 60).padStart(2, '0')}
                  </td>
                </tr>
              ) : (
                ((n) => (
                  <tr key={n.nivel} className="border-t border-dashed border-paper-line">
                    <td className="px-1 py-1.5 font-semibold text-ink">{n.nivel}</td>
                    <td className="px-1 py-1.5 text-right">
                      {puedeEditar && estructura ? (
                        <span className="ml-auto flex w-[122px] items-center justify-end gap-1">
                          <span className="flex w-[58px] items-center rounded-lg border border-paper-line bg-white px-1">
                            <NumInput
                              value={n.chica}
                              showZero
                              mode="decimal"
                              aria-label={`Ciega chica del nivel ${n.nivel}`}
                              className="w-full border-none bg-transparent px-0.5 py-1 text-right font-display text-[15px] font-bold outline-none"
                              /* El índice del tramo no sirve: los descansos lo recorren. El número
                             de nivel sí apunta siempre al mismo renglón de la tabla. */
                              onChange={(v) =>
                                onGuardar(conNivelCambiado(estructura, n.nivel - 1, v))
                              }
                            />
                          </span>
                          <span className="font-display text-[15px] font-bold text-ink-soft">
                            / {n.grande}
                          </span>
                        </span>
                      ) : (
                        <span className="font-display font-bold text-ink">
                          {n.chica} / {n.grande}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-right text-ink-soft">
                      {Math.floor(t.desdeMinuto / 60)}:{String(t.desdeMinuto % 60).padStart(2, '0')}
                    </td>
                  </tr>
                ))(t.nivel)
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
