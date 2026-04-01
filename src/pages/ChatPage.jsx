import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function MessageAvatar({ profile }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs shrink-0">
      {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
    </div>
  )
}

export default function ChatPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const [match, setMatch] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let channel = null

    async function init() {
      // 1. Obtener partido por slug
      const { data: matchData, error } = await supabase
        .from('matches')
        .select('id, title, creator_id')
        .eq('slug', slug)
        .single()

      if (error || !matchData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setMatch(matchData)

      // 2. Verificar acceso (creador o jugador confirmado)
      const isCreator = matchData.creator_id === user.id
      let isPlayer = false

      if (!isCreator) {
        const { data: playerRow } = await supabase
          .from('match_players')
          .select('player_id')
          .eq('match_id', matchData.id)
          .eq('player_id', user.id)
          .maybeSingle()
        isPlayer = !!playerRow
      }

      if (!isCreator && !isPlayer) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      setHasAccess(true)

      // 3. Cargar mensajes existentes
      const { data: msgs } = await supabase
        .from('match_messages')
        .select('id, content, created_at, user_id, profiles(id, full_name, avatar_url)')
        .eq('match_id', matchData.id)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])
      setLoading(false)

      // 4. Suscripción en tiempo real
      channel = supabase
        .channel(`match-chat-${matchData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'match_messages',
            filter: `match_id=eq.${matchData.id}`,
          },
          async (payload) => {
            // Obtenemos el mensaje completo con el perfil del autor
            const { data } = await supabase
              .from('match_messages')
              .select('id, content, created_at, user_id, profiles(id, full_name, avatar_url)')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              setMessages((prev) => {
                // Evitar duplicados si el emisor ya optimistamente insertó el mensaje
                if (prev.some((m) => m.id === data.id)) return prev
                return [...prev, data]
              })
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [slug, user.id])

  // Scroll al último mensaje cuando llegan nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text || sending) return

    setSending(true)
    setNewMessage('')

    await supabase.from('match_messages').insert({
      match_id: match.id,
      user_id: user.id,
      content: text,
    })

    setSending(false)
    inputRef.current?.focus()
  }

  // ── Estados de carga ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <span className="text-5xl">⚽</span>
        <h1 className="text-xl font-semibold text-gray-800">Partido no encontrado</h1>
        <Link to="/" className="text-green-600 font-medium hover:underline">Ir al inicio</Link>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="text-xl font-semibold text-gray-800">Acceso restringido</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          El chat solo está disponible para el organizador y los jugadores confirmados.
        </p>
        <Link
          to={`/partido/${slug}`}
          className="text-green-600 font-medium hover:underline"
        >
          Ver el partido
        </Link>
      </div>
    )
  }

  // ── Chat ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          to={`/partido/${slug}`}
          className="text-green-600 p-1 -ml-1"
          aria-label="Volver al partido"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{match.title}</p>
          <p className="text-xs text-gray-400">Chat del partido</p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center pb-8">
            <span className="text-4xl">💬</span>
            <p className="text-gray-500 text-sm">Nadie ha escrito aún.<br />¡Sé el primero!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.user_id === user.id
          const profile = msg.profiles

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar (solo mensajes de otros) */}
              {!isOwn && <MessageAvatar profile={profile} />}

              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Nombre (solo mensajes de otros) */}
                {!isOwn && (
                  <span className="text-xs text-gray-400 px-1">{profile?.full_name}</span>
                )}

                {/* Burbuja */}
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    isOwn
                      ? 'bg-green-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Hora */}
                <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at)}</span>
              </div>

              {/* Espacio reservado donde iría el avatar propio (para alinear la burbuja) */}
              {isOwn && <div className="w-8 shrink-0" />}
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje…"
          maxLength={500}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-full p-2.5 transition-colors shrink-0"
          aria-label="Enviar mensaje"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}
