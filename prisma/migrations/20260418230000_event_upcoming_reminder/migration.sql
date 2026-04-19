-- Recordatorio configurable "X minutos antes" por evento

ALTER TABLE "Event"
  ADD COLUMN "reminderMinutesBefore" INTEGER,
  ADD COLUMN "reminderUpcomingSentAt" TIMESTAMP(3);

CREATE INDEX "Event_reminderUpcomingSentAt_startAt_idx"
  ON "Event"("reminderUpcomingSentAt", "startAt");
