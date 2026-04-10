import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import CreatorPage from './pages/CreatorPage'
import GalleryPage from './pages/GalleryPage'
import PortfolioPage from './pages/PortfolioPage' // Import the new page

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()
  // Updated type to include 'portfolio'
  const [activeTab, setActiveTab] = useState<'creator' | 'gallery' | 'portfolio'>('creator')

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="navbar-start">
          <div className="text-xl font-black tracking-tighter text-primary">ALGO-MINT</div>
        </div>
        <div className="navbar-center">
          <div className="tabs tabs-boxed bg-base-200">
            <button className={`tab transition-all ${activeTab === 'creator' ? 'tab-active' : ''}`} onClick={() => setActiveTab('creator')}>
              Creator
            </button>
            <button className={`tab transition-all ${activeTab === 'gallery' ? 'tab-active' : ''}`} onClick={() => setActiveTab('gallery')}>
              Gallery
            </button>
            <button
              className={`tab transition-all ${activeTab === 'portfolio' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portfolio
            </button>
          </div>
        </div>
        <div className="navbar-end">
          <button
            data-test-id="connect-wallet"
            className={`btn btn-sm ${activeAddress ? 'btn-success btn-outline' : 'btn-primary'}`}
            onClick={toggleWalletModal}
          >
            {activeAddress ? 'Wallet Active' : 'Connect Wallet'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {activeTab === 'creator' && <CreatorPage onRequestWalletConnect={toggleWalletModal} />}
        {activeTab === 'gallery' && <GalleryPage onRequestWalletConnect={toggleWalletModal} />}
        {activeTab === 'portfolio' && <PortfolioPage />}
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
