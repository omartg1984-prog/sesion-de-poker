import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import ContadorFichas from '../../components/ContadorFichas'
import Medalla from '../../components/Medalla'
import MoneyInput from '../../components/MoneyInput'
import ShareBlock from '../../components/ShareBlock'
import Inventario from './Inventario'
import RepartoDinero from './RepartoDinero'
import { calcularCuadre } from './cuadre'
import { leerJson } from '../../lib/api'
import { EPS, money, num, signed } from '../../lib/money'
import type { DatosCash } from '../../lib/shareImage'
import type { Chips } from '../../store/types'
import {
  FichasDelJugador,
  InventarioUsado,
  calcularReparto,
  claseClara,
  finalDe,
  invertidoDe,
  recomprasDe,
  tonoOscuro,
  type PropsPestana,
  type Recompra,
} from './comun'

export type PestanaCash = 'jugadores' | 'final' | 'resultado'

export const PESTANAS_CASH: { id: PestanaCash; label: string }[] = [
  { id: 'jugadores', label: 'Registro' },
  { id: 'final', label: 'Cash out' },
  { id: 'resultado', label: 'Resultado' },
]

export default function PartidaCash({
  pestana,
  datos,
  colores,
  puedeEditar,
  tocar,
  onRedondeo,
}: PropsPestana & { pestana: PestanaCash; onRedondeo: (paso: number) => void }) {
  const conTotales = datos.participaciones.map((p) => {
    const invertido = invertidoDe(p)
    const final = finalDe(p, colores)
    return { ...p, invertido, final, pl: final - invertido }
  })

  const totalMesa = conTotales.reduce((a, p) => a + p.invertido, 0)
  const totalFichas = conTotales.reduce((a, p) => a + p.final, 0)
  const diferencia = totalFichas - totalMesa
  const ranking = [...conTotales].sort((a, b) => b.pl - a.pl)

  /* Las fichas cubren todo lo que puso en la noche, entrada y recompras: así lo que sale
     del inventario es lo mismo que tiene que volver en el cash out. */
  const reparto = calcularReparto(datos.participaciones, colores, invertidoDe)
  const cuadre = calcularCuadre(datos.participaciones, colores, reparto, invertidoDe)

  /* ---- jugadores y sus recompras ---- */
  if (pestana === 'jugadores') {
    const cambiarRecompras = (id: string, lista: Recompra[]) =>
      tocar(id, { recompras: JSON.stringify(lista) }, { recompras: lista })

    return (
      <>
        {conTotales.map((p, i) => {
          const recompras = recomprasDe(p)
          const fila = reparto.rows.find((r) => r.id === p.id)
          return (
            <section key={p.id} className="panel">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-noche font-display text-[13px] text-white">
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
                <div
                  key={ri}
                  className="mb-2 rounded-xl border border-paper-line bg-paper-soft px-3 py-2"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <b className="text-[11px] tracking-[.5px] text-ink-soft uppercase">
                      Recompra {ri + 1}
                    </b>
                    {puedeEditar && (
                      <button
                        type="button"
                        aria-label={`Quitar recompra ${ri + 1} de ${p.nombre}`}
                        onClick={() =>
                          cambiarRecompras(
                            p.id,
                            recompras.filter((_, x) => x !== ri),
                          )
                        }
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

              {fila && (
                <FichasDelJugador
                  fila={fila}
                  colores={colores}
                  puedeEditar={puedeEditar}
                  tocar={tocar}
                />
              )}
            </section>
          )
        })}

        <InventarioUsado reparto={reparto} colores={colores} />
      </>
    )
  }

  /* ---- conteo final ---- */
  if (pestana === 'final') {
    const contados = conTotales.filter((p) => p.final > 0).length
    return (
      <>
        <section className="panel">
          <p className="panel-title">
            <span>Cash out</span>
          </p>
          <p className="m-0 text-[13px] leading-snug text-ink-soft">
            Cuenta las fichas de cada quien. Puedes teclear la cantidad o ir sumando con −/+. Llevas{' '}
            <b className="text-ink">
              {contados} de {conTotales.length}
            </b>
            .
          </p>
        </section>

        {conTotales.map((p) => {
          const fichas = leerJson<Chips>(p.fichas_final, {})
          const yaContado = p.final > 0
          return (
            <section
              key={p.id}
              className={`panel ${yaContado ? '' : 'opacity-95 ring-1 ring-marca/25'}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
                  {p.nombre}
                </b>
                {yaContado ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-win/12 px-2 py-0.5 text-[11px] font-bold text-win-tinta">
                    <Check size={11} strokeWidth={3} />
                    Contado
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-marca/20 px-2 py-0.5 text-[11px] font-bold text-marca-tinta">
                    Falta
                  </span>
                )}
              </div>

              <ContadorFichas
                colores={colores}
                fichas={fichas}
                deshabilitado={!puedeEditar}
                onChange={(key, v) => {
                  const nuevas = { ...fichas, [key]: v }
                  tocar(p.id, { fichas_final: JSON.stringify(nuevas) }, { fichasFinal: nuevas })
                }}
              />

              <div className="mt-3 flex items-center gap-3 rounded-xl bg-noche-linea px-3.5 py-3 text-paper">
                <span className="min-w-0">
                  <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
                    Puso
                  </span>
                  <b className="font-display text-base">{money(p.invertido)}</b>
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
                    Fichas
                  </span>
                  <b className="font-display text-base">{money(p.final)}</b>
                </span>
                <span
                  className="ml-auto font-display text-2xl font-bold tabular-nums"
                  style={{ color: tonoOscuro(p.pl) }}
                >
                  {signed(p.pl)}
                </span>
              </div>
            </section>
          )
        })}

        <RepartoDinero
          filas={ranking.map((r) => ({ p: r, nombre: r.nombre, leToca: r.final }))}
          totalMesa={totalMesa}
          redondeo={datos.partida.redondeo ?? 50}
          puedeEditar={puedeEditar}
          onRedondeo={onRedondeo}
          onPago={(id, pagado) => tocar(id, { pagado }, { pagado })}
        />

        <Inventario cuadre={cuadre} />
      </>
    )
  }

  /* ---- resultado ---- */
  const datosImagen: DatosCash = {
    tipo: 'cash',
    titulo: 'OnlyCards',
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
