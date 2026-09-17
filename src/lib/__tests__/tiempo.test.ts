import { describe, expect, it } from 'vitest'
import { duracionLarga, horaCorta } from '../tiempo'

const t = (hhmm: string) => `2026-03-14T${hhmm}:00.000Z`

describe('cuánto duró la noche', () => {
  it('lo dice en horas y minutos, como se dice de viva voz', () => {
    expect(duracionLarga(t('20:00'), t('23:52'))).toBe('3 h 52 min')
    expect(duracionLarga(t('20:00'), t('20:45'))).toBe('45 min')
    expect(duracionLarga(t('20:00'), t('01:00'))).toBe('')
  })

  it('las horas justas no arrastran un "0 min"', () => {
    expect(duracionLarga(t('20:00'), t('01:00').replace('2026-03-14', '2026-03-15'))).toBe('5 h')
  })

  it('sin hora de fin válida no inventa una duración', () => {
    expect(duracionLarga(t('20:00'), 'cualquier cosa')).toBe('')
    expect(duracionLarga(t('20:00'), t('20:00'))).toBe('')
    /* Un dedazo: se apretó terminar y se deshizo. No es una noche de 0 min. */
    expect(duracionLarga('2026-03-14T20:00:00Z', '2026-03-14T20:00:20Z')).toBe('')
  })

  it('la hora va de 24, que es como se lee a las dos de la mañana', () => {
    expect(horaCorta('2026-03-15T02:15:00.000Z')).toMatch(/^\d{2}:\d{2}$/)
  })
})
