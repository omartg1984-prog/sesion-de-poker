-- Lo que de verdad se le entregó a cada quien al final de la noche.
--
-- Las fichas dicen que a alguien le tocan $1,347, pero en la mesa sólo hay billetes de
-- $50 y se le dan $1,350. Esa diferencia existe en la vida real y hasta ahora no tenía
-- dónde vivir, así que el dinero nunca cuadraba con lo apuntado.
--
-- `pagado` en NULL quiere decir que todavía no se reparte el dinero, que no es lo mismo
-- que haber entregado cero.
--
-- El ranking de la liga sigue usando las fichas, no esto: si contara el pago real, el
-- redondeo de los billetes acabaría moviendo la tabla de la temporada.
ALTER TABLE participaciones ADD COLUMN pagado REAL;

-- El billete más chico que trajeron esa noche, para sugerir el redondeo. Cambia de una
-- noche a otra según con cuánta feria llegaron, por eso va en la partida y no en la liga.
ALTER TABLE partidas ADD COLUMN redondeo INTEGER;
