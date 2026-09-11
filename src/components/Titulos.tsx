import {
  CalendarCheck,
  Crown,
  Fish,
  Flame,
  Landmark,
  Skull,
  Snowflake,
  Target,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { IdTitulo, Titulo } from '../lib/api'

/**
 * Los títulos son para presumir, así que cada uno se ve distinto: el del Rey se lleva
 * el rojo de la marca a sangre, los buenos van en verde, y los que no dan tanto
 * orgullo —el Cajero, el Batacazo, el que anda en seco— van en vino, que es parte
 * de la gracia.
 */
const ESTILO: Record<IdTitulo, { Icono: LucideIcon; clase: string }> = {
  rey: { Icono: Crown, clase: 'bg-marca text-white' },
  tiburon: { Icono: Fish, clase: 'bg-win/14 text-win-tinta' },
  palazo: { Icono: TrendingUp, clase: 'bg-win/14 text-win-tinta' },
  infalible: { Icono: Target, clase: 'bg-win/14 text-win-tinta' },
  racha: { Icono: Flame, clase: 'bg-win/14 text-win-tinta' },
  fiel: { Icono: CalendarCheck, clase: 'bg-marca/20 text-marca-tinta' },
  comefichas: { Icono: Utensils, clase: 'bg-marca/20 text-marca-tinta' },
  seco: { Icono: Snowflake, clase: 'bg-loss/10 text-loss' },
  cajero: { Icono: Landmark, clase: 'bg-loss/10 text-loss' },
  batacazo: { Icono: Skull, clase: 'bg-loss/10 text-loss' },
}

export function Insignia({ titulo, size = 11 }: { titulo: Titulo; size?: number }) {
  const { Icono, clase } = ESTILO[titulo.id]
  return (
    <span
      title={titulo.porque}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${clase}`}
    >
      <Icono size={size} strokeWidth={2.8} />
      {titulo.etiqueta}
    </span>
  )
}

export default function Titulos({ titulos, max }: { titulos: Titulo[]; max?: number }) {
  if (titulos.length === 0) return null
  const lista = max ? titulos.slice(0, max) : titulos
  return (
    <span className="flex flex-wrap items-center gap-1">
      {lista.map((t) => (
        <Insignia key={t.id} titulo={t} />
      ))}
    </span>
  )
}
