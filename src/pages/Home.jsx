import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import MatchCard from '../components/MatchCard'
import ballImg from '../assets/ball.jpg'
import kidsImg from '../assets/kids.jpg'
import stadium2Img from '../assets/stadium2.jpg'

export default function Home() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'friends'
  const [friendIds, setFriendIds] = useState(null) // null = no cargado
  const [friendMatchIds, setFriendMatchIds] = useState(null)
  const [loadingFriends, setLoadingFriends] = useState(false)

  useEffect(() => {
    fetchMatches()
  }, [])

  useEffect(() => {
    if (filter === 'friends' && friendIds === null && user) {
      loadFriendData()
    }
  }, [filter, user])

  async function fetchMatches() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('matches')
      .select(`
        id, title, slug, sport, match_date, match_time,
        location, total_spots, visibility, creator_id,
        match_players(count),
        match_guests(count)
      `)
      .eq('visibility', 'public')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })

    setMatches(data ?? [])
    setLoading(false)
  }

  async function loadFriendData() {
    setLoadingFriends(true)

    // Amigos = ambas direcciones aceptadas
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('friendships').select('addressee_id').eq('requester_id', user.id).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id').eq('addressee_id', user.id).eq('status', 'accepted')
    ])

    const sentSet = new Set((sent ?? []).map(f => f.addressee_id))
    const receivedSet = new Set((received ?? []).map(f => f.requester_id))
    const friends = [...sentSet].filter(id => receivedSet.has(id))
    setFriendIds(friends)

    if (friends.length > 0) {
      const { data: playerMatches } = await supabase
        .from('match_players')
        .select('match_id')
        .in('player_id', friends)
      setFriendMatchIds(new Set((playerMatches ?? []).map(m => m.match_id)))
    } else {
      setFriendMatchIds(new Set())
    }

    setLoadingFriends(false)
  }

  const displayedMatches = (() => {
    if (filter === 'all') return matches
    if (friendIds === null) return []
    if (friendIds.length === 0) return []
    return matches.filter(m =>
      friendIds.includes(m.creator_id) || friendMatchIds?.has(m.id)
    )
  })()

  const isFriendsLoading = filter === 'friends' && (loadingFriends || friendIds === null)

  return (
    <div className="min-h-screen relative">
      {/* Fondo tríptico */}
      <div className="absolute inset-0 flex overflow-hidden z-0">
        <img src={ballImg} alt="" className="w-1/3 h-full object-cover" />
        <img src={kidsImg} alt="" className="w-1/3 h-full object-cover" />
        <img src={stadium2Img} alt="" className="w-1/3 h-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="relative z-10">
        <Navbar />

        <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6 space-y-5">
          {/* CTA crear partido */}
          <Link
            to="/crear"
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Crear partido
          </Link>

          {/* Filtro */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('friends')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === 'friends'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Amigos
            </button>
          </div>

          {/* Lista de partidos */}
          <div>
            <h2 className="text-sm font-medium text-white uppercase tracking-wide mb-3">
              Partidos próximos
            </h2>

            {loading || isFriendsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filter === 'friends' && friendIds?.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <p className="text-white font-medium">Aún no tienes amigos</p>
                <p className="text-sm text-white/80">Busca jugadores en el buscador y envía solicitudes</p>
              </div>
            ) : displayedMatches.length === 0 ? (
              <div className="text-center py-14 space-y-3">
                <p className="text-white font-medium">
                  {filter === 'friends' ? 'Tus amigos no tienen partidos próximos' : 'No hay partidos próximos'}
                </p>
                {filter === 'all' && (
                  <p className="text-sm text-white/80">¡Crea el primero y comparte el link!</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
