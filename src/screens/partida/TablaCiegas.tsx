import { Coffee } from 'lucide-react'
import NumInput from '../../components/NumInput'
import { horaMas, tramosDe, type Estructura as Tabla } from '../../lib/torneo'

/*
 * La escalera de ciegas, con sus descansos intercalados.
 *
 * Vive aparte porque se ve en dos lados: al planear el torneo, antes de que exista la
 * partida, y en la pestaña del torneo ya empezado. Es la misma tabla y tiene que verse
 * igual en los dos.
 */

/* Cambiar una ciega a mano deja la tabla fuera de la fórmula, y está bien: el
   calculador propone, pero la mesa manda. */
export function conNivelCambiado(e: Tabla, indice: number, chica: number): Tabla {
  return {
    ...e,
    niveles: e.niveles.map((n, i) => (i === indice ? { ...n, chica, grande: chica * 2 } : n)),
  }
}

interface Props {
  estructura: Tabla
  /** Hora a la que se arranca. Sin ella se muestran los minutos corridos del torneo. */
  horaInicio?: string | null
  /** Sin esto la tabla sólo se lee. */
  onCambiar?: (e: Tabla) => void
}

export default function TablaCiegas({ estructura, horaInicio, onCambiar }: Props) {
  const cuando = (minuto: number) =>
    horaInicio
      ? horaMas(horaInicio, minuto)
      : `${Math.floor(minuto / 60)}:${String(minuto % 60).padStart(2, '0')}`

  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[13px] whitespace-nowrap">
        <thead>
          <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
            <th className="px-1 pb-2 font-semibold">Nivel</th>
            <th className="px-1 pb-2 text-right font-semibold">Ciegas</th>
            <th className="px-1 pb-2 text-right font-semibold">
              {horaInicio ? 'A las' : 'Entra a las'}
            </th>
          </tr>
        </thead>
        <tbody>
          {tramosDe(estructura).map((t, i) =>
            t.tipo === 'descanso' ? (
              <tr key={`d${i}`} className="border-t border-dashed border-paper-line bg-paper-soft">
                <td className="px-1 py-1.5">
                  <Coffee size={14} strokeWidth={2.4} className="text-ink-soft" />
                </td>
                <td className="px-1 py-1.5 text-right text-[12px] font-semibold text-ink-soft">
                  Descanso de {t.minutos} min
                </td>
                <td className="px-1 py-1.5 text-right text-ink-soft">{cuando(t.desdeMinuto)}</td>
              </tr>
            ) : (
              <tr key={t.nivel.nivel} className="border-t border-dashed border-paper-line">
                <td className="px-1 py-1.5 font-semibold text-ink">{t.nivel.nivel}</td>
                <td className="px-1 py-1.5 text-right">
                  {onCambiar ? (
                    <span className="ml-auto flex w-[122px] items-center justify-end gap-1">
                      <span className="flex w-[58px] items-center rounded-lg border border-paper-line bg-white px-1">
                        <NumInput
                          value={t.nivel.chica}
                          showZero
                          mode="decimal"
                          aria-label={`Ciega chica del nivel ${t.nivel.nivel}`}
                          className="w-full border-none bg-transparent px-0.5 py-1 text-right font-display text-[15px] font-bold outline-none"
                          /* El índice del tramo no sirve: los descansos lo recorren. El
                             número de nivel sí apunta siempre al mismo renglón. */
                          onChange={(v) => onCambiar(conNivelCambiado(estructura, t.nivel.nivel - 1, v))}
                        />
                      </span>
                      <span className="font-display text-[15px] font-bold text-ink-soft">
                        / {t.nivel.grande}
                      </span>
                    </span>
                  ) : (
                    <span className="font-display font-bold text-ink">
                      {t.nivel.chica} / {t.nivel.grande}
                    </span>
                  )}
                </td>
                <td className="px-1 py-1.5 text-right text-ink-soft">{cuando(t.desdeMinuto)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}
