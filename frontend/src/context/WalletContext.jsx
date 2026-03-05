import { createContext, useState, useCallback, useEffect, useContext } from 'react';

export const WalletContext = createContext();

/**
 * Wallet Context Provider
 * Manages wallet state across the application
 */
export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [signature, setSignature] = useState(null);

  /**
   * Update wallet state
   */
  const updateWallet = useCallback((address, signer, network, signature) => {
    setAccount(address);
    setSigner(signer);
    setNetwork(network);
    setSignature(signature);
    setIsConnected(true);
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setNetwork(null);
    setSignature(null);
    setIsConnected(false);
  }, []);

  const value = {
    account,
    signer,
    network,
    isConnected,
    signature,
    updateWallet,
    disconnectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
