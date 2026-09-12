-- La estructura de ciegas de un torneo y el reloj que la va corriendo.
--
-- `estructura` es JSON: { niveles: [{ nivel, chica, grande, desdeMinuto }], stackInicial,
-- minutosPorNivel, ... }. Se guarda ya calculada y no los parámetros, porque una vez que
-- el torneo arrancó la tabla no debe moverse aunque alguien cambie el stack después.
--
-- `reloj` es JSON: { corriendo, acumuladoSeg, arrancadoEn }. Lo que se guarda no es el
-- tiempo que va, sino desde cuándo corre y cuánto llevaba acumulado antes de la última
-- pausa; el tiempo transcurrido se calcula al leerlo.
--
-- Tiene que vivir en el servidor y no en el teléfono: en la mesa hay seis personas
-- mirando la app y todas tienen que ver el mismo nivel y el mismo tiempo. Un reloj por
-- dispositivo se desincroniza en cuanto alguien recarga.
ALTER TABLE partidas ADD COLUMN estructura TEXT;
ALTER TABLE partidas ADD COLUMN reloj TEXT;
