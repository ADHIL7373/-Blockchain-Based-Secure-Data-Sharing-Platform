/**
 * StatusDisplay Component
 * Shows system status and connection information
 */
export function StatusDisplay({
  isSocketConnected = false,
  isPeerConnected = false,
  isWalletConnected = false,
  peers = [],
  error = null,
  txHash = null,
  message = '',
}) {
  const StatusItem = ({ icon, label, isConnected }) => (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:border-gray-300 transition">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`status-dot ${isConnected ? 'active' : 'inactive'}`} />
        <span
          className={`text-xs font-bold ${
            isConnected
              ? 'text-green-600'
              : 'text-gray-500'
          }`}
        >
          {isConnected ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-xl">📊</span>
        Status Overview
      </h2>

      <div className="space-y-3 mb-6">
        <StatusItem icon="🔐" label="Wallet" isConnected={isWalletConnected} />
        <StatusItem icon="🌐" label="Signaling Server" isConnected={isSocketConnected} />
        <StatusItem icon="🔗" label="Peer Connection" isConnected={isPeerConnected} />
      </div>

      {/* Available Peers */}
      {peers.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl mb-4">
          <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
            <span>👥</span>
            Available Peers ({peers.length})
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {peers.map((peer, index) => (
              <div key={index} className="text-xs text-blue-700 font-mono bg-white bg-opacity-60 p-2 rounded border border-blue-200 break-all">
                {peer.slice(0, 10)}...{peer.slice(-8)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Hash */}
      {txHash && (
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl">
          <p className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
            <span>✅</span>
            Transaction Registered
          </p>
          <p className="text-xs text-green-700 font-mono break-all bg-white bg-opacity-60 p-2 rounded border border-green-200">
            {txHash}
          </p>
        </div>
      )}
    </div>
  );
}
