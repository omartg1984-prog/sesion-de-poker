import { AlertTriangle, Timer } from 'lucide-react'
import { useState } from 'react'
import NumInput from '../../components/NumInput'
import { calcularEstructura, type Estructura as Tabla } from '../../lib/torneo'
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

interface Props {
  jugadores: number
  colores: ChipColor[]
  estructura: Tabla | null
  puedeEditar: boolean
  onGuardar: (e: Tabla) => void
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

  const vistaPrevia = calcularEstructura({
    jugadores: Math.max(2, jugadores),
    stackInicial: stack,
    fichaMasChica,
    minutosDeseados: duracion,
    minutosPorNivel: porNivel,
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
            Dile con cuántas fichas arranca cada quien y cuánto quieres que dure. Las ciegas
            se calculan solas para que el torneo termine a esa hora.
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

          {vistaPrevia.aviso && (
            <div className="balance balance-off">
              <AlertTriangle size={16} strokeWidth={2.4} />
              <span>{vistaPrevia.aviso}</span>
            </div>
          )}

          <button type="button" className="btn btn-marca mb-3" onClick={() => onGuardar(vistaPrevia)}>
            <Timer size={17} strokeWidth={2.4} />
            {estructura ? 'Recalcular las ciegas' : 'Usar esta estructura'}
          </button>
        </>
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
            {mostrada.niveles.map((n) => (
              <tr key={n.nivel} className="border-t border-dashed border-paper-line">
                <td className="px-1 py-1.5 font-semibold text-ink">{n.nivel}</td>
                <td className="px-1 py-1.5 text-right font-display font-bold text-ink">
                  {n.chica} / {n.grande}
                </td>
                <td className="px-1 py-1.5 text-right text-ink-soft">
                  {Math.floor(n.desdeMinuto / 60)}:{String(n.desdeMinuto % 60).padStart(2, '0')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
