import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import MatchCard from '../components/MatchCard'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [playedMatches, setPlayedMatches] = useState([])
  const [friendCount, setFriendCount] = useState(0)

  // Para usuarios sin username
  const [newUsername, setNewUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState(null)

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchPlayedMatches()
      fetchFriendCount()
    }
  }, [user])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setFullName(data.full_name)
      setAvatarUrl(data.avatar_url)
    }
  }

  async function fetchFriendCount() {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('friendships').select('addressee_id').eq('requester_id', user.id).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id').eq('addressee_id', user.id).eq('status', 'accepted'),
    ])
    const sentSet = new Set((sent ?? []).map(f => f.addressee_id))
    const receivedSet = new Set((received ?? []).map(f => f.requester_id))
    setFriendCount([...sentSet].filter(id => receivedSet.has(id)).length)
  }

  async function fetchPlayedMatches() {
    const { data: myMatches } = await supabase
      .from('match_players')
      .select('match_id')
      .eq('player_id', user.id)

    if (!myMatches?.length) return

    const matchIds = myMatches.map(r => r.match_id)

    const { data } = await supabase
      .from('matches')
      .select(`
        id, title, slug, sport, match_date, match_time,
        location, total_spots, visibility,
        match_players(count),
        match_guests(count)
      `)
      .in('id', matchIds)
      .order('match_date', { ascending: false })

    const played = (data ?? []).filter(m => {
      const players = m.match_players?.[0]?.count ?? 0
      const guests = m.match_guests?.[0]?.count ?? 0
      return players + guests >= m.total_spots
    })

    setPlayedMatches(played)
  }

  async function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setError('La imagen debe pesar menos de 2MB.')
      return
    }

    setError(null)
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Error al subir la imagen.')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  // Verificación de disponibilidad del username (solo para usuarios sin username)
  useEffect(() => {
    const u = newUsername
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
  }, [newUsername])

  async function handleSaveUsername() {
    if (usernameStatus !== 'available') return
    setUsernameError(null)
    setSavingUsername(true)

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id)

    setSavingUsername(false)

    if (error) {
      setUsernameError('Error al guardar el nombre de usuario.')
    } else {
      setProfile(prev => ({ ...prev, username: newUsername }))
      setNewUsername('')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!fullName.trim()) return

    setError(null)
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      setError('Error al guardar los cambios.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-6 pb-bottom-nav space-y-4">
        {/* Foto de perfil */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 flex flex-col items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="relative group focus:outline-none"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-green-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-green-100 ring-4 ring-green-50 flex items-center justify-center text-green-700 text-3xl font-bold">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {profile.username && (
            <p className="text-sm font-medium text-green-700">@{profile.username}</p>
          )}

          <div className="flex gap-6">
            <Link to="/amigos" className="flex flex-col items-center hover:opacity-70 transition-opacity">
              <span className="text-lg font-bold text-gray-900">{friendCount}</span>
              <span className="text-xs text-gray-500">amigos</span>
            </Link>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">{playedMatches.length}</span>
              <span className="text-xs text-gray-500">partidos</span>
            </div>
          </div>

          <p className="text-sm text-gray-400">
            {uploading ? 'Subiendo...' : 'Toca la foto para cambiarla'}
          </p>
        </div>

        {/* Datos del perfil */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Mis datos</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              maxLength={80}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {profile.username && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de usuario
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">@</span>
                <input
                  type="text"
                  value={profile.username}
                  disabled
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">El nombre de usuario no se puede cambiar</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2.5 border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || fullName.trim() === profile.full_name}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}
          </button>
        </form>

        {/* Elegir username (solo para usuarios que aún no tienen) */}
        {!profile.username && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-amber-800 uppercase tracking-wide">Elige tu nombre de usuario</p>
              <p className="text-xs text-amber-700 mt-1">Una vez elegido no podrás cambiarlo.</p>
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">@</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={20}
                  placeholder="tunombredeusuario"
                  className="w-full pl-8 pr-4 py-2.5 border border-amber-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
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

            {usernameError && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{usernameError}</p>
            )}

            <button
              type="button"
              onClick={handleSaveUsername}
              disabled={savingUsername || usernameStatus !== 'available'}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {savingUsername ? 'Guardando...' : 'Guardar nombre de usuario'}
            </button>
          </div>
        )}

        {/* Deportes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Deportes</p>
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="text-2xl">⚽</span>
            <div>
              <p className="font-semibold text-green-800 text-sm">Fútbol</p>
              <p className="text-xs text-green-600">Más deportes disponibles próximamente</p>
            </div>
          </div>
        </div>

        {/* Partidos jugados */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide px-1">
            Partidos jugados
            {playedMatches.length > 0 && (
              <span className="ml-2 normal-case font-normal text-gray-400">({playedMatches.length})</span>
            )}
          </p>

          {playedMatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
              <p className="text-gray-400 text-sm">Aún no tienes partidos jugados</p>
            </div>
          ) : (
            playedMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
