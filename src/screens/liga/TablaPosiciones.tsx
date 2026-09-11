import { Info, Trophy } from 'lucide-react'
import Medalla from '../../components/Medalla'
import { EPS, money, signed } from '../../lib/money'
import type { TablaPosiciones as Tabla } from '../../lib/api'

const claseSaldo = (v: number) =>
  v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft'

/** Acumulado de la liga: quién va arriba sumando todas las partidas cerradas. */
export default function TablaPosiciones({ tabla }: { tabla: Tabla | null }) {
  if (!tabla) {
    return <p className="panel m-0 text-center text-sm text-ink-soft">Cargando…</p>
  }

  if (tabla.posiciones.length === 0) {
    return (
      <section className="panel text-center">
        <Trophy size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
        <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Todavía sin números</p>
        <p className="mx-auto mb-0 max-w-[320px] text-[13px] leading-snug text-ink-soft">
          {tabla.partidasAbiertas > 0
            ? `Hay ${tabla.partidasAbiertas} ${tabla.partidasAbiertas === 1 ? 'partida abierta' : 'partidas abiertas'}. La tabla se llena cuando las cierres, porque hasta entonces las fichas no están contadas.`
            : 'Cuando cierres tu primera partida, aquí aparece quién va arriba en la liga.'}
        </p>
      </section>
    )
  }

  const lider = tabla.posiciones[0]

  return (
    <>
      {/* el que va arriba, en grande */}
      <div className="mb-3.5 flex items-center gap-3 rounded-xl bg-gradient-to-br from-[#2c3a26] to-[#1b241a] px-4 py-3.5 ring-1 ring-gold/25">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
          {lider.foto ? (
            <img src={lider.foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-gold-soft">
              {lider.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-[1px] text-mint-soft uppercase">Va arriba</div>
          <div className="truncate font-display text-xl font-bold text-gold-soft">{lider.nombre}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold text-gold-soft">{signed(lider.balance)}</div>
          <div className="text-[11px] text-mint-soft">
            {lider.partidas} {lider.partidas === 1 ? 'partida' : 'partidas'}
          </div>
        </div>
      </div>

      <section className="panel">
        <p className="panel-title">
          <span>Tabla de la liga</span>
        </p>

        <ul className="m-0 list-none p-0">
          {tabla.posiciones.map((p, i) => (
            <li
              key={p.usuarioId}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-ink-soft">
                {i < 3 ? <Medalla lugar={i + 1} size={16} /> : i + 1}
              </span>

              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink/8">
                {p.foto ? (
                  <img src={p.foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
                    {p.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] text-ink">{p.nombre}</b>
                <span className="block text-xs text-ink-soft">
                  {p.partidas} {p.partidas === 1 ? 'partida' : 'partidas'} · ganó {p.ganadas}
                </span>
              </span>

              <span className={`shrink-0 text-right font-display font-bold ${claseSaldo(p.balance)}`}>
                {signed(p.balance)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* detalle por jugador */}
      <section className="panel">
        <p className="panel-title">
          <span>El detalle</span>
        </p>
        <div className="no-scrollbar -mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
                <th className="px-1 pb-2 font-semibold">Jugador</th>
                <th className="px-1 pb-2 text-right font-semibold">Puso</th>
                <th className="px-1 pb-2 text-right font-semibold">Sacó</th>
                <th className="px-1 pb-2 text-right font-semibold">Mejor</th>
                <th className="px-1 pb-2 text-right font-semibold">Peor</th>
              </tr>
            </thead>
            <tbody>
              {tabla.posiciones.map((p) => (
                <tr key={p.usuarioId} className="border-t border-dashed border-paper-line">
                  <td className="max-w-[110px] truncate px-1 py-2 font-semibold text-ink">
                    {p.nombre}
                  </td>
                  <td className="px-1 py-2 text-right whitespace-nowrap text-ink-soft">
                    {money(p.invertido)}
                  </td>
                  <td className="px-1 py-2 text-right whitespace-nowrap text-ink-soft">
                    {money(p.recuperado)}
                  </td>
                  <td className="px-1 py-2 text-right whitespace-nowrap font-semibold text-win">
                    {p.mejor > EPS ? signed(p.mejor) : '—'}
                  </td>
                  <td className="px-1 py-2 text-right whitespace-nowrap font-semibold text-loss">
                    {p.peor < -EPS ? signed(p.peor) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-snug text-mint-soft">
        <Info size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
        <span>
          Suma {tabla.partidasContadas}{' '}
          {tabla.partidasContadas === 1 ? 'partida cerrada' : 'partidas cerradas'}.
          {tabla.partidasAbiertas > 0 &&
            ` Las ${tabla.partidasAbiertas} abiertas no cuentan hasta que se cierren: sin las fichas contadas, todos aparecerían perdiendo.`}
        </span>
      </p>
    </>
  )
}
