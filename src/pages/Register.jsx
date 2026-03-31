import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/

export default function Register() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '' })
  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={redirect} replace />
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'username' ? value.toLowerCase().replace(/[^a-z0-9_]/g, '') : value,
    }))
  }

  // Verificación de disponibilidad del username
  useEffect(() => {
    const u = form.username
    if (!u) { setUsernameStatus('idle'); return }
    if (!USERNAME_REGEX.test(u)) { setUsernameStatus('invalid'); return }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', u)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(timer)
  }, [form.username])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (usernameStatus !== 'available') {
      setError('El nombre de usuario no es válido o no está disponible.')
      return
    }

    setLoading(true)

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Guardar el username en el perfil (el trigger crea el perfil con full_name)
    await supabase
      .from('profiles')
      .upsert({ id: authData.user.id, full_name: form.full_name, username: form.username })

    setLoading(false)
    navigate(redirect)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center"
      style={{ backgroundImage: "url('/src/assets/stadium.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Conect</h1>
          <p className="text-gray-200 mt-1">Conecta con tus amigos para hacer deporte más fácil y rápido que nunca</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold mb-6">Crear cuenta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="Ej: Mateo González"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de usuario
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">@</span>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  maxLength={20}
                  placeholder="tunombredeusuario"
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {usernameStatus === 'invalid' && (
                <p className="text-xs text-red-500 mt-1">Solo letras minúsculas, números y guiones bajos (3–20 caracteres)</p>
              )}
              {usernameStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1">Verificando disponibilidad...</p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-600 mt-1">Disponible</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-xs text-red-500 mt-1">Este nombre de usuario ya está en uso</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || usernameStatus !== 'available'}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-green-600 font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
