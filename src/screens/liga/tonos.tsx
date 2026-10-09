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
 * La barra con la raya: la gráfica de si se paga o no.
 *
 * Dos barras una encima de la otra pedían compararlas de un vistazo y eso no se hace
 * solo. Esto es una sola barra —lo que ganas— y una raya donde está el mínimo para que
 * pagar valga la pena. Si la barra pasa la raya, se paga; si no llega, se tira. No hay
 * nada más que entender, y es exactamente la misma cuenta.
 *
 * Lo que queda del otro lado de la raya también se pinta: es el margen que sobra, y es
 * lo que de verdad se está ganando al pagar.
 */
export function BarraConRaya({
  ganas,
  necesitas,
  tono,
}: {
  ganas: number
  necesitas: number
  tono: Tono
}) {
  const raya = Math.max(0, Math.min(100, necesitas))
  const barra = Math.max(0, Math.min(100, ganas))
  const pasa = barra >= raya

  return (
    <div className="mt-3">
      {/* La raya, con su nombre encima, para que se lea antes que la barra. */}
      <div className="relative mb-1 h-4">
        <span
          className="absolute -translate-x-1/2 text-[10px] leading-none font-bold tracking-[.3px] text-ink-soft uppercase whitespace-nowrap"
          style={{ left: `${Math.min(88, Math.max(12, raya))}%` }}
        >
          Mínimo {Math.round(raya)}
        </span>
      </div>

      <div className="relative h-7 overflow-hidden rounded-lg bg-ink/10">
        <div
          className={`h-full ${BARRAS[tono]} transition-[width] duration-300`}
          style={{ width: `${barra}%` }}
        />
        {/* La raya va encima de todo: es contra lo que se compara. */}
        <div
          className="absolute inset-y-0 w-[3px] bg-ink"
          style={{ left: `calc(${raya}% - 1.5px)` }}
        />
        <span className="absolute inset-y-0 right-2 flex items-center font-display text-[13px] font-bold text-ink tabular-nums">
          {Math.round(barra)} de cada 100
        </span>
      </div>

      <p className="mt-1.5 mb-0 text-[12.5px] leading-snug text-ink">
        {pasa ? (
          <>
            Tu barra <b>pasa la raya</b>: ganas más veces de las que te hacen falta, así que
            pagar sale a cuentas.
          </>
        ) : (
          <>
            Tu barra <b>no llega a la raya</b>: ganas menos veces de las que te hacen falta,
            así que pagar sale caro.
          </>
        )}
      </p>
    </div>
  )
}
