import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import ChipsGrid from '../../components/ChipsGrid'
import Medalla from '../../components/Medalla'
import MoneyInput from '../../components/MoneyInput'
import ShareBlock from '../../components/ShareBlock'
import { leerJson } from '../../lib/api'
import { EPS, money, num, signed } from '../../lib/money'
import type { DatosCash } from '../../lib/shareImage'
import type { Chips } from '../../store/types'
import {
  PestanaReparto,
  calcularReparto,
  claseClara,
  finalDe,
  invertidoDe,
  recomprasDe,
  tonoOscuro,
  type PropsPestana,
  type Recompra,
} from './comun'

export type PestanaCash = 'jugadores' | 'reparto' | 'final' | 'resultado'

export const PESTANAS_CASH: { id: PestanaCash; label: string }[] = [
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'reparto', label: 'Reparto' },
  { id: 'final', label: 'Final' },
  { id: 'resultado', label: 'Resultado' },
]

export default function PartidaCash({
  pestana,
  datos,
  colores,
  puedeEditar,
  tocar,
}: PropsPestana & { pestana: PestanaCash }) {
  const conTotales = datos.participaciones.map((p) => {
    const invertido = invertidoDe(p)
    const final = finalDe(p, colores)
    return { ...p, invertido, final, pl: final - invertido }
  })

  const totalMesa = conTotales.reduce((a, p) => a + p.invertido, 0)
  const totalFichas = conTotales.reduce((a, p) => a + p.final, 0)
  const diferencia = totalFichas - totalMesa
  const ranking = [...conTotales].sort((a, b) => b.pl - a.pl)

  /* ---- jugadores y sus recompras ---- */
  if (pestana === 'jugadores') {
    const cambiarRecompras = (id: string, lista: Recompra[]) =>
      tocar(id, { recompras: JSON.stringify(lista) }, { recompras: lista })

    return (
      <>
        {conTotales.map((p, i) => {
          const recompras = recomprasDe(p)
          return (
            <section key={p.id} className="panel">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-felt font-display text-[13px] text-white">
                  {i + 1}
                </span>
                <b className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-ink">
                  {p.nombre}
                </b>
              </div>

              {puedeEditar ? (
                <MoneyInput
                  label="Entra con"
                  value={p.entrada}
                  onChange={(v) => tocar(p.id, { entrada: v }, { entrada: v })}
                />
              ) : (
                <p className="m-0 mb-2 text-[13px] text-ink-soft">
                  Entra con <b className="text-ink">{money(p.entrada)}</b>
                </p>
              )}

              {recompras.map((r, ri) => (
                <div key={ri} className="mb-2 rounded-xl border border-paper-line bg-paper-soft px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <b className="text-[11px] tracking-[.5px] text-ink-soft uppercase">
                      Recompra {ri + 1}
                    </b>
                    {puedeEditar && (
                      <button
                        type="button"
                        aria-label={`Quitar recompra ${ri + 1} de ${p.nombre}`}
                        onClick={() => cambiarRecompras(p.id, recompras.filter((_, x) => x !== ri))}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss"
                      >
                        <X size={13} strokeWidth={2.6} />
                      </button>
                    )}
                  </div>
                  {puedeEditar ? (
                    <MoneyInput
                      label="Dinero"
                      value={r.dinero}
                      onChange={(v) =>
                        cambiarRecompras(
                          p.id,
                          recompras.map((x, xi) => (xi === ri ? { dinero: v } : x)),
                        )
                      }
                    />
                  ) : (
                    <p className="m-0 text-[13px] text-ink-soft">
                      <b className="text-ink">{money(num(r.dinero))}</b>
                    </p>
                  )}
                </div>
              ))}

              {puedeEditar && (
                <button
                  type="button"
                  className="btn-dashed flex items-center justify-center gap-1.5"
                  onClick={() => cambiarRecompras(p.id, [...recompras, { dinero: 0 }])}
                >
                  <Plus size={15} strokeWidth={2.6} />
                  Agregar recompra
                </button>
              )}

              {recompras.length > 0 && (
                <p className="mt-2.5 mb-0 text-right text-xs text-ink-soft">
                  Lleva puesto: <b className="text-ink">{money(p.invertido)}</b>
                </p>
              )}
            </section>
          )
        })}
      </>
    )
  }

  /* ---- reparto ---- */
  if (pestana === 'reparto') {
    const reparto = calcularReparto(datos.participaciones, colores, (p) => num(p.entrada))
    return (
      <PestanaReparto
        reparto={reparto}
        colores={colores}
        puedeEditar={puedeEditar}
        tocar={tocar}
        nota="Las fichas con las que arranca cada quien, según lo que puso al entrar. Puedes editar a mano y los demás se reacomodan. Las recompras se entregan aparte."
      />
    )
  }

  /* ---- conteo final ---- */
  if (pestana === 'final') {
    return (
      <>
        {conTotales.map((p) => {
          const fichas = leerJson<Chips>(p.fichas_final, {})
          return (
            <section key={p.id} className="panel">
              <b className="mb-2.5 block truncate font-display text-lg font-semibold text-ink">
                {p.nombre}
              </b>
              <ChipsGrid
                colors={colores}
                chips={fichas}
                onChange={(key, v) => {
                  if (!puedeEditar) return
                  const nuevas = { ...fichas, [key]: v }
                  tocar(p.id, { fichas_final: JSON.stringify(nuevas) }, { fichasFinal: nuevas })
                }}
              />
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-felt-line px-3.5 py-2.5 text-[#eafff2]">
                <span className="text-[10px] tracking-[.6px] uppercase opacity-70">Puso</span>
                <b className="font-display">{money(p.invertido)}</b>
                <span className="ml-3 text-[10px] tracking-[.6px] uppercase opacity-70">Fichas</span>
                <b className="font-display">{money(p.final)}</b>
                <span
                  className="ml-auto font-display text-lg font-bold"
                  style={{ color: tonoOscuro(p.pl) }}
                >
                  {signed(p.pl)}
                </span>
              </div>
            </section>
          )
        })}
      </>
    )
  }

  /* ---- resultado ---- */
  const datosImagen: DatosCash = {
    tipo: 'cash',
    titulo: 'Sesión de Póker',
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    filas: conTotales.map((p) => ({
      nombre: p.nombre,
      entrada: num(p.entrada),
      recompra: recomprasDe(p).reduce((a, r) => a + num(r.dinero), 0),
      final: p.final,
      pl: p.pl,
    })),
    totalMesa,
  }

  const texto = () => {
    const lineas = [`🃏 ${datos.liga.nombre} · ${datos.partida.nombre || datos.partida.fecha}`, '']
    ranking.forEach((r, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i]
      lineas.push(`${r.pl > EPS && medalla ? medalla : '•'} ${r.nombre}: ${signed(r.pl)}`)
    })
    lineas.push('', `Total en la mesa: ${money(totalMesa)}`)
    return lineas.join('\n')
  }

  return (
    <section className="panel">
      <p className="panel-title">
        <span>Resultado</span>
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="stat">
          <div className="stat-k">Total en la mesa</div>
          <div className="stat-v">{money(totalMesa)}</div>
        </div>
        <div className="stat">
          <div className="stat-k">Fichas contadas</div>
          <div className="stat-v">{money(totalFichas)}</div>
        </div>
      </div>

      {Math.abs(diferencia) < EPS ? (
        <div className="balance balance-ok">
          <Check size={16} strokeWidth={2.6} />
          Las fichas cuadran con el dinero
        </div>
      ) : (
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          {diferencia > 0
            ? `Hay ${money(diferencia)} de más en fichas contadas`
            : `Faltan ${money(-diferencia)} en fichas contadas`}
        </div>
      )}

      <ul className="m-0 mb-3 list-none p-0">
        {ranking.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center justify-between border-b border-dashed border-paper-line py-2.5 font-semibold last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              {r.pl > EPS && <Medalla lugar={i + 1} />}
              <span className="truncate text-ink">{r.nombre}</span>
            </span>
            <span className={`font-display font-bold ${claseClara(r.pl)}`}>{signed(r.pl)}</span>
          </li>
        ))}
      </ul>

      <ShareBlock datos={datosImagen} texto={texto} alt="Tabla de resultados de la partida" />
    </section>
  )
}
