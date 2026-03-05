import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

/**
 * WalletConnect Component
 * Handles MetaMask wallet connection and signing
 */
export function WalletConnect({ onWalletConnected, onNetworkSwitch }) {
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [signer, setSigner] = useState(null);

  useEffect(() => {
    checkWalletConnection();
    setupListeners();
  }, []);

  /**
   * Check if wallet is already connected
   */
  const checkWalletConnection = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();

          setAccount(address);
          setNetwork(network);
          setSigner(signer);
          onWalletConnected?.(address, signer, network);
        }
      }
    } catch (err) {
      console.error('Error checking wallet:', err);
    }
  };

  /**
   * Setup MetaMask event listeners
   */
  const setupListeners = () => {
    if (!window.ethereum) return;

    // Account changed
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        checkWalletConnection();
      }
    });

    // Network changed
    window.ethereum.on('chainChanged', () => {
      checkWalletConnection();
    });
  };

  /**
   * Connect wallet
   */
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        setError('No account selected');
        return;
      }

      // Get provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const network = await provider.getNetwork();

      setAccount(accounts[0]);
      setNetwork(network);
      setSigner(signer);

      // Sign message for verification
      const message = `I am authenticating for Blockchain P2P File Transfer\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      onWalletConnected?.(accounts[0], signer, network, signature);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      if (err.code === 4001) {
        setError('Connection rejected by user');
      } else {
        setError(err.message);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Switch to Polygon Mumbai testnet
   */
  const switchToPolygonMumbai = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13881' }], // 80001 in hex
      });
    } catch (err) {
      if (err.code === 4902) {
        // Chain not added, add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x13881',
              chainName: 'Polygon Mumbai Testnet',
              rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
              blockExplorerUrls: ['https://mumbai.polygonscan.com'],
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
            },
          ],
        });
      } else {
        setError(`Failed to switch network: ${err.message}`);
      }
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnect = () => {
    setAccount(null);
    setNetwork(null);
    setSigner(null);
    setError(null);
  };

  const isConnected = !!account;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-xl">🔐</span>
        Wallet Connection
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-300 rounded-xl text-red-700 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {isConnected ? (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-300 rounded-xl">
            <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Connected Account</p>
            <p className="font-mono text-xs bg-white bg-opacity-70 p-3 rounded border border-green-200 break-all text-green-900">
              {account}
            </p>
          </div>

          {network && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wider">Network</p>
              <p className="font-bold text-sm text-blue-900">
                {network.name}
              </p>
              <p className="text-xs text-blue-700 mt-1">Chain ID: {network.chainId}</p>
            </div>
          )}

          {network?.chainId !== 80001 && (
            <button
              onClick={switchToPolygonMumbai}
              className="w-full mt-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-semibold transition-all"
            >
              📡 Switch to Polygon Mumbai
            </button>
          )}

          {network?.chainId === 80001 && (
            <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-400 rounded-xl text-green-800 text-sm font-semibold text-center">
              ✅ Connected to Polygon Mumbai
            </div>
          )}

          <button
            onClick={disconnect}
            className="w-full mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all text-sm"
          >
            🔓 Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full px-6 py-4 btn-primary rounded-xl font-semibold transition-all disabled:opacity-60"
        >
          {isConnecting ? '⏳ Connecting...' : '🔗 Connect MetaMask Wallet'}
        </button>
      )}
    </div>
  );
}
