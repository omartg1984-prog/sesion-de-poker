import type { ChipColor, Chips, Player, Tournament } from '../store/types'

/** Tolerancia para comparar dinero: por debajo de medio centavo es cero. */
export const EPS = 0.005

/** Convierte cualquier entrada de formulario a número; lo que no sea número es 0. */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = parseFloat(String(v ?? ''))
  return Number.isNaN(n) ? 0 : n
}

/** Entero >= 0 (para conteos de fichas e inventario). */
export function count(v: unknown): number {
  return Math.max(0, Math.floor(num(v)))
}

/** "$1,250" / "−$300" (el signo menos es U+2212, se ve mejor que el guion). */
export function money(n: number): string {
  const neg = n < 0
  const abs = Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
  return (neg ? '−$' : '$') + abs
}

/** Igual que `money` pero siempre con signo: "+$400", "−$120", "$0". */
export function signed(n: number): string {
  if (Math.abs(n) < EPS) return '$0'
  const abs = Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
  return (n > 0 ? '+$' : '−$') + abs
}

/** Redondeado y sin decimales, para la imagen compartible. */
export function moneyShort(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}

/** Negro o blanco, el que contraste mejor sobre `hex`. */
export function textOn(hex: string): string {
  let c = (hex || '#000').replace('#', '')
  if (c.length === 3)
    c = c
      .split('')
      .map((x) => x + x)
      .join('')
  const r = parseInt(c.slice(0, 2), 16) || 0
  const g = parseInt(c.slice(2, 4), 16) || 0
  const b = parseInt(c.slice(4, 6), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#222222' : '#ffffff'
}

export function chipValue(chips: Chips, colors: ChipColor[]): number {
  let t = 0
  for (const c of colors) t += num(chips[c.key]) * num(c.value)
  return t
}

/* ---- cash ---- */

export function entradaMoney(p: Player): number {
  return num(p.entrada.money)
}

export function recompraMoney(p: Player): number {
  return p.recompras.reduce((t, r) => t + num(r.money), 0)
}

export function investedOf(p: Player): number {
  return entradaMoney(p) + recompraMoney(p)
}

export function finalValueOf(p: Player, colors: ChipColor[]): number {
  return chipValue(p.final, colors)
}

export function plOf(p: Player, colors: ChipColor[]): number {
  return finalValueOf(p, colors) - investedOf(p)
}

/* ---- torneo ---- */

export function paidOf(p: Player, t: Tournament): number {
  return num(t.buyIn) + num(p.tourney.rebuys) * num(t.rebuyPrice) + num(p.tourney.addons) * num(t.addOnPrice)
}

export function poolOf(players: Player[], t: Tournament): number {
  return players.reduce((s, p) => s + paidOf(p, t), 0)
}

export function pctSum(t: Tournament): number {
  return t.payouts.reduce((s, x) => s + num(x.pct), 0)
}

/** Premio del lugar `index + 1`. */
export function payoutAmount(index: number, players: Player[], t: Tournament): number {
  const po = t.payouts[index]
  return po ? (poolOf(players, t) * num(po.pct)) / 100 : 0
}

export function winningsOf(p: Player, players: Player[], t: Tournament): number {
  if (!p.tourney.place) return 0
  return payoutAmount(p.tourney.place - 1, players, t)
}

export function netOf(p: Player, players: Player[], t: Tournament): number {
  return winningsOf(p, players, t) - paidOf(p, t)
}
