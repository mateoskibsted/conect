import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import MatchCard from '../components/MatchCard'

export default function PublicProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [friendCount, setFriendCount] = useState(0)
  const [playedMatches, setPlayedMatches] = useState([])
  const [vToT, setVToT] = useState(null) // viewer → target
  const [tToV, setTToV] = useState(null) // target → viewer
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    if (user && id === user.id) navigate('/perfil', { replace: true })
  }, [user, id])

  useEffect(() => {
    if (!user || !id || id === user.id) return
    loadData()
  }, [user, id])

  async function loadData() {
    const [
      { data: prof },
      // Dos queries separadas en lugar de .or(and()...) — más confiable en PostgREST
      { data: vToTRow },
      { data: tToVRow },
      { data: sentByTarget },
      { data: receivedByTarget },
      { data: myMatchRows },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', id).single(),
      supabase.from('friendships').select('*').eq('requester_id', user.id).eq('addressee_id', id).maybeSingle(),
      supabase.from('friendships').select('*').eq('requester_id', id).eq('addressee_id', user.id).maybeSingle(),
      supabase.from('friendships').select('addressee_id').eq('requester_id', id).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id').eq('addressee_id', id).eq('status', 'accepted'),
      supabase.from('match_players').select('match_id').eq('player_id', id),
    ])

    setProfile(prof)
    setVToT(vToTRow ?? null)
    setTToV(tToVRow ?? null)

    // Contar amigos del target
    const sentSet = new Set((sentByTarget ?? []).map(f => f.addressee_id))
    const receivedSet = new Set((receivedByTarget ?? []).map(f => f.requester_id))
    setFriendCount([...sentSet].filter(fid => receivedSet.has(fid)).length)

    // Partidos jugados (cupos completos)
    const matchIds = (myMatchRows ?? []).map(r => r.match_id)
    if (matchIds.length > 0) {
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          id, title, slug, sport, match_date, match_time,
          location, total_spots, visibility,
          match_players(count),
          match_guests(count)
        `)
        .in('id', matchIds)
        .order('match_date', { ascending: false })

      setPlayedMatches(
        (matchData ?? []).filter(m => {
          const players = m.match_players?.[0]?.count ?? 0
          const guests = m.match_guests?.[0]?.count ?? 0
          return players + guests >= m.total_spots
        })
      )
    }

    setLoading(false)
  }

  async function sendRequest() {
    setActionError(null)
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: id })
      .select()
      .single()
    if (error) { setActionError(error.message); return }
    setVToT(data)
  }

  async function cancelRequest() {
    setActionError(null)
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', user.id)
      .eq('addressee_id', id)
    if (error) { setActionError(error.message); return }
    setVToT(null)
  }

  async function acceptRequest() {
    setActionError(null)
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', id)
      .eq('addressee_id', user.id)
      .select()
      .single()
    if (error) { setActionError(error.message); return }
    setTToV(data)
  }

  function FriendButton() {
    const isFriends = vToT?.status === 'accepted' && tToV?.status === 'accepted'

    if (isFriends) {
      return (
        <span className="px-5 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-200">
          Amigos
        </span>
      )
    }
    if (tToV?.status === 'pending') {
      return (
        <button onClick={acceptRequest} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          Aceptar solicitud
        </button>
      )
    }
    if (!vToT && tToV?.status === 'accepted') {
      return (
        <button onClick={sendRequest} className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
          Enviar solicitud de vuelta
        </button>
      )
    }
    if (vToT?.status === 'accepted' && !tToV) {
      return (
        <span className="px-5 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm">
          Solicitud aceptada · Esperando la suya
        </span>
      )
    }
    if (vToT?.status === 'pending') {
      return (
        <button onClick={cancelRequest} className="px-5 py-2 bg-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors">
          Solicitud enviada · Cancelar
        </button>
      )
    }
    return (
      <button onClick={sendRequest} className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
        Enviar solicitud
      </button>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-20 text-gray-500">Usuario no encontrado</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8 pb-bottom-nav space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-green-100" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-green-100 ring-4 ring-green-50 flex items-center justify-center">
              <span className="text-3xl font-bold text-green-600">
                {profile.full_name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>

          {profile.username && (
            <p className="text-sm text-green-700 font-medium -mt-1">@{profile.username}</p>
          )}

          <div className="flex gap-6">
            <Link to={`/amigos/${id}`} className="flex flex-col items-center hover:opacity-70 transition-opacity">
              <span className="text-lg font-bold text-gray-900">{friendCount}</span>
              <span className="text-xs text-gray-500">amigos</span>
            </Link>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">{playedMatches.length}</span>
              <span className="text-xs text-gray-500">partidos</span>
            </div>
          </div>

          <FriendButton />

          {actionError && (
            <p className="text-xs text-red-500 bg-red-50 px-4 py-2 rounded-lg text-center max-w-xs">
              {actionError}
            </p>
          )}
        </div>

        {playedMatches.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide px-1">
              Partidos jugados
              <span className="ml-2 normal-case font-normal text-gray-400">({playedMatches.length})</span>
            </p>
            {playedMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
