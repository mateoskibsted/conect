import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('Perfil')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setDisplayName(data.full_name.split(' ')[0])
      })
  }, [user])

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(5)
      setResults(data ?? [])
      setShowResults(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, user])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function goToProfile(id) {
    setQuery('')
    setShowResults(false)
    navigate(`/usuario/${id}`)
  }

  return (
    <nav className="bg-green-600 px-4 py-3 sticky top-0 z-10">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <Link to="/" className="text-xl font-bold text-white shrink-0">
          Conect
        </Link>

        {/* Buscador */}
        <div ref={searchRef} className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar jugadores..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="w-full px-3 py-1.5 rounded-xl text-sm bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-colors"
          />
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg overflow-hidden z-50">
              {results.length > 0 ? results.map(u => (
                <button
                  key={u.id}
                  onClick={() => goToProfile(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-green-600">
                        {u.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{u.full_name}</p>
                    {u.username && <p className="text-xs text-gray-400 truncate">@{u.username}</p>}
                  </div>
                </button>
              )) : (
                <p className="text-sm text-gray-500 text-center px-3 py-3">Sin resultados</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/perfil"
            className="text-sm text-white hover:text-green-100 transition-colors"
          >
            {displayName}
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </nav>
  )
}
