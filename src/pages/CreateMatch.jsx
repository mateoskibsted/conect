import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateSlug } from '../lib/utils'

const INITIAL_FORM = {
  title: '',
  description: '',
  match_date: '',
  match_time: '',
  location: '',
  total_spots: '',
  visibility: 'public',
}

export default function CreateMatch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const slug = generateSlug(form.title)

    const { data, error } = await supabase
      .from('matches')
      .insert({
        creator_id:   user.id,
        sport:        'football',
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        match_date:   form.match_date,
        match_time:   form.match_time,
        location:     form.location.trim(),
        total_spots:  parseInt(form.total_spots),
        visibility:   form.visibility,
        slug,
      })
      .select('slug')
      .single()

    setLoading(false)

    if (error) {
      setError('Hubo un error al crear el partido. Intenta de nuevo.')
      return
    }

    navigate(`/partido/${data.slug}`)
  }

  // Fecha mínima: hoy
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-semibold text-gray-800">Crear partido</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Deporte – fijo en MVP */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Deporte</p>
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-2xl">⚽</span>
              <span className="font-semibold text-green-800">Fútbol</span>
            </div>
          </div>

          {/* Datos del partido */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Detalles</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                maxLength={80}
                placeholder="Ej: Partido 7v7 casual este sábado"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Ej: Nivel intermedio, traer peto. Si llueve se suspende."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Fecha y hora */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Cuándo</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="match_date"
                  value={form.match_date}
                  onChange={handleChange}
                  required
                  min={today}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="match_time"
                  value={form.match_time}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Lugar y cupos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Dónde y cuántos</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lugar <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                placeholder="Ej: Parque O'Higgins, entrada sur"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cupos disponibles <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="total_spots"
                value={form.total_spots}
                onChange={handleChange}
                required
                min={1}
                max={50}
                placeholder="Ej: 14"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Número total de jugadores que pueden unirse</p>
            </div>
          </div>

          {/* Visibilidad */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Visibilidad</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, visibility: 'public' }))}
                className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.visibility === 'public'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">🌍</span>
                <span className="font-semibold text-sm text-gray-800">Público</span>
                <span className="text-xs text-gray-500">Cualquiera con el link puede unirse</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, visibility: 'private' }))}
                className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-colors text-left ${
                  form.visibility === 'private'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">🔒</span>
                <span className="font-semibold text-sm text-gray-800">Privado</span>
                <span className="text-xs text-gray-500">Solo visible para invitados directos</span>
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
          >
            {loading ? 'Publicando partido...' : 'Publicar partido ⚽'}
          </button>
        </form>
      </div>
    </div>
  )
}
