-- Tres cosas de la mesa que no estaban en la base.
--
-- 1) El jefe de la partida. Alguien funge de banco esa noche: es quien recibe el
--    dinero y quien responde si algo no cuadra. Por eso es el único que puede cerrar
--    la partida, aunque haya otros admins en la liga. En NULL están las partidas de
--    antes de que esto existiera; ésas las cierra cualquier admin, como siempre.
ALTER TABLE partidas ADD COLUMN jefe_id TEXT REFERENCES usuarios(id);

-- 2) Quién contó las fichas de alguien al final.
--
--    Ahora cualquiera de la mesa puede capturar un conteo, no sólo un admin: contar
--    entre todos es lo que hace rápido el cash out. Guardar quién lo capturó no es
--    desconfianza, es lo que le permite al que funge de banco revisar de un vistazo
--    antes de soltar el dinero.
ALTER TABLE participaciones ADD COLUMN contadas_por TEXT REFERENCES usuarios(id);

-- 3) El derecho a presumir.
--
--    El que gana la noche es el único que puede dejarle un mensaje al grupo. Vive
--    pegado a su partida, así que cuando se cierra otra, el micrófono pasa solo al
--    nuevo ganador y el mensaje viejo se queda en su noche.
ALTER TABLE partidas ADD COLUMN presume TEXT;
ALTER TABLE partidas ADD COLUMN presume_en TEXT;
