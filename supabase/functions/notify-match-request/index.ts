// Edge Function: notify-match-request
// Disparada por un webhook de base de datos en INSERT sobre match_requests.
// Configurar en Supabase → Database → Webhooks:
//   Table: match_requests | Event: INSERT | URL: esta función
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    if (payload.type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }

    const { match_id, player_id } = payload.record

    // Obtener datos del partido
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .single()

    if (matchError || !match) {
      return new Response('Match not found', { status: 404 })
    }

    // Obtener nombre del jugador que solicitó
    const { data: playerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', player_id)
      .single()

    const playerName = playerProfile?.full_name ?? 'Un jugador'

    // Obtener email del creador
    const { data: creatorData } = await supabase.auth.admin.getUserById(match.creator_id)
    const creatorEmail = creatorData?.user?.email

    if (!creatorEmail) {
      return new Response('No creator email', { status: 200 })
    }

    const matchUrl = `${Deno.env.get('APP_URL')}/partido/${match.slug}`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Conect <onboarding@resend.dev>',
        to: creatorEmail,
        subject: `Nueva solicitud para "${match.title}" ⚽`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
            <div style="background: #16a34a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Nueva solicitud de unión ⚽</h1>
            </div>

            <div style="background: white; padding: 28px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-top: 0;">
                <strong>${playerName}</strong> quiere unirse a tu partido.
              </p>

              <div style="background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                <p style="margin: 4px 0; color: #374151; font-weight: 600;">${match.title}</p>
                <p style="margin: 4px 0; color: #374151;">📅 ${formatDate(match.match_date)}</p>
                <p style="margin: 4px 0; color: #374151;">🕐 ${formatTime(match.match_time)} hrs</p>
                <p style="margin: 4px 0; color: #374151;">📍 ${match.location}</p>
              </div>

              <a
                href="${matchUrl}"
                style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;"
              >
                Ver solicitud en el partido
              </a>

              <p style="font-size: 12px; color: #9ca3af; margin-top: 28px; margin-bottom: 0;">
                Conect – Conecta con jugadores que quieren jugar lo mismo que tú
              </p>
            </div>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('Resend error:', errBody)
      return new Response('Email error', { status: 500 })
    }

    return new Response('Email sent', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('Server error', { status: 500 })
  }
})
