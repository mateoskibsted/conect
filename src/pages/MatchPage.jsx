import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SpotsBar from '../components/SpotsBar'
import ShareButton from '../components/ShareButton'

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

function Avatar({ player }) {
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.full_name}
        className="w-10 h-10 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
      {player.full_name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function MatchPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const occupiedSpots = players.length
  const isFull = occupiedSpots >= (match?.total_spots ?? 0)
  const isJoined = user ? players.some(p => p.id === user.id) : false
  const isCreator = user && match ? match.creator_id === user.id : false

  useEffect(() => {
    fetchMatch()
  }, [slug])

  async function fetchMatch() {
    setLoading(true)

    const { data: matchData, error } = await supabase
      .from('matches')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !matchData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setMatch(matchData)
    await fetchPlayers(matchData.id)
    setLoading(false)
  }

  async function fetchPlayers(matchId) {
    const { data } = await supabase
      .from('match_players')
      .select('player_id, joined_at, profiles(id, full_name, avatar_url)')
      .eq('match_id', matchId)
      .order('joined_at', { ascending: true })

    if (data) {
      setPlayers(data.map(row => ({ ...row.profiles, joined_at: row.joined_at })))
    }
  }

  async function handleJoin() {
    if (!user) {
      navigate(`/register?redirect=/partido/${slug}`)
      return
    }

    setActionLoading(true)

    const { error } = await supabase
      .from('match_players')
      .insert({ match_id: match.id, player_id: user.id })

    if (!error) {
      await fetchPlayers(match.id)
    }

    setActionLoading(false)
  }

  async function handleLeave() {
    setActionLoading(true)

    await supabase
      .from('match_players')
      .delete()
      .eq('match_id', match.id)
      .eq('player_id', user.id)

    await fetchPlayers(match.id)
    setActionLoading(false)
  }

  async function handleCancelMatch() {
    if (!window.confirm('¿Seguro que querés cancelar este partido? Se eliminará para todos los jugadores.')) return

    setActionLoading(true)

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', match.id)

    setActionLoading(false)

    if (!error) {
      navigate('/')
    }
  }

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
        <p className="text-gray-500">El link puede haber expirado o ser incorrecto.</p>
        <Link to="/" className="text-green-600 font-medium hover:underline">Ir al inicio</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-green-600 font-bold text-lg">Conect</Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Banner del deporte */}
          <div className="bg-green-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl">⚽</span>
              <div>
                <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Fútbol</p>
                <h1 className="text-white text-xl font-bold leading-tight">{match.title}</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Info del partido */}
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">📅</span>
                <span className="capitalize">{formatDate(match.match_date)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">🕐</span>
                <span>{formatTime(match.match_time)} hrs</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">📍</span>
                <span>{match.location}</span>
              </div>
            </div>

            {/* Descripción */}
            {match.description && (
              <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-4">
                {match.description}
              </p>
            )}

            {/* Cupos */}
            <div className="border-t border-gray-50 pt-4">
              <SpotsBar occupied={occupiedSpots} total={match.total_spots} />
            </div>

            {/* Botón principal */}
            {!isCreator && (
              <div>
                {isJoined ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold py-3 rounded-lg">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Estás anotado
                    </div>
                    <button
                      onClick={handleLeave}
                      disabled={actionLoading}
                      className="w-full text-sm text-gray-400 hover:text-red-500 py-1 transition-colors disabled:opacity-50"
                    >
                      Cancelar participación
                    </button>
                  </div>
                ) : isFull ? (
                  <div className="flex items-center justify-center bg-gray-100 text-gray-500 font-semibold py-3 rounded-lg">
                    Partido completo
                  </div>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    {actionLoading ? 'Anotándote...' : 'Unirse al partido'}
                  </button>
                )}
              </div>
            )}

            {isCreator && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 font-medium py-3 rounded-lg text-sm">
                  ⚽ Eres el organizador de este partido
                </div>
                <button
                  onClick={handleCancelMatch}
                  disabled={actionLoading}
                  className="w-full text-sm text-gray-400 hover:text-red-500 py-1 transition-colors disabled:opacity-50"
                >
                  Cancelar partido
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lista de jugadores */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            Jugadores ({occupiedSpots})
          </h2>

          {players.length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no hay jugadores anotados. ¡Sé el primero!</p>
          ) : (
            <ul className="space-y-3">
              {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3">
                  <Avatar player={player} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{player.full_name}</p>
                    {match.creator_id && player.id === match.creator_id && (
                      <p className="text-xs text-green-600">Organizador</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compartir */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-800 mb-3">Compartir partido</h2>
          <ShareButton slug={slug} />
        </div>
      </div>
    </div>
  )
}
