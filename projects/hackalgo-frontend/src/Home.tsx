/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState, useEffect } from 'react'
import ConnectWallet from './components/ConnectWallet'
import CreatorPage from './pages/CreatorPage'
import GalleryPage from './pages/GalleryPage'
import PortfolioPage from './pages/PortfolioPage' // Import the new page
import TradePage from './pages/TradePage'
import MyAssets from './components/MyAssets'
import { useAlgoMint } from './hooks/useAlgoMint'
import ActivityFeed, { ActivityEvent } from './components/ActivityFeed'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()
  const [activeTab, setActiveTab] = useState<'creator' | 'gallery' | 'portfolio' | 'trade'>('creator')
  const { listNfts } = useAlgoMint()
  const [allNfts, setAllNfts] = useState<any[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])

  const addEvent = (type: ActivityEvent['type'], message: string, txId?: string) => {
    const newEvent: ActivityEvent = {
      id: Math.random().toString(36),
      type,
      message,
      timestamp: new Date(),
      txId
    }
    setEvents(prev => [newEvent, ...prev].slice(0, 10))
  }

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }


  useEffect(() => {
    const load = async () => {
      const data = await listNfts()
      setAllNfts(data)
    }
    load()
  }, [listNfts])

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
            <button className={`tab ${activeTab === 'trade' ? 'tab-active' : ''}`} onClick={() => setActiveTab('trade')}>
              Trade
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

      <div className="max-w-7xl mx-auto p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          {activeTab === 'creator' && <CreatorPage onRequestWalletConnect={toggleWalletModal} onEvent={addEvent} />}
          {activeTab === 'gallery' && <GalleryPage onRequestWalletConnect={toggleWalletModal} onEvent={addEvent} />}
          {activeTab === 'portfolio' && <PortfolioPage events={events}/>}
          {activeTab === 'trade' && <TradePage onEvent={addEvent} />}
        </div>

        {(activeTab === 'gallery' || activeTab === 'trade') && (
          <div className="shrink-0">
            <MyAssets nfts={allNfts} onAction={(id) => setActiveTab('gallery')} />
          </div>
        )}
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

export default Home
