-- Permitir desactivar todos los recordatorios por correo por evento

ALTER TABLE "Event" ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
