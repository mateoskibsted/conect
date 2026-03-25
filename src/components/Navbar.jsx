import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-green-600">
          Conect
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/perfil"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            {user?.user_metadata?.full_name?.split(' ')[0] ?? 'Perfil'}
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
