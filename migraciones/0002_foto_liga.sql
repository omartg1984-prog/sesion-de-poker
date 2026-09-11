-- Foto de la liga, como la del grupo de WhatsApp.
--
-- Se guarda igual que la de los usuarios: un data URL con el JPEG ya encogido a 256px
-- en el navegador, que ronda los 20 KB. No hay almacenamiento de archivos y meter un
-- servicio aparte para media docena de imágenes no se paga solo.
--
-- Aditiva y anulable: las ligas que ya existen se quedan con foto NULL y la app dibuja
-- la inicial, que es lo que hacía antes.
ALTER TABLE ligas ADD COLUMN foto TEXT;
