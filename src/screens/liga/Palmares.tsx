import { Trophy } from 'lucide-react'
import Avatar from '../../components/Avatar'
import type { LaureaDeTemporada } from '../../lib/api'
import { moneyShort } from '../../lib/money'
import { cuandoCorre } from '../../lib/temporadas'

/*
 * El palmarés: quién ganó cada temporada.
 *
 * Vive en la vista de "Siempre" —la historia de la liga— y no en la tabla de la
 * temporada que se está jugando, que es otra conversación. Es lo que le faltaba a
 * cerrar el semestre en diciembre: que quede escrito quién se lo llevó.
 *
 * La temporada que todavía corre también sale, pero dice "va ganando" en vez de
 * "campeón": nombrar campeón a alguien en octubre es la manera más rápida de que la
 * mesa deje de creerle a la app.
 */
export default function Palmares({ palmares }: { palmares: LaureaDeTemporada[] }) {
  if (palmares.length === 0) return null

  return (
    <section className="panel">
      <p className="panel-title">
        <Trophy size={15} strokeWidth={2.6} />
        <span>Palmarés</span>
      </p>

      <ul className="m-0 list-none p-0">
        {palmares.map((l) => (
          <li
            key={l.temporada.id}
            className="border-b border-dashed border-paper-line py-3 last:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <b className="min-w-0 flex-1 truncate text-[14px] text-ink">
                {l.temporada.nombre}
              </b>
              <span className="shrink-0 text-[11.5px] text-ink-soft">
                {l.noches === 0
                  ? 'sin noches'
                  : `${l.noches} ${l.noches === 1 ? 'noche' : 'noches'}`}
                {!l.terminada && ' · en juego'}
              </span>
            </div>
            <div className="mt-0.5 mb-2 text-[11.5px] text-ink-soft">
              {cuandoCorre(l.temporada)}
            </div>

            {l.campeon === null ? (
              <p className="m-0 text-[13px] text-ink-soft">
                Todavía no se ha cerrado ninguna noche de esta temporada.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <Avatar foto={l.campeon.foto} nombre={l.campeon.nombre} size={34} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] text-ink">{l.campeon.nombre}</b>
                    <span className="text-[12px] text-ink-soft">
                      {l.terminada ? 'Campeón' : 'Va ganando'} · {l.campeon.puntos} pts ·{' '}
                      <span
                        className={
                          l.campeon.balance > 0
                            ? 'text-win'
                            : l.campeon.balance < 0
                              ? 'text-loss'
                              : ''
                        }
                      >
                        {moneyShort(l.campeon.balance)}
                      </span>
                    </span>
                  </div>
                  {l.terminada && (
                    <Trophy size={18} strokeWidth={2.4} className="shrink-0 text-marca-tinta" />
                  )}
                </div>

                {/* El campeonato lo gana la constancia, no el dinero: cuando no son el
                    mismo, el que más se llevó también merece su renglón. */}
                {l.dinero && (
                  <div className="mt-2 flex items-center gap-2.5 border-t border-dashed border-paper-line pt-2">
                    <Avatar foto={l.dinero.foto} nombre={l.dinero.nombre} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
                      <b className="font-semibold text-ink">{l.dinero.nombre}</b> fue quien más
                      se llevó
                    </span>
                    <span className="shrink-0 text-[12.5px] font-bold text-win">
                      {moneyShort(l.dinero.balance)}
                    </span>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
