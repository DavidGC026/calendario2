/**
 * Prueba la API de Resend con la misma capa que la app (lib/email).
 *
 * Uso: npm run test:resend -- tu@email.com
 * Requiere RESEND_API_KEY en .env (y opcionalmente RESEND_FROM_EMAIL).
 */
import { sendHtmlEmail } from "../lib/email"

async function main() {
  const to = process.argv[2]?.trim()
  if (!to) {
    console.error("Uso: npm run test:resend -- <email-destino>")
    process.exit(1)
  }

  const result = await sendHtmlEmail(
    to,
    "[Prueba] Calendario — Resend",
    `<p>Si recibes este correo, la clave y el envío con Resend funcionan.</p>
<p style="color:#64748b;font-size:13px;">${new Date().toISOString()}</p>`,
  )

  if (result.ok) {
    console.log("Enviado correctamente.")
    process.exit(0)
  }
  console.error("Fallo:", result.error ?? "desconocido")
  process.exit(1)
}

void main()
