import { Medal } from 'lucide-react'

/** Oro, plata y bronce. A partir del 4º lugar no hay medalla. */
const TONOS = ['#d9b063', '#b9b3a4', '#a9764a']

interface Props {
  /** 1 = primero. */
  lugar: number
  size?: number
}

export default function Medalla({ lugar, size = 17 }: Props) {
  const tono = TONOS[lugar - 1]
  if (!tono) return null
  return (
    <Medal
      size={size}
      strokeWidth={2.2}
      style={{ color: tono }}
      aria-label={`${lugar}º lugar`}
      className="shrink-0"
    />
  )
}
