/*
 * Las reglas de la casa.
 *
 * Vienen llenas a propósito. Una pantalla en blanco que dice "escribe tus reglas" no la
 * llena nadie; una lista que ya dice algo discutible se corrige en dos minutos, y de ahí
 * sale el acuerdo. Todo es editable y se pueden agregar o borrar renglones.
 *
 * El set de arranque es el reglamento de la liga tal como se escribió: el formato, cómo
 * se ganan los puntos, la calificación por rendimiento y lo que se cobra en diciembre.
 * Al final van las reglas de mesa, que el reglamento no toca y que cada casa acomoda.
 */

export interface SeccionReglas {
  id: string
  titulo: string
  reglas: string[]
}

export const REGLAS_POR_DEFECTO: SeccionReglas[] = [
  {
    id: 'liga',
    titulo: 'De qué se trata la liga',
    reglas: [
      'Se juega Texas Hold’em, mesa abierta, ciegas de $1 y $2.',
      'La temporada corre de julio a diciembre.',
      'Cada vez que jugamos se registra con cuánto entró cada quien y con cuánto se fue. De ahí sale el resultado de la noche y, lo que más importa, los puntos.',
      'Los puntos se acumulan sesión tras sesión y arman el campeonato. Esto no es ganar una noche: es ser constante toda la temporada.',
    ],
  },
  {
    id: 'puntos',
    titulo: 'Cómo se ganan los puntos',
    reglas: [
      'Tu puntaje de la noche es la suma de tres cosas: asistencia, bono y posición.',
      'Asistencia: 5 puntos por presentarte, pase lo que pase.',
      'Bono: 5 puntos más si terminas la noche en positivo.',
      'Posición: 25 al 1º, 20 al 2º, 15 al 3º, 10 al 4º y 5 al 5º.',
      'El lugar se define por tu ganancia o pérdida de la noche.',
      'Del 6º en adelante no se suman puntos de posición, pero igual te llevas los 5 de asistencia por venir.',
      'Empates: si dos o más quedan iguales, comparten el mismo lugar y los mismos puntos; el siguiente se salta los puestos ocupados (1, 2, 3, 3, 5…).',
      'Ejemplo: ganas dinero y quedas 1º son 5 + 5 + 25 = 35 puntos. Pierdes pero quedas 5º son 5 + 0 + 5 = 10 puntos.',
    ],
  },
  {
    id: 'ranking',
    titulo: 'El campeonato y tu calificación',
    reglas: [
      'El campeonato se ordena por puntos acumulados.',
      'Además, cada quien carga una calificación según su rendimiento: lo que ha ganado contra todo lo que ha metido.',
      'Shark de 50% para arriba, Pro de 20%, Solid de 0%, Rookie hasta −20% y Fish por debajo de eso.',
      'Para sumar más: no faltes, juega para ganar y sé constante. El campeonato premia la temporada completa, no una noche de suerte.',
    ],
  },
  {
    id: 'cierre',
    titulo: 'El premio… y el castigo',
    reglas: [
      'En diciembre se cierra la temporada con posada y carne asada, y ahí se cobra todo el semestre.',
      'El 1º lugar paga $0: cena gratis.',
      'Los de en medio pagan su parte normal de la cuenta.',
      'El último lugar paga doble. A castigar al farol.',
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
      'Se puede recomprar cuando sea, pero sólo entre manos, nunca a media.',
      'Si dos manos empatan, el bote se parte. La ficha que no se pueda partir es del que esté a la izquierda del que reparte.',
      'El que gana la noche pone la propina para el que prestó la casa.',
      'Se recoge entre todos: vasos, botellas y las fichas a su caja.',
    ],
  },
]

/** Una copia nueva, para que editarla no toque el set de arranque. */
export const reglasDeArranque = (): SeccionReglas[] =>
  REGLAS_POR_DEFECTO.map((s) => ({ ...s, reglas: [...s.reglas] }))
