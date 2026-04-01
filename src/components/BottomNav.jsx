import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const path = location.pathname

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [searchOpen])

  // Cerrar búsqueda al navegar
  useEffect(() => { setSearchOpen(false) }, [path])

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(8)
      setResults(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [query, user])

  function goToUser(userId) {
    setSearchOpen(false)
    navigate(`/usuario/${userId}`)
  }

  const isHome    = path === '/'
  const isFriends = path.startsWith('/amigos')
  const isProfile = path === '/perfil'

  return (
    <>
      {/* Overlay de búsqueda (pantalla completa en móvil) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col md:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Header con input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white">
            <button
              onClick={() => setSearchOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar jugadores..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Resultados */}
          <div className="flex-1 overflow-y-auto">
            {results.length > 0 ? (
              results.map(u => (
                <button
                  key={u.id}
                  onClick={() => goToUser(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left border-b border-gray-50"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-green-600">
                        {u.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                    {u.username && (
                      <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                    )}
                  </div>
                </button>
              ))
            ) : query.trim() ? (
              <p className="text-sm text-gray-400 text-center py-16">Sin resultados para "{query}"</p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-16">Escribe un nombre o @usuario</p>
            )}
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-green-600 border-t border-green-700" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">

          {/* Inicio */}
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
          >
            <svg
              className={`w-6 h-6 text-white transition-opacity ${isHome ? 'opacity-100' : 'opacity-50'}`}
              fill={isHome ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isHome ? 0 : 1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {isHome && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
          </Link>

          {/* Buscar – solo en móvil; en desktop el buscador está en el Navbar superior */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative md:hidden"
          >
            <svg
              className={`w-6 h-6 text-white transition-opacity ${searchOpen ? 'opacity-100' : 'opacity-50'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchOpen && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
          </button>

          {/* Amigos */}
          <Link
            to="/amigos"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
          >
            <svg
              className={`w-6 h-6 text-white transition-opacity ${isFriends ? 'opacity-100' : 'opacity-50'}`}
              fill={isFriends ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isFriends ? 0 : 1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isFriends && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
          </Link>

          {/* Perfil */}
          <Link
            to="/perfil"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
          >
            <svg
              className={`w-6 h-6 text-white transition-opacity ${isProfile ? 'opacity-100' : 'opacity-50'}`}
              fill={isProfile ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isProfile ? 0 : 1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {isProfile && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
          </Link>

        </div>
      </nav>
    </>
  )
}
