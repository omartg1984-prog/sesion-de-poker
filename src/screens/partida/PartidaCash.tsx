import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import ContadorFichas from '../../components/ContadorFichas'
import NumInput from '../../components/NumInput'
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
  CompartirReparto,
  FichasDelJugador,
  GuardarConteo,
  InventarioUsado,
  ListaDeLaMesa,
  calcularRepartoCash,
  claseClara,
  finalDe,
  idFila,
  invertidoDe,
  manualesDe,
  recomprasDe,
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
  puedeContar,
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
     del inventario es lo mismo que tiene que volver en el cash out. Van en renglones
     aparte —uno por concepto— porque es lo que se entrega de una vez en la mano. */
  const reparto = calcularRepartoCash(datos.participaciones, colores)
  const cuadre = calcularCuadre(datos.participaciones, colores, reparto, invertidoDe)

  /* ---- jugadores y sus recompras ---- */
  if (pestana === 'jugadores') {
    const cambiarRecompras = (id: string, lista: Recompra[]) =>
      tocar(id, { recompras: JSON.stringify(lista) }, { recompras: lista })

    return (
      <>
        <ListaDeLaMesa
          filas={conTotales.map((p) => ({ id: p.id, nombre: p.nombre, monto: p.invertido }))}
        />

        {conTotales.map((p, i) => {
          const recompras = recomprasDe(p)
          /* Guardar un reparto a mano toca sólo su concepto: corregir las fichas de la
             recompra 2 no debe mover las que ya se entregaron en la entrada. */
          const guardarFichas = (clave: string) => (fichas: Chips | null) => {
            const manuales = { ...manualesDe(p) }
            if (fichas) manuales[clave] = fichas
            else delete manuales[clave]
            const vacio = Object.keys(manuales).length === 0
            tocar(
              p.id,
              { fichas_manual: vacio ? null : JSON.stringify(manuales) },
              { fichasManual: vacio ? null : manuales },
            )
          }
          const filaDe = (clave: string) =>
            reparto.rows.find((r) => r.id === idFila(p.id, clave))
          const entrada = filaDe('entrada')
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

              {/* Las fichas van arriba de las recompras: lo primero que se hace al
                  registrar a alguien es entregarle su pila. */}
              {entrada && (
                <FichasDelJugador
                  fila={entrada}
                  colores={colores}
                  puedeEditar={puedeEditar}
                  guardar={guardarFichas('entrada')}
                  rotulo="Fichas de entrada"
                />
              )}

              <div className="mt-3" />

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

                  {/* Las fichas de esta recompra y de ninguna otra: es la pila que se
                      le pasa en el momento de pagarla. */}
                  {(() => {
                    const suya = filaDe(`r${ri}`)
                    return (
                      suya && (
                        <FichasDelJugador
                          fila={suya}
                          colores={colores}
                          puedeEditar={puedeEditar}
                          guardar={guardarFichas(`r${ri}`)}
                          rotulo="Fichas a entregar"
                        />
                      )
                    )
                  })()}
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

        <InventarioUsado reparto={reparto} colores={colores} enDinero />

        <section className="panel">
          <p className="panel-title">
            <span>Mandar el reparto</span>
          </p>
          <CompartirReparto reparto={reparto} colores={colores} datos={datos} />
        </section>
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
          {/* Que cada quien cuente las suyas es lo que hace rápido el cash out. */}
          <p className="mt-2 mb-0 text-[12px] leading-snug text-ink-soft">
            Cualquiera de la mesa puede capturar un conteo, no hace falta ser admin. Debajo de cada
            uno queda apuntado quién lo puso.
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
                deshabilitado={!puedeContar}
                onChange={(key, v) => {
                  const nuevas = { ...fichas, [key]: v }
                  tocar(p.id, { fichas_final: JSON.stringify(nuevas) }, { fichasFinal: nuevas })
                }}
              />

              <GuardarConteo
                id={p.id}
                fichas={fichas}
                contado={yaContado}
                deshabilitado={!puedeContar}
              />

              {/* Lo que cobra y lo que se le dio, uno al lado del otro: es la
                  comparación que se hace en la mesa al momento de pagarle. */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-noche-linea px-3 py-2.5 text-paper">
                  <span className="block text-[10px] tracking-[.6px] uppercase opacity-70">
                    Tiene que cobrar
                  </span>
                  <b className="font-display text-2xl">{money(p.final)}</b>
                </div>
                <div className="rounded-xl border border-paper-line bg-white px-3 py-2.5">
                  <span className="block text-[10px] tracking-[.6px] text-ink-soft uppercase">
                    Se le dio
                  </span>
                  {puedeEditar ? (
                    <span className="flex items-baseline">
                      <span className="font-display text-xl font-bold text-ink-soft">$</span>
                      <NumInput
                        value={p.pagado ?? 0}
                        showZero={p.pagado !== null}
                        mode="decimal"
                        placeholder={String(Math.round(p.final))}
                        aria-label={`Dinero entregado a ${p.nombre}`}
                        className="w-full border-none bg-transparent p-0 font-display text-2xl font-bold outline-none"
                        onChange={(v) => tocar(p.id, { pagado: v }, { pagado: v })}
                      />
                    </span>
                  ) : (
                    <b className="font-display text-2xl text-ink">
                      {p.pagado === null ? '—' : money(p.pagado)}
                    </b>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-soft">
                <span>
                  Puso <b className="text-ink">{money(p.invertido)}</b>
                </span>
                {yaContado && p.contadas_por_nombre && (
                  <span className="truncate">las contó {p.contadas_por_nombre}</span>
                )}
                {p.pagado !== null && Math.abs(p.pagado - p.final) > EPS && (
                  <span className={p.pagado > p.final ? 'text-win' : 'text-loss'}>
                    {p.pagado > p.final ? '+' : '−'}
                    {money(Math.abs(p.pagado - p.final))} de cambio
                  </span>
                )}
                <b
                  className={`ml-auto font-display text-xl tabular-nums ${claseClara(p.pl)}`}
                >
                  {signed(p.pl)}
                </b>
              </div>
            </section>
          )
        })}

        <RepartoDinero
          filas={ranking.map((r) => ({ p: r, nombre: r.nombre, leToca: r.final }))}
          totalMesa={totalMesa}
          redondeo={datos.partida.redondeo ?? 50}
          puedeEditar={puedeEditar}
          titulo={datos.liga.nombre}
          subtitulo={datos.partida.nombre || datos.partida.fecha}
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
      const suyas = recomprasDe(r)
      if (suyas.length > 1)
        lineas.push(
          `   ${money(num(r.entrada))} + ${suyas.map((x) => money(num(x.dinero))).join(' + ')}`,
        )
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
        {ranking.map((r, i) => {
          const suyas = recomprasDe(r)
          return (
            <li
              key={r.id}
              className="border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex min-w-0 items-center gap-2">
                  {r.pl > EPS && <Medalla lugar={i + 1} />}
                  <span className="truncate text-ink">{r.nombre}</span>
                </span>
                <span className={`font-display font-bold ${claseClara(r.pl)}`}>
                  {signed(r.pl)}
                </span>
              </div>

              {/* Con varias recompras, \"puso $1,400\" no dice de dónde salió y al día
                  siguiente nadie se acuerda. Desglosadas, la cuenta se revisa sola. */}
              {suyas.length > 1 && (
                <p className="mt-1 mb-0 text-[11.5px] leading-snug text-ink-soft">
                  Entró con <b className="text-ink">{money(num(r.entrada))}</b> y{' '}
                  {suyas.length} recompras:{' '}
                  {suyas.map((x) => money(num(x.dinero))).join(' + ')} ={' '}
                  <b className="text-ink">{money(r.invertido)}</b>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <ShareBlock datos={datosImagen} texto={texto} alt="Tabla de resultados de la partida" />
    </section>
  )
}
