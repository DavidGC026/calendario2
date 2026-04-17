import { Resend } from 'resend'
import { getCurrentUserId } from "@/lib/auth"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const { to, event } = await req.json()

  if (!to || !event) {
    return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Calendario <onboarding@resend.dev>',
      to: [to],
      subject: `Recordatorio: ${event.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 24px; }
            .event-card { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
            .event-title { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
            .event-detail { display: flex; align-items: center; margin-bottom: 8px; color: #64748b; font-size: 14px; }
            .icon { width: 20px; height: 20px; margin-right: 8px; }
            .footer { text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Recordatorio de Evento</h1>
            </div>
            <div class="content">
              <div class="event-card">
                <div class="event-title">${event.title}</div>
                <div class="event-detail">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  ${event.eventDate}
                </div>
                <div class="event-detail">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  ${event.startTime} - ${event.endTime}
                </div>
                ${event.location ? `
                <div class="event-detail">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  ${event.location}
                </div>
                ` : ''}
                ${event.description ? `<p style="color: #475569; margin-top: 12px;">${event.description}</p>` : ''}
              </div>
              <p style="color: #64748b; text-align: center;">No olvides tu compromiso.</p>
            </div>
            <div class="footer">
              Enviado desde tu Calendario Inteligente
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ success: true, id: data?.id })
  } catch (error) {
    return Response.json({ error: 'Error al enviar el email' }, { status: 500 })
  }
}
