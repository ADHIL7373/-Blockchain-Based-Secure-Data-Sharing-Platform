import { useState, useEffect } from 'react';

/**
 * TransferReceiver Component
 * Shows available peers and allows requesting incoming file transfer
 */
export function TransferReceiver({
  peers = [],
  isLoading = false,
  onRequestTransfer = null,
  disabled = false,
}) {
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [showPeerList, setShowPeerList] = useState(false);

  /**
   * Handle peer selection
   */
  const handlePeerSelect = (peer) => {
    setSelectedPeer(peer);
    setShowPeerList(false);
  };

  /**
   * Clear peer selection
   */
  const clearSelection = () => {
    setSelectedPeer(null);
  };

  /**
   * Request file transfer from peer
   */
  const requestTransfer = async () => {
    if (!selectedPeer) return;
    onRequestTransfer?.(selectedPeer);
  };

  return (
    <div className="card p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-xl">📥</span>
        Request File from Peer
      </h2>

      {peers.length === 0 ? (
        <div className="p-6 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-xl text-center">
          <p className="text-3xl mb-2">😴</p>
          <p className="text-gray-700 font-semibold">Waiting for peers...</p>
          <p className="text-sm text-gray-600 mt-2">Connect your wallet and other peers will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Peer Selection */}
          {selectedPeer ? (
            <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-400 rounded-xl">
              <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Selected Peer</p>
              <p className="font-mono text-sm break-all text-blue-900 font-semibold bg-white bg-opacity-70 p-3 rounded border border-blue-200">
                {selectedPeer}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Available Peers ({peers.length})</p>
              <div className="relative">
                <button
                  onClick={() => setShowPeerList(!showPeerList)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl text-left text-sm font-semibold text-gray-800 hover:from-gray-200 hover:to-gray-300 transition"
                >
                  {peers.length > 0
                    ? `👥 Select a peer (${peers.length})`
                    : 'No peers available'}
                </button>

                {showPeerList && peers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-300 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {peers.map((peer, index) => (
                      <button
                        key={index}
                        onClick={() => handlePeerSelect(peer)}
                        className="w-full p-3 text-left text-xs font-mono hover:bg-blue-100 border-b border-gray-200 last:border-b-0 transition font-semibold text-gray-900 break-all"
                      >
                        {peer.slice(0, 8)}...{peer.slice(-8)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {selectedPeer && (
              <button
                onClick={clearSelection}
                disabled={isLoading || disabled}
                className="flex-1 px-4 py-3 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition-all"
              >
                ✕ Clear
              </button>
            )}

            <button
              onClick={requestTransfer}
              disabled={!selectedPeer || isLoading || disabled}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              {isLoading ? '⏳ Waiting...' : '🔄 Request File'}
            </button>
          </div>
        </div>
      )}

      {peers.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 text-center font-medium">
          💡 Select a peer and request their file to begin transfer
        </div>
      )}
    </div>
  );
}
