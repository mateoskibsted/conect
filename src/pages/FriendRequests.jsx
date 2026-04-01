import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function FriendRequests() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadRequests()
  }, [user])

  async function loadRequests() {
    const { data: rows } = await supabase
      .from('friendships')
      .select('requester_id, created_at')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!rows?.length) {
      setRequests([])
      setLoading(false)
      return
    }

    const ids = rows.map(r => r.requester_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', ids)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setRequests(rows.map(r => ({ ...r, profile: profileMap[r.requester_id] ?? null })))
    setLoading(false)
  }

  async function accept(requesterId) {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', requesterId)
      .eq('addressee_id', user.id)
    setRequests(prev => prev.filter(r => r.requester_id !== requesterId))
  }

  async function reject(requesterId) {
    await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', requesterId)
      .eq('addressee_id', user.id)
    setRequests(prev => prev.filter(r => r.requester_id !== requesterId))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-800">Solicitudes de amistad</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-bottom-nav">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">No tienes solicitudes pendientes</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {requests.map(req => (
              <div key={req.requester_id} className="flex items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div
                  className="shrink-0 cursor-pointer"
                  onClick={() => navigate(`/usuario/${req.requester_id}`)}
                >
                  {req.profile?.avatar_url ? (
                    <img
                      src={req.profile.avatar_url}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-base font-bold text-green-600">
                        {req.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Nombre */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/usuario/${req.requester_id}`)}
                >
                  <p className="font-medium text-gray-900 truncate">
                    {req.profile?.full_name ?? 'Usuario'}
                  </p>
                  {req.profile?.username && (
                    <p className="text-sm text-gray-400 truncate">@{req.profile.username}</p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => accept(req.requester_id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => reject(req.requester_id)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
