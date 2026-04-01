import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const searchRef = useRef(null)

  const isProfilePage = pathname === '/perfil'
  const isFriendsPage = pathname.startsWith('/amigos')

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

  // Solicitudes pendientes — solo se consulta cuando el usuario está en /amigos
  useEffect(() => {
    if (!isFriendsPage || !user) return
    supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0))
  }, [isFriendsPage, user])

  function goToProfile(id) {
    setQuery('')
    setShowResults(false)
    navigate(`/usuario/${id}`)
  }

  return (
    <nav className="bg-green-600 px-4 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-lg mx-auto flex items-center gap-3 py-3">
        <Link to="/" className="text-xl font-bold text-white shrink-0">
          Conect
        </Link>

        {/* Buscador – solo en desktop (en móvil está en la barra inferior) */}
        <div ref={searchRef} className="flex-1 relative hidden md:block">
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

        {/* Engranaje en /perfil */}
        {isProfilePage && (
          <Link
            to="/ajustes"
            className="ml-auto md:ml-0 text-white/90 hover:text-white transition-colors shrink-0"
            aria-label="Ajustes"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        )}

        {/* Solicitudes de amistad en /amigos */}
        {isFriendsPage && (
          <Link
            to="/solicitudes"
            className="ml-auto md:ml-0 relative text-white/90 hover:text-white transition-colors shrink-0"
            aria-label="Solicitudes de amistad"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </nav>
  )
}
