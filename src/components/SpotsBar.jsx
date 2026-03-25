export default function SpotsBar({ occupied, total }) {
  const percentage = Math.min((occupied / total) * 100, 100)
  const isFull = occupied >= total

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          {occupied} de {total} cupos ocupados
        </span>
        {isFull && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            Completo
          </span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
