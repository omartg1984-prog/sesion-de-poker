import type { ChipColor, Chips } from '../store/types'
import { count, EPS, num } from './money'

/**
 * Cuántas fichas de cada denominación chica se le da a cada jugador como "cambio",
 * de menor a mayor valor. Es un tope absoluto: sirve para que nadie acapare las
 * fichas chicas y para que el valor grande se cubra con fichas grandes.
 */
export const CHANGE_KEEP = [16, 12, 8, 6, 4, 3, 2, 2]

export function desiredKeep(index: number): number {
  return index < CHANGE_KEEP.length ? CHANGE_KEEP[index] : 2
}

/** Tope de fichas por color para un jugador. `Infinity` = sin límite. */
export type Caps = Record<string, number>

export interface StackResult {
  counts: Chips
  total: number
}

export interface DealPlayer {
  id: string
  name: string
  /** Lo que este jugador debe recibir en fichas. */
  buyIn: number
  /** Reparto editado a mano, o `null` si va en automático. */
  deal: Chips | null
  /*
   * Si esta entrega lleva su propia pila de fichas chicas. La entrada sí: hay que
   * poder pagar las ciegas. Una recompra no: el jugador ya tiene cambio sobre la
   * mesa y darle otro puñado de fichas chicas cada vez vacía la caja de las chicas y
   * le llena el lugar de monedas.
   */
  cambio?: boolean
}

export interface DistributionRow {
  id: string
  name: string
  buyIn: number
  counts: Chips
  total: number
  /** `buyIn − total`: positivo = le faltan fichas, negativo = se pasa. */
  leftover: number
  manual: boolean
}

export interface ColorUsage {
  used: number
  inventory: number
  over: boolean
}

export interface Distribution {
  rows: DistributionRow[]
  usage: Record<string, ColorUsage>
  /** Algún color se repartió más veces de las que hay en el inventario. */
  anyOver: boolean
  /** A alguien no le alcanzó para cuadrar su buy-in exacto. */
  anyShortfall: boolean
}

export function stackTotal(counts: Chips, colors: ChipColor[]): number {
  let t = 0
  for (const c of colors) t += (counts[c.key] || 0) * num(c.value)
  return t
}

function zeroCounts(colors: ChipColor[]): Chips {
  const counts: Chips = {}
  for (const c of colors) counts[c.key] = 0
  return counts
}

/**
 * Arma la pila de un jugador: pila de cambio acotada en las denominaciones chicas,
 * el resto en fichas grandes, y una reparación final para cuadrar exacto — todo
 * sin pasarse de `caps`.
 */
export function balancedStack(
  buyIn: number,
  colors: ChipColor[],
  caps: Caps,
  conCambio = true,
): StackResult {
  const counts = zeroCounts(colors)
  const target = Math.round(num(buyIn))
  if (target <= 0) return { counts, total: 0 }

  const asc = colors.slice().sort((a, b) => num(a.value) - num(b.value))
  const capOf = (key: string) => (caps[key] === undefined ? Infinity : Math.max(0, caps[key]))

  // 1) pila de cambio modesta en todas las denominaciones menos la más grande
  if (conCambio)
    for (let i = 0; i < asc.length - 1; i++) {
      const c = asc[i]
      if (num(c.value) <= 0) continue
      counts[c.key] = Math.min(capOf(c.key), desiredKeep(i))
    }
  let total = stackTotal(counts, colors)

  // 2) si el cambio ya se pasó del buy-in, recorta desde la ficha más grande
  while (total > target) {
    let victim: ChipColor | null = null
    for (const c of asc) {
      if (counts[c.key] > 0 && (!victim || num(c.value) > num(victim.value))) victim = c
    }
    if (!victim) break
    counts[victim.key]--
    total -= num(victim.value)
  }

  // 3) el valor restante se cubre con las fichas grandes primero
  let remaining = target - total
  for (let i = asc.length - 1; i >= 0 && remaining > 0; i--) {
    const c = asc[i]
    const v = num(c.value)
    if (v <= 0) continue
    const room = capOf(c.key) - counts[c.key]
    if (room <= 0) continue
    const add = Math.min(room, Math.floor(remaining / v))
    if (add > 0) {
      counts[c.key] += add
      remaining -= add * v
      total += add * v
    }
  }

  // 4) reparación exacta con la ficha más grande que quepa (cada paso acerca el total,
  //    así que el ciclo siempre termina)
  let guard = 200000
  while (total !== target && guard-- > 0) {
    let pick: ChipColor | null = null
    if (total < target) {
      const need = target - total
      for (const c of colors) {
        const v = num(c.value)
        if (v > 0 && v <= need && counts[c.key] < capOf(c.key) && (!pick || v > num(pick.value))) pick = c
      }
      if (!pick) break
      counts[pick.key]++
      total += num(pick.value)
    } else {
      const over = total - target
      for (const c of colors) {
        const v = num(c.value)
        if (v > 0 && v <= over && counts[c.key] > 0 && (!pick || v > num(pick.value))) pick = c
      }
      if (!pick) break
      counts[pick.key]--
      total -= num(pick.value)
    }
  }

  return { counts, total }
}

