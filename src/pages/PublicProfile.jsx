import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function PublicProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [matchesPlayed, setMatchesPlayed] = useState(0)
  const [vToT, setVToT] = useState(null) // viewer → target
  const [tToV, setTToV] = useState(null) // target → viewer
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && id === user.id) navigate('/perfil', { replace: true })
  }, [user, id])

  useEffect(() => {
    if (!user || !id || id === user.id) return
    loadData()
  }, [user, id])

  async function loadData() {
    const [{ data: prof }, { count }, { data: friendships }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', id).single(),
      supabase.from('match_players').select('id', { count: 'exact', head: true }).eq('player_id', id),
      supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
    ])

    setProfile(prof)
    setMatchesPlayed(count ?? 0)

    if (friendships) {
      setVToT(friendships.find(f => f.requester_id === user.id && f.addressee_id === id) ?? null)
      setTToV(friendships.find(f => f.requester_id === id && f.addressee_id === user.id) ?? null)
    }
    setLoading(false)
  }

  async function sendRequest() {
    const { data } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: id })
      .select()
      .single()
    setVToT(data)
  }

  async function cancelRequest() {
    await supabase.from('friendships').delete().eq('requester_id', user.id).eq('addressee_id', id)
    setVToT(null)
  }

  async function acceptRequest() {
    const { data } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', id)
      .eq('addressee_id', user.id)
      .select()
      .single()
    setTToV(data)
  }

  function FriendButton() {
    const isFriends = vToT?.status === 'accepted' && tToV?.status === 'accepted'

    if (isFriends) {
      return (
        <span className="px-5 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-200">
          Amigos
        </span>
      )
    }

    // Target sent a request to viewer (pending or accepted) → viewer can accept
    if (tToV?.status === 'pending') {
      return (
        <button
          onClick={acceptRequest}
          className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Aceptar solicitud
        </button>
      )
    }

    // Viewer accepted target's request, now viewer needs to send theirs back
    if (!vToT && tToV?.status === 'accepted') {
      return (
        <button
          onClick={sendRequest}
          className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Enviar solicitud de vuelta
        </button>
      )
    }

    // Viewer sent and was accepted — waiting for target to send theirs
    if (vToT?.status === 'accepted' && !tToV) {
      return (
        <span className="px-5 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm">
          Solicitud aceptada · Esperando la suya
        </span>
      )
    }

    // Viewer already sent, pending response
    if (vToT?.status === 'pending') {
      return (
        <button
          onClick={cancelRequest}
          className="px-5 py-2 bg-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Solicitud enviada · Cancelar
        </button>
      )
    }

    // No relationship
    return (
      <button
        onClick={sendRequest}
        className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
      >
        Enviar solicitud
      </button>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-20 text-gray-500">Usuario no encontrado</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl font-bold text-green-600">
                {profile.full_name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>
          {profile.username && (
            <p className="text-sm text-green-700 font-medium -mt-2">@{profile.username}</p>
          )}

          <div className="flex flex-col items-center px-8 py-3 bg-gray-50 rounded-xl">
            <span className="text-2xl font-bold text-green-600">{matchesPlayed}</span>
            <span className="text-xs text-gray-500 mt-0.5">partidos jugados</span>
          </div>

          <FriendButton />
        </div>
      </div>
    </div>
  )
}
