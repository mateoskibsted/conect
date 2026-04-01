import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function Friends() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isOwnProfile = !id || id === user?.id
  const targetId = id ?? user?.id

  const [friends, setFriends] = useState([])
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !targetId) return
    if (id === user.id) navigate('/amigos', { replace: true })
    loadFriends()
  }, [user, targetId])

  async function loadFriends() {
    const requests = [
      supabase.from('friendships').select('addressee_id').eq('requester_id', targetId).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id').eq('addressee_id', targetId).eq('status', 'accepted'),
    ]
    if (!isOwnProfile) {
      requests.push(supabase.from('profiles').select('full_name').eq('id', targetId).single())
    }

    const results = await Promise.all(requests)
    const sent = results[0].data ?? []
    const received = results[1].data ?? []

    if (!isOwnProfile && results[2]?.data) {
      setOwnerName(results[2].data.full_name?.split(' ')[0] ?? '')
    }

    const sentSet = new Set(sent.map(f => f.addressee_id))
    const receivedSet = new Set(received.map(f => f.requester_id))
    const friendIds = [...sentSet].filter(fid => receivedSet.has(fid))

    if (friendIds.length === 0) {
      setFriends([])
      setLoading(false)
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', friendIds)
      .order('full_name')

    setFriends(profiles ?? [])
    setLoading(false)
  }

  const title = isOwnProfile ? 'Mis amigos' : `Amigos de ${ownerName}`

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 pb-bottom-nav">
        <h1 className="text-lg font-bold text-gray-900 mb-4">{title}</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">
              {isOwnProfile ? 'Aún no tienes amigos' : 'Este usuario no tiene amigos aún'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {friends.map(friend => (
              <Link
                key={friend.id}
                to={`/usuario/${friend.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                {friend.avatar_url ? (
                  <img src={friend.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="text-base font-bold text-green-600">
                      {friend.full_name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{friend.full_name}</p>
                  {friend.username && (
                    <p className="text-sm text-gray-400 truncate">@{friend.username}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
