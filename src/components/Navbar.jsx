import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('Perfil')

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

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-green-600 px-4 py-3 sticky top-0 z-10">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-white">
          Conect
        </Link>

        <div className="flex items-center gap-3">
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
