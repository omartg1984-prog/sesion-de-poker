import { AlertTriangle, Check } from 'lucide-react'
import Medalla from '../../components/Medalla'
import ShareBlock from '../../components/ShareBlock'
import { EPS, money, num, signed } from '../../lib/money'
import type { ConfigTorneo, Participacion } from '../../lib/api'
import type { DatosNumeros } from '../../lib/imagenTablas'
import { MEDALS } from '../../lib/lienzo'
import { finalDe, invertidoDe, recomprasDe, type PropsPestana } from './comun'
import { duracionLarga } from '../../lib/tiempo'
import { pagadoPor, bolsaDe } from './PartidaTorneo'

const claseSaldo = (v: number) => (v > EPS ? 'text-win' : v < -EPS ? 'text-loss' : 'text-ink-soft')
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`

/** Una tarjeta de "quién fue el más algo" de la noche. */
function Destacado({
  etiqueta,
  nombre,
  valor,
  tono,
}: {
  etiqueta: string
  nombre: string
  valor: string
  tono?: string
}) {
  return (
    <div className="stat">
      <div className="stat-k">{etiqueta}</div>
      <div className="mt-0.5 truncate font-display text-base font-semibold text-ink">{nombre}</div>
      <div className={`font-display text-lg font-bold ${tono ?? 'text-ink-soft'}`}>{valor}</div>
    </div>
  )
}

interface Props extends PropsPestana {
  torneo: ConfigTorneo
}

/** Las estadísticas de esta partida y nada más: el acumulado vive en la liga. */
export default function Numeros({ datos, colores, torneo }: Props) {
  const ps = datos.participaciones
  const esTorneo = datos.partida.tipo === 'torneo'

  if (ps.length === 0) {
    return (
      <section className="panel text-center">
        <p className="m-0 text-[13px] text-ink-soft">
          Los números aparecen cuando haya jugadores cargados.
        </p>
      </section>
    )
  }

  /* Cada quien: lo que puso, lo que sacó y el resultado. */
  const bolsa = esTorneo ? bolsaDe(ps, torneo) : 0
  const premioDe = (p: Participacion) => {
    const po = p.lugar ? torneo.payouts[p.lugar - 1] : undefined
    return po ? (bolsa * num(po.pct)) / 100 : 0
  }

  const filas = ps
    .map((p) => {
      const puso = esTorneo ? pagadoPor(p, torneo) : invertidoDe(p)
      const saco = esTorneo ? premioDe(p) : finalDe(p, colores)
      return {
        p,
        nombre: p.nombre,
        puso,
        saco,
        resultado: saco - puso,
        roi: puso > 0 ? ((saco - puso) / puso) * 100 : 0,
        recompras: esTorneo ? num(p.rebuys) : recomprasDe(p).length,
        montoRecompras: esTorneo
          ? num(p.rebuys) * num(torneo.rebuyPrice)
          : recomprasDe(p).reduce((a, r) => a + num(r.dinero), 0),
      }
    })
    .sort((a, b) => b.resultado - a.resultado)

  const mesa = filas.reduce((a, f) => a + f.puso, 0)
  const contado = filas.reduce((a, f) => a + f.saco, 0)
  const diferencia = contado - mesa
  const ganadores = filas.filter((f) => f.resultado > EPS).length
  const entradas = ps.map((p) => (esTorneo ? num(torneo.buyIn) : num(p.entrada)))
  const entradaPromedio = entradas.reduce((a, b) => a + b, 0) / entradas.length
  const totalRecompras = filas.reduce((a, f) => a + f.recompras, 0)
  const montoRecompras = filas.reduce((a, f) => a + f.montoRecompras, 0)
  /* Cuánto se compra cada vez que alguien recompra. No es lo mismo que el total: en
     una noche de tres recompras de $200 y una de $1,000 el total engaña. Cada recompra
     cuenta por sí sola, chica o grande. */
  const recompraPromedio = totalRecompras > 0 ? montoRecompras / totalRecompras : 0

  /* Cuánto se jugó de verdad: de la primera mano a la última. No hasta que se cerró la
     partida, que suele ser un buen rato después —o al día siguiente—. */
  const duro =
    datos.partida.arrancado_en && datos.partida.terminado_en
      ? duracionLarga(datos.partida.arrancado_en, datos.partida.terminado_en)
      : ''

  const mejor = filas[0]
  const peor = filas[filas.length - 1]
  const masRecompras = [...filas].sort((a, b) => b.recompras - a.recompras)[0]
  const mejorRoi = [...filas].sort((a, b) => b.roi - a.roi)[0]

  /* Lo mismo que se ve arriba, pero listo para presumirlo en el chat. */
  const datosImagen: DatosNumeros = {
    tipo: 'numeros',
    titulo: datos.liga.nombre,
    subtitulo: datos.partida.nombre || datos.partida.fecha,
    filas: filas.map((f) => ({
      nombre: f.nombre,
      foto: f.p.foto,
      puso: f.puso,
      saco: f.saco,
      resultado: f.resultado,
    })),
    mesa,
    contado,
    jugadores: ps.length,
    recompras: totalRecompras,
    ganadores,
  }

  const texto = () => {
    const lineas = [`♠ ${datos.liga.nombre} · ${datos.partida.nombre || datos.partida.fecha}`, '']
    filas.forEach((f, i) => {
      const medalla = MEDALS[i]
      lineas.push(
        `${f.resultado > EPS && medalla ? medalla : '•'} ${f.nombre}: ${signed(f.resultado)}`,
      )
    })
    lineas.push('', `En la mesa: ${money(mesa)} · ganaron ${ganadores} de ${ps.length}`)
    return lineas.join('\n')
  }

  return (
    <>
      <section className="panel">
        <p className="panel-title">
          <span>La noche en números</span>
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div className="stat">
            <div className="stat-k">{esTorneo ? 'Bolsa' : 'Dinero en la mesa'}</div>
            <div className="stat-v">{money(mesa)}</div>
          </div>
          <div className="stat">
            <div className="stat-k">{esTorneo ? 'Premios' : 'Fichas contadas'}</div>
            <div className="stat-v">{money(contado)}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Jugadores</div>
            <div className="stat-v">{ps.length}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Entrada promedio</div>
            <div className="stat-v">{money(entradaPromedio)}</div>
          </div>
          <div className="stat">
            <div className="stat-k">Recompras</div>
            <div className="stat-v">
              {totalRecompras}
              {totalRecompras > 0 && (
                <span className="text-[13px] font-normal text-ink-soft">
                  {' '}
                  · {money(montoRecompras)}
                </span>
              )}
            </div>
          </div>
          {duro && (
            <div className="stat">
              <div className="stat-k">Cuánto se jugó</div>
              <div className="stat-v">{duro}</div>
            </div>
          )}
          {totalRecompras > 0 && (
            <div className="stat">
              <div className="stat-k">Recompra promedio</div>
              <div className="stat-v">{money(recompraPromedio)}</div>
            </div>
          )}
          <div className="stat">
            <div className="stat-k">Salieron ganando</div>
            <div className="stat-v">
              {ganadores}
              <span className="text-[13px] font-normal text-ink-soft"> de {ps.length}</span>
            </div>
          </div>
        </div>

        {!esTorneo &&
          (Math.abs(diferencia) < EPS ? (
            <div className="balance balance-ok mb-0">
              <Check size={16} strokeWidth={2.6} />
              Las fichas cuadran con el dinero
            </div>
          ) : (
            <div className="balance balance-off mb-0">
              <AlertTriangle size={16} strokeWidth={2.4} />
              {diferencia > 0
                ? `Sobran ${money(diferencia)} en fichas contadas`
                : `Faltan ${money(-diferencia)} en fichas contadas`}
            </div>
          ))}
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Los destacados</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {mejor.resultado > EPS && (
            <Destacado
              etiqueta="Se llevó la noche"
              nombre={mejor.nombre}
              valor={signed(mejor.resultado)}
              tono="text-win"
            />
          )}
          {peor.resultado < -EPS && (
            <Destacado
              etiqueta="La peor noche"
              nombre={peor.nombre}
              valor={signed(peor.resultado)}
              tono="text-loss"
            />
          )}
          {masRecompras && masRecompras.recompras > 0 && (
            <Destacado
              etiqueta="Más recompras"
              nombre={masRecompras.nombre}
              valor={`${masRecompras.recompras} · ${money(masRecompras.montoRecompras)}`}
            />
          )}
          {mejorRoi && mejorRoi.roi > 0 && (
            <Destacado
              etiqueta="Mejor rendimiento"
              nombre={mejorRoi.nombre}
              valor={pct(mejorRoi.roi)}
              tono="text-win"
            />
          )}
        </div>
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Jugador por jugador</span>
        </p>
        <div className="no-scrollbar -mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-[10px] tracking-[.5px] text-ink-soft uppercase">
                <th className="px-1 pb-2 font-semibold">Jugador</th>
                <th className="px-1 pb-2 text-right font-semibold">Puso</th>
                <th className="px-1 pb-2 text-right font-semibold">Sacó</th>
                <th className="px-1 pb-2 text-right font-semibold">Resultado</th>
                <th className="px-1 pb-2 text-right font-semibold">Rend.</th>
                <th className="px-1 pb-2 text-right font-semibold">Recom.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.p.id} className="border-t border-dashed border-paper-line">
                  <td className="max-w-[120px] px-1 py-2 font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {f.resultado > EPS && <Medalla lugar={i + 1} size={14} />}
                      <span className="truncate">{f.nombre}</span>
                    </span>
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">{money(f.puso)}</td>
                  <td className="px-1 py-2 text-right text-ink-soft">{money(f.saco)}</td>
                  <td className={`px-1 py-2 text-right font-semibold ${claseSaldo(f.resultado)}`}>
                    {signed(f.resultado)}
                  </td>
                  <td className={`px-1 py-2 text-right font-semibold ${claseSaldo(f.roi)}`}>
                    {pct(f.roi)}
                  </td>
                  <td className="px-1 py-2 text-right text-ink-soft">
                    {f.recompras > 0 ? `${f.recompras} · ${money(f.montoRecompras)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <p className="panel-title">
          <span>Presumir la noche</span>
        </p>
        <ShareBlock datos={datosImagen} texto={texto} alt="Números de la partida" />
      </section>
    </>
  )
}
