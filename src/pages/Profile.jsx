import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

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

  useEffect(() => {
    fetchProfile()
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

  async function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 2 * 1024 * 1024 // 2MB
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

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    setAvatarUrl(publicUrl)
    setUploading(false)
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

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Foto de perfil */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 flex flex-col items-center gap-4">
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
      </div>
    </div>
  )
}