/**
 * Reparte el inventario entre todos los jugadores.
 *
 * Primero reserva las fichas de quienes tienen reparto manual y después divide lo que
 * queda entre los automáticos, con un tope justo por color de `floor(restante / faltantes)`
 * para que alcance a todos.
 */
export function computeDistribution(
  players: DealPlayer[],
  colors: ChipColor[],
  ignoreInventory = false,
): Distribution {
  const remaining: Record<string, number> = {}
  for (const c of colors) remaining[c.key] = ignoreInventory ? Infinity : count(c.inventory)

  // pase 1: apartar lo de los jugadores manuales
  const autos: DealPlayer[] = []
  for (const p of players) {
    if (p.deal) {
      for (const c of colors) {
        if (remaining[c.key] !== Infinity) remaining[c.key] -= count(p.deal[c.key])
      }
    } else {
      autos.push(p)
    }
  }

  // pase 2: repartir lo que queda entre los automáticos
  const dealMap: Record<string, Chips> = {}
  autos.forEach((p, idx) => {
    const left = autos.length - idx
    const caps: Caps = {}
    for (const c of colors) {
      caps[c.key] =
        remaining[c.key] === Infinity ? Infinity : Math.max(0, Math.floor(remaining[c.key] / left))
    }
    const st = balancedStack(p.buyIn, colors, caps, p.cambio !== false)
    for (const c of colors) {
      if (remaining[c.key] !== Infinity) remaining[c.key] -= st.counts[c.key]
    }
    dealMap[p.id] = st.counts
  })

  const rows: DistributionRow[] = players.map((p, idx) => {
    const counts = zeroCounts(colors)
    const src = p.deal ?? dealMap[p.id] ?? {}
    for (const c of colors) counts[c.key] = count(src[c.key])
    const buyIn = Math.round(num(p.buyIn))
    const total = stackTotal(counts, colors)
    return {
      id: p.id,
      name: p.name || `Jugador ${idx + 1}`,
      buyIn,
      counts,
      total,
      leftover: buyIn - total,
      manual: !!p.deal,
    }
  })

  const usage: Record<string, ColorUsage> = {}
  let anyOver = false
  for (const c of colors) {
    const used = rows.reduce((s, r) => s + (r.counts[c.key] || 0), 0)
    const inventory = count(c.inventory)
    const over = !ignoreInventory && used > inventory
    if (over) anyOver = true
    usage[c.key] = { used, inventory, over }
  }

  return {
    rows,
    usage,
    anyOver,
    anyShortfall: rows.some((r) => r.leftover > EPS),
  }
}

/** Texto plano del reparto, para copiar y pegar en WhatsApp. */
export function distributionText(dist: Distribution, colors: ChipColor[], moneyFmt: (n: number) => string): string {
  const lines = ['🃏 Reparto de fichas', '']
  for (const r of dist.rows) {
    const parts = colors
      .filter((c) => r.counts[c.key] > 0)
      .map((c) => `${r.counts[c.key]} ${c.label || ''}`.trim())
    lines.push(`• ${r.name} (${moneyFmt(r.buyIn)}): ${parts.join(', ') || '—'}`)
  }
  return lines.join('\n')
}

/*
 * Lo que vale la caja de fichas, en dinero.
 *
 * La pregunta de la mesa nunca es "cuántas fichas quedan" sino "¿alcanza para que entre
 * otro?" o "¿le puedo dar una recompra de $500?". Eso no se responde contando fichas: se
 * responde en pesos, y hay que sumar cada color por su valor.
 *
 * Es una cuenta de cash. En torneo las fichas son puntos y multiplicarlas por su valor
 * en dinero no significa nada.
 */
export interface CajaEnDinero {
  /** Lo que puede repartir la caja llena. */
  total: number
  /** Lo que ya está sobre la mesa. */
  repartido: number
  /** Lo que se puede seguir repartiendo. Negativo = se repartió de más. */
  queda: number
}

export function dineroDeLaCaja(colors: ChipColor[], dist?: Distribution): CajaEnDinero {
  let total = 0
  let repartido = 0
  for (const c of colors) {
    const valor = num(c.value)
    total += count(c.inventory) * valor
    repartido += count(dist?.usage[c.key]?.used) * valor
  }
  return { total, repartido, queda: total - repartido }
}
