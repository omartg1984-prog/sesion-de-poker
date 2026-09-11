import { textOn } from '../lib/money'
import type { ChipColor } from '../store/types'

interface Props {
  color: ChipColor
  /** Diámetro en píxeles. */
  size?: number
}

/*
 * Ficha de póker: cuerpo del color, muescas en el canto, anillo punteado y el logo
 * en el disco central.
 *
 * El dibujo sale del color que se le pase, así que cualquier color que se agregue a
 * una liga —ahora o después— se ve igual sin tocar nada aquí.
 *
 * El centro lleva el logo, no el valor. A cambio, donde las fichas van en rejilla se
 * escribe el nombre del color al lado: sin número ni nombre, las cinco se verían
 * idénticas a 32 px.
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
      role="img"
      aria-label={`Ficha ${color.label || 'de la casa'} de ${color.value}`}
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

      <image href="/rey.png" x="21" y="21" width="58" height="58" />
    </svg>
  )
}
