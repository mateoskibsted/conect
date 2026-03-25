import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import MatchCard from '../components/MatchCard'

export default function Home() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  async function fetchMatches() {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('matches')
      .select(`
        id, title, slug, sport, match_date, match_time,
        location, total_spots, visibility,
        match_players(count)
      `)
      .eq('visibility', 'public')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })

    setMatches(data ?? [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
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

        {/* Lista de partidos */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Partidos próximos
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-14 space-y-3">
              <span className="text-5xl">⚽</span>
              <p className="text-gray-500 font-medium">No hay partidos próximos</p>
              <p className="text-sm text-gray-400">¡Crea el primero y comparte el link!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
