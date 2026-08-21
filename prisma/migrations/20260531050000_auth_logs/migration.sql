-- Tabla de auditoría para intentos de login (web y móvil)
CREATE TABLE "AuthLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "email" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "AuthLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthLog_createdAt_idx" ON "AuthLog"("createdAt");
CREATE INDEX "AuthLog_email_idx" ON "AuthLog"("email");
CREATE INDEX "AuthLog_success_idx" ON "AuthLog"("success");
