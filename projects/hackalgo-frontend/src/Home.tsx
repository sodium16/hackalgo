import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import CreatorPage from './pages/CreatorPage'
import GalleryPage from './pages/GalleryPage'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()
  const [activeTab, setActiveTab] = useState<'creator' | 'gallery'>('creator')

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <div className="navbar-start">
          <div className="text-lg font-bold">Algo-Mint</div>
        </div>
        <div className="navbar-center">
          <div className="tabs tabs-boxed">
            <button className={`tab ${activeTab === 'creator' ? 'tab-active' : ''}`} onClick={() => setActiveTab('creator')}>
              Creator
            </button>
            <button className={`tab ${activeTab === 'gallery' ? 'tab-active' : ''}`} onClick={() => setActiveTab('gallery')}>
              Gallery
            </button>
          </div>
        </div>
        <div className="navbar-end">
          <button data-test-id="connect-wallet" className="btn btn-sm" onClick={toggleWalletModal}>
            {activeAddress ? 'Wallet connected' : 'Connect wallet'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {activeTab === 'creator' ? (
          <CreatorPage onRequestWalletConnect={toggleWalletModal} />
        ) : (
          <GalleryPage onRequestWalletConnect={toggleWalletModal} />
        )}
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
