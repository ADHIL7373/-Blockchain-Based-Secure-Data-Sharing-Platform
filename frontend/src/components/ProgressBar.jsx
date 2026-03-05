/**
 * ProgressBar Component
 * Shows file transfer progress
 */
export function ProgressBar({ progress = 0, status = '', showPercentage = true }) {
  const percentage = Math.min(Math.max(progress, 0), 100);

  const statusConfig = {
    idle: { color: 'from-gray-400 to-gray-500', text: '⏸️ Ready', icon: '⏸️' },
    connecting: { color: 'from-yellow-400 to-yellow-500', text: '⏳ Connecting', icon: '⏳' },
    connected: { color: 'from-blue-400 to-blue-500', text: '🔗 Connected', icon: '🔗' },
    sending: { color: 'from-blue-500 to-blue-600', text: '📤 Sending', icon: '📤' },
    receiving: { color: 'from-green-500 to-green-600', text: '📥 Receiving', icon: '📥' },
    verifying: { color: 'from-purple-500 to-purple-600', text: '🔍 Verifying', icon: '🔍' },
    completed: { color: 'from-emerald-500 to-green-600', text: '✅ Completed', icon: '✅' },
    error: { color: 'from-red-500 to-red-600', text: '❌ Error', icon: '❌' },
  }[status] || { color: 'from-gray-400 to-gray-500', text: status, icon: '•' };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusConfig.icon}</span>
          <p className="text-sm font-bold text-gray-800">{statusConfig.text}</p>
        </div>
        {showPercentage && (
          <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {percentage}%
          </p>
        )}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-md">
        <div
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${statusConfig.color} shadow-lg`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage > 0 && percentage < 100 && (
        <p className="text-xs text-gray-600 mt-3 text-center">
          {percentage === 100 ? 'Almost done...' : `${percentage}% complete`}
        </p>
      )}
    </div>
  );
}
