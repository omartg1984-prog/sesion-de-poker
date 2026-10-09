/*
 * Los tres colores con los que se contesta: verde se paga, amarillo está parejo, rojo se
 * tira. El gris es "todavía no hay nada que decidir", no un cuarto consejo.
 *
 * Viven aquí porque los usan las dos mitades del tab —la calculadora de la mesa y el
 * entrenador— y tienen que decir lo mismo en las dos: si en una el verde quisiera decir
 * otra cosa, el color dejaría de servir para contestar sin leer.
 */
export type Tono = 'verde' | 'ambar' | 'rojo' | 'gris'

export const FONDOS: Record<Tono, string> = {
  verde:
    'linear-gradient(180deg, rgba(23,152,90,.42) 0%, rgba(23,152,90,.10) 55%, rgba(23,152,90,.04) 100%)',
  ambar:
    'linear-gradient(180deg, rgba(240,168,30,.40) 0%, rgba(240,168,30,.10) 55%, rgba(240,168,30,.04) 100%)',
  rojo: 'linear-gradient(180deg, rgba(200,45,45,.42) 0%, rgba(200,45,45,.10) 55%, rgba(200,45,45,.04) 100%)',
  gris: 'linear-gradient(180deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 60%, transparent 100%)',
}

export const BARRAS: Record<Tono, string> = {
  verde: 'bg-[#17985a]',
  ambar: 'bg-[#e09612]',
  rojo: 'bg-[#c82d2d]',
  gris: 'bg-ink/30',
}

export const PEGADA: Record<Tono, string> = {
  verde: 'bg-[#13713f]',
  ambar: 'bg-[#9a6207]',
  rojo: 'bg-[#9c2020]',
  gris: 'bg-noche-linea',
}

/** La caja de la respuesta, sobre papel. */
export const CAJA: Record<Tono, string> = {
  verde: 'bg-win/12',
  ambar: 'bg-[#f0a81e]/18',
  rojo: 'bg-loss/12',
  gris: 'bg-ink/6',
}

export const TINTA: Record<Tono, string> = {
  verde: 'text-win-tinta',
  ambar: 'text-[#8a5c00]',
  rojo: 'text-loss',
  gris: 'text-ink-soft',
}

/** La respuesta pegada abajo: es lo único que se consulta a cada rato. */
export function BarraPegada({
  tono,
  titulo,
  linea,
}: {
  tono: Tono
  titulo: string
  linea: string
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white shadow-[0_-6px_18px_rgba(0,0,0,.35)] ${PEGADA[tono]}`}
    >
      <div className="mx-auto flex max-w-[640px] items-center gap-3">
        <b className="shrink-0 font-display text-[19px] leading-none tracking-[.5px] uppercase">
          {titulo}
        </b>
        <span className="min-w-0 flex-1 text-right text-[11.5px] leading-tight text-white/85">
          {linea}
        </span>
      </div>
    </div>
  )
}

/**
 * Las dos barras con las que se decide.
 *
 * Arriba lo que de verdad ganas, abajo lo que te bastaría ganar para que pagar salga a
 * mano. Si la de arriba es más larga, se paga. No hace falta entender un porcentaje para
 * leer dos barras, y es exactamente la misma cuenta.
 */
export function Barras({
  ganas,
  necesitas,
  tono,
}: {
  ganas: number
  necesitas: number
  tono: Tono
}) {
  const fila = (k: string, v: number, color: string) => (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-ink-soft">{k}</span>
        <b className="font-display text-[14px] text-ink tabular-nums">
          {Math.round(v)} de cada 100
        </b>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(2, Math.min(100, v))}%` }}
        />
      </div>
    </div>
  )
  return (
    <div className="mt-3">
      {fila('Las veces que ganas', ganas, BARRAS[tono])}
      {fila('Las que te bastarían', necesitas, 'bg-ink/35')}
    </div>
  )
}
