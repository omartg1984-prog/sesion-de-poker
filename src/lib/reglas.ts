/*
 * Las reglas de la casa.
 *
 * Vienen llenas a propósito. Una pantalla en blanco que dice "escribe tus reglas" no la
 * llena nadie; una lista que ya dice algo discutible se corrige en dos minutos, y de ahí
 * sale el acuerdo. Todo es editable y se pueden agregar o borrar renglones.
 *
 * El set de arranque es de partida de casa, no de casino: por eso habla de la hora en
 * que cierra la mesa, del que se va temprano y de quién recoge.
 */

export interface SeccionReglas {
  id: string
  titulo: string
  reglas: string[]
}

export const REGLAS_POR_DEFECTO: SeccionReglas[] = [
  {
    id: 'cash',
    titulo: 'Para las de cash',
    reglas: [
      'Se entra con $500. Si alguien quiere entrar con más, se acuerda antes de repartir la primera mano.',
      'Se puede recomprar cuando sea, pero sólo entre manos, nunca a media.',
      'El que se va antes de la hora acordada cobra lo que tenga en fichas y ya. No se reclama después.',
      'Las fichas no se prestan ni se cambian entre jugadores: todo pasa por quien lleva la cuenta.',
      'La mesa cierra a la hora que se acordó al empezar, aunque alguien vaya ganando.',
      'Si dos manos empatan, el bote se parte. La ficha que no se pueda partir es del que esté a la izquierda del que reparte.',
    ],
  },
  {
    id: 'torneo',
    titulo: 'Para los torneos',
    reglas: [
      'El registro tardío cierra al terminar el nivel 4. Después de eso ya no entra nadie.',
      'Se puede recomprar hasta el primer descanso, y sólo si andas por debajo del stack con el que se arrancó.',
      'El add-on es uno solo por persona y nada más en el primer descanso.',
      'Al que llega tarde se le da su stack completo, pero las ciegas que se le pasaron corren igual.',
      'Si se acuerda cortar antes de terminar, se reparte según las fichas que cada quien tenga en ese momento.',
      'Los premios se pagan cuando termina el torneo, no antes.',
    ],
  },
  {
    id: 'mesa',
    titulo: 'En la mesa',
    reglas: [
      'El celular se usa fuera de la mano. Si estás jugando una, lo dejas.',
      'No se habla de la mano en curso, ni aunque ya te hayas retirado.',
      'Las cartas se enseñan sólo al llegar al final o cuando te las piden ver.',
      'Tienes un minuto para decidir. Si te tardas, cualquiera puede pedir que te cuenten el tiempo.',
      'Las fichas siempre a la vista y acomodadas, las de mayor valor al frente.',
      'El que gana la noche pone la propina para el que prestó la casa.',
      'Se recoge entre todos: vasos, botellas y las fichas a su caja.',
    ],
  },
]

/** Una copia nueva, para que editarla no toque el set de arranque. */
export const reglasDeArranque = (): SeccionReglas[] =>
  REGLAS_POR_DEFECTO.map((s) => ({ ...s, reglas: [...s.reglas] }))
