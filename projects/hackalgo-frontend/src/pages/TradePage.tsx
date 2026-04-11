import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useState } from 'react'
import { ActivityEvent } from '../components/ActivityFeed'
import { AlgoMintNft, useAlgoMint } from '../hooks/useAlgoMint'

export default function TradePage(props: { onEvent?: (type: ActivityEvent['type'], message: string, txId?: string) => void }) {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const algoMint = useAlgoMint()

  const [marketItems, setMarketItems] = useState<AlgoMintNft[]>([])
  const [loading, setLoading] = useState(true)

  const refreshMarket = useCallback(async () => {
    setLoading(true)
    try {
      const allNfts = await algoMint.listNfts()
      // For this demo, we treat "unknown" owners as potential secondary listings
      const secondaryListings = allNfts.filter((n) => n.owner !== null && n.owner !== activeAddress)
      setMarketItems(secondaryListings)
    } catch (e) {
      enqueueSnackbar('Failed to load market', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [activeAddress, algoMint, enqueueSnackbar])

  useEffect(() => {
    refreshMarket()
  }, [refreshMarket])

  return (
    <div className="card bg-base-100 shadow-xl border-t-4 border-accent">
      <div className="card-body">
        <h2 className="card-title text-2xl font-black italic">P2P TRADE CENTER</h2>
        <p className="text-sm opacity-60">Buy from other investors. 10% royalty automatically sent to creator.</p>

        {loading ? (
          <span className="loading loading-bars loading-lg mx-auto"></span>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {marketItems.map((item) => (
              <div key={item.assetId} className="p-4 bg-base-200 rounded-lg flex justify-between items-center border border-base-300">
                <div>
                  <div className="text-xs font-bold opacity-50">FENFT #{item.assetId}</div>
                  <div className="font-mono text-[10px] truncate w-32">{item.owner}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-success">15.00 ALGO</div>
                  <button
                    className="btn btn-xs btn-accent mt-1"
                    onClick={async () => {
                      try {
                        // In a real app, this would call a secondary_sale method
                        enqueueSnackbar('Initiating Atomic Swap with Royalties...', { variant: 'info' })
                        // Mocking the trade logic for the demo
                        setTimeout(() => {
                          enqueueSnackbar('Trade Successful: Creator received 1.5 ALGO', { variant: 'success' })
                          props.onEvent?.('BUY', `Secondary sale completed for NFT #${item.assetId}`)
                        }, 2000)
                      } catch (e) {
                        enqueueSnackbar('Trade failed', { variant: 'error' })
                      }
                    }}
                  >
                    Buy (Inc. Royalty)
                  </button>
                </div>
              </div>
            ))}
            {marketItems.length === 0 && <div className="col-span-2 text-center py-10 opacity-40 italic">No secondary listings found.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
