import { Link } from 'react-router-dom'

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

export default function MatchCard({ match }) {
  const occupied = (match.match_players?.[0]?.count ?? 0) + (match.match_guests?.[0]?.count ?? 0)
  const isFull = occupied >= match.total_spots
  const spotsLeft = match.total_spots - occupied

  return (
    <Link to={`/partido/${match.slug}`} className="block">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-100 transition-all p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">⚽</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-800 truncate">{match.title}</h3>
              <p className="text-sm text-gray-500 truncate mt-0.5">📍 {match.location}</p>
            </div>
          </div>
          {isFull ? (
            <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              Completo
            </span>
          ) : (
            <span className="flex-shrink-0 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              {spotsLeft} cupo{spotsLeft !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <span>📅 {formatDate(match.match_date)}</span>
          <span>🕐 {formatTime(match.match_time)}</span>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{occupied} de {match.total_spots} jugadores</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
              style={{ width: `${Math.min((occupied / match.total_spots) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
