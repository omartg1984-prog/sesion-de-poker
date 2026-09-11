import { textOn } from '../lib/money'
import type { ChipColor } from '../store/types'

interface Props {
  color: ChipColor
  /** Diámetro en píxeles. */
  size?: number
}

/*
 * Ficha de póker de verdad, no un círculo de color: cuerpo del color, muescas en el
 * canto, anillo punteado y disco central claro.
 *
 * En el centro va el VALOR, no un palo: en la mesa lo que necesitas saber de un
 * vistazo es cuánto vale ese montón. Se dibuja en SVG para que los detalles aguanten
 * igual a 28 px que a 34.
 */

// 6 muescas repartidas en el canto. El radio del trazo es 44 y su circunferencia
// 2π·44 ≈ 276.5, así que cada muesca + hueco mide 276.5 / 6 ≈ 46.1.
const RADIO_CANTO = 44
const MUESCAS = 6
const PASO = (2 * Math.PI * RADIO_CANTO) / MUESCAS
const LARGO_MUESCA = PASO * 0.46

export default function Chip({ color, size = 28 }: Props) {
  const contraste = textOn(color.color)
  // Sobre fichas claras las muescas blancas desaparecerían; ahí van oscuras.
  const muesca = contraste === '#ffffff' ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.35)'

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,.3)]"
    >
      {/* cuerpo */}
      <circle cx="50" cy="50" r="48" fill={color.color} />
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="2" />

      {/* muescas del canto */}
      <circle
        cx="50"
        cy="50"
        r={RADIO_CANTO}
        fill="none"
        stroke={muesca}
        strokeWidth="12"
        strokeDasharray={`${LARGO_MUESCA} ${PASO - LARGO_MUESCA}`}
      />

      {/* disco central */}
      <circle cx="50" cy="50" r="31" fill="#f6f2e8" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="1.5" />

      {/* anillo punteado, el detalle que la hace leer como ficha */}
      <circle
        cx="50"
        cy="50"
        r="36"
        fill="none"
        stroke={muesca}
        strokeWidth="2"
        strokeDasharray="3 4"
      />

      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Oswald, Arial Narrow, sans-serif"
        fontWeight="700"
        fontSize={String(color.value).length > 2 ? 30 : 38}
        fill="#20281f"
      >
        {color.value}
      </text>
    </svg>
  )
}
