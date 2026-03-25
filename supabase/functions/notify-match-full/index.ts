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

    // Solo procesar inserts en match_players
    if (payload.type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }

    const { match_id } = payload.record

    // Obtener datos del partido + conteo de jugadores
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*, match_players(count)')
      .eq('id', match_id)
      .single()

    if (matchError || !match) {
      return new Response('Match not found', { status: 404 })
    }

    const occupiedSpots = match.match_players[0].count

    // Solo continuar si el partido se acaba de completar
    if (occupiedSpots < match.total_spots) {
      return new Response('Not full yet', { status: 200 })
    }

    // Obtener lista de jugadores
    const { data: players } = await supabase
      .from('match_players')
      .select('profiles(full_name)')
      .eq('match_id', match_id)

    // Obtener email del creador via admin API
    const { data: creatorData } = await supabase.auth.admin.getUserById(match.creator_id)
    const creatorEmail = creatorData?.user?.email

    if (!creatorEmail) {
      return new Response('No creator email', { status: 200 })
    }

    const playerNames = players
      ?.map((p: any) => `<li style="padding: 4px 0;">⚽ ${p.profiles.full_name}</li>`)
      .join('') ?? ''

    const matchUrl = `${Deno.env.get('APP_URL')}/partido/${match.slug}`

    // Enviar email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Conect <onboarding@resend.dev>',
        to: creatorEmail,
        subject: `¡Tu partido "${match.title}" está completo! ⚽`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
            <div style="background: #16a34a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">¡Partido completo! ⚽</h1>
            </div>

            <div style="background: white; padding: 28px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-top: 0;">
                Tu partido <strong>${match.title}</strong> tiene todos sus cupos ocupados.
              </p>

              <div style="background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                <p style="margin: 4px 0; color: #374151;">📅 ${formatDate(match.match_date)}</p>
                <p style="margin: 4px 0; color: #374151;">🕐 ${formatTime(match.match_time)} hrs</p>
                <p style="margin: 4px 0; color: #374151;">📍 ${match.location}</p>
                <p style="margin: 4px 0; color: #374151;">👥 ${match.total_spots} jugadores</p>
              </div>

              <h3 style="font-size: 15px; color: #374151;">Jugadores confirmados:</h3>
              <ul style="padding-left: 0; list-style: none; margin: 0 0 20px 0; color: #374151;">
                ${playerNames}
              </ul>

              <a
                href="${matchUrl}"
                style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;"
              >
                Ver partido
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
