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
  const [requests, setRequests] = useState([])
  const [myRequest, setMyRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const occupiedSpots = players.length
  const isFull = occupiedSpots >= (match?.total_spots ?? 0)
  const isJoined = user ? players.some(p => p.id === user.id) : false
  const isCreator = user && match ? match.creator_id === user.id : false
  const isCohost = user ? players.some(p => p.id === user.id && p.is_cohost) : false
  const canManageRequests = isCreator || isCohost

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

    const playersData = await fetchPlayers(matchData.id)

    if (user) {
      const isCreatorLocal = matchData.creator_id === user.id
      const isCohostLocal = playersData.some(p => p.id === user.id && p.is_cohost)
      const isJoinedLocal = playersData.some(p => p.id === user.id)

      const tasks = []
      if (isCreatorLocal || isCohostLocal) {
        tasks.push(fetchRequests(matchData.id))
      }
      if (!isJoinedLocal && !isCreatorLocal) {
        tasks.push(fetchMyRequest(matchData.id))
      }
      await Promise.all(tasks)
    }

    setLoading(false)
  }

  async function fetchPlayers(matchId) {
    const { data } = await supabase
      .from('match_players')
      .select('player_id, joined_at, is_cohost, profiles(id, full_name, avatar_url)')
      .eq('match_id', matchId)
      .order('joined_at', { ascending: true })

    const mapped = data
      ? data.map(row => ({ ...row.profiles, joined_at: row.joined_at, is_cohost: row.is_cohost }))
      : []
    setPlayers(mapped)
    return mapped
  }

  async function fetchRequests(matchId) {
    const { data } = await supabase
      .from('match_requests')
      .select('id, status, created_at, profiles(id, full_name, avatar_url)')
      .eq('match_id', matchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (data) {
      setRequests(data.map(row => ({ ...row.profiles, request_id: row.id })))
    }
  }

  async function fetchMyRequest(matchId) {
    if (!user) return
    const { data } = await supabase
      .from('match_requests')
      .select('id, status')
      .eq('match_id', matchId)
      .eq('player_id', user.id)
      .maybeSingle()

    setMyRequest(data)
  }

  async function handleRequest() {
    if (!user) {
      navigate(`/register?redirect=/partido/${slug}`)
      return
    }
    setActionLoading(true)
    const { error } = await supabase
      .from('match_requests')
      .insert({ match_id: match.id, player_id: user.id })

    if (!error) await fetchMyRequest(match.id)
    setActionLoading(false)
  }

  async function handleWithdrawRequest() {
    setActionLoading(true)
    await supabase
      .from('match_requests')
      .delete()
      .eq('match_id', match.id)
      .eq('player_id', user.id)

    setMyRequest(null)
    setActionLoading(false)
  }

  async function handleAccept(requestId) {
    setActionLoading(true)
    const { error } = await supabase.rpc('accept_match_request', { p_request_id: requestId })

    if (!error) {
      await Promise.all([fetchPlayers(match.id), fetchRequests(match.id)])
    }
    setActionLoading(false)
  }

  async function handleReject(requestId) {
    setActionLoading(true)
    await supabase
      .from('match_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)

    await fetchRequests(match.id)
    setActionLoading(false)
  }

  async function handleMakeCohost(playerId, value) {
    setActionLoading(true)
    await supabase.rpc('set_cohost', {
      p_match_id: match.id,
      p_player_id: playerId,
      p_value: value,
    })

    await fetchPlayers(match.id)
    setActionLoading(false)
  }

  async function handleLeave() {
    setActionLoading(true)
    await supabase.from('match_players').delete().eq('match_id', match.id).eq('player_id', user.id)
    // Borrar la solicitud para que pueda pedir de nuevo si quiere
    await supabase.from('match_requests').delete().eq('match_id', match.id).eq('player_id', user.id)

    await fetchPlayers(match.id)
    setMyRequest(null)
    setActionLoading(false)
  }

  async function handleCancelMatch() {
    if (!window.confirm('¿Seguro que quieres cancelar este partido? Se eliminará para todos los jugadores.')) return

    setActionLoading(true)
    const { error } = await supabase.from('matches').delete().eq('id', match.id)
    setActionLoading(false)

    if (!error) navigate('/')
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

            {/* Acciones para jugadores (no creador) */}
            {!isCreator && (
              <div>
                {isJoined ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold py-3 rounded-lg">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Estás confirmado
                    </div>
                    <button
                      onClick={handleLeave}
                      disabled={actionLoading}
                      className="w-full text-sm text-gray-400 hover:text-red-500 py-1 transition-colors disabled:opacity-50"
                    >
                      Cancelar participación
                    </button>
                  </div>
                ) : myRequest?.status === 'pending' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 bg-yellow-50 text-yellow-700 font-semibold py-3 rounded-lg text-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Solicitud enviada — esperando aprobación
                    </div>
                    <button
                      onClick={handleWithdrawRequest}
                      disabled={actionLoading}
                      className="w-full text-sm text-gray-400 hover:text-red-500 py-1 transition-colors disabled:opacity-50"
                    >
                      Retirar solicitud
                    </button>
                  </div>
                ) : myRequest?.status === 'rejected' ? (
                  <div className="flex items-center justify-center bg-red-50 text-red-600 font-medium py-3 rounded-lg text-sm">
                    Tu solicitud fue rechazada
                  </div>
                ) : isFull ? (
                  <div className="flex items-center justify-center bg-gray-100 text-gray-500 font-semibold py-3 rounded-lg">
                    Partido completo
                  </div>
                ) : (
                  <button
                    onClick={handleRequest}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    {actionLoading ? 'Enviando solicitud...' : 'Solicitar unirse'}
                  </button>
                )}
              </div>
            )}

            {/* Acciones para el creador */}
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

        {/* Solicitudes pendientes (solo para host/co-host) */}
        {canManageRequests && requests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 px-6 py-5">
            <h2 className="font-semibold text-gray-800 mb-4">
              Solicitudes pendientes
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {requests.map((req) => (
                <li key={req.request_id} className="flex items-center gap-3">
                  <Avatar player={req} />
                  <p className="text-sm font-medium text-gray-800 flex-1">{req.full_name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.request_id)}
                      disabled={actionLoading || isFull}
                      className="text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleReject(req.request_id)}
                      disabled={actionLoading}
                      className="text-xs font-semibold bg-gray-100 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lista de jugadores confirmados */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            Jugadores confirmados ({occupiedSpots})
          </h2>

          {players.length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no hay jugadores confirmados.</p>
          ) : (
            <ul className="space-y-3">
              {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3">
                  <Avatar player={player} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{player.full_name}</p>
                    {player.id === match.creator_id && (
                      <p className="text-xs text-green-600">Organizador</p>
                    )}
                    {player.is_cohost && player.id !== match.creator_id && (
                      <p className="text-xs text-blue-600">Co-host</p>
                    )}
                  </div>
                  {/* Botón co-host: solo el creador puede asignar/quitar */}
                  {isCreator && player.id !== match.creator_id && (
                    <button
                      onClick={() => handleMakeCohost(player.id, !player.is_cohost)}
                      disabled={actionLoading}
                      className="text-xs text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {player.is_cohost ? 'Quitar co-host' : 'Hacer co-host'}
                    </button>
                  )}
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
