/*
 * Horas y duraciones, dichas como se dicen en la mesa.
 *
 * La noche tiene dos horas que importan y no son la misma: a la que se repartió la
 * primera mano y a la que se repartió la última. Cerrar la partida viene después —el
 * conteo, los pagos, el que se fue al cajero—, y a veces al día siguiente.
 */

/** "22:15". Siempre de 24 horas: a las dos de la mañana nadie escribe "2:15 a. m.". */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Cuánto duró, en palabras: "3 h 52 min", "45 min", "5 h".
 *
 * Nadie cuenta los segundos de una partida y un "03:52:11" hay que traducirlo al
 * leerlo. Los minutos se redondean al más cercano.
 */
export function duracionLarga(desde: string, hasta: string): string {
  const ms = Date.parse(hasta) - Date.parse(desde)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const minutos = Math.round(ms / 60000)
  /* Menos de un minuto no es una duración, es un dedazo: mejor no decir nada que
     dejar un "0 min" colgado en el resumen de la noche. */
  if (minutos === 0) return ''
  const horas = Math.floor(minutos / 60)
  const resto = minutos - horas * 60
  if (horas === 0) return `${resto} min`
  if (resto === 0) return `${horas} h`
  return `${horas} h ${resto} min`
}
