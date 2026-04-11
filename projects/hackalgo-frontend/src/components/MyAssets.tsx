import { useWallet } from '@txnlab/use-wallet-react'
import { useMemo } from 'react'
import { AlgoMintNft } from '../hooks/useAlgoMint'

interface MyAssetsProps {
  nfts: AlgoMintNft[]
  onAction: (assetId: number) => void
}

export default function MyAssets({ nfts, onAction }: MyAssetsProps) {
  const { activeAddress } = useWallet()

  const myNfts = useMemo(() => {
    if (!activeAddress) return []
    return nfts.filter((n) => n.owner === activeAddress)
  }, [activeAddress, nfts])

  if (!activeAddress) return null

  return (
    <div className="bg-base-100 rounded-box shadow-lg p-4 w-full md:w-64 border border-base-300">
      <h3 className="font-black text-xs uppercase tracking-widest mb-4 text-primary">My Collection</h3>

      {myNfts.length === 0 ? (
        <div className="text-center py-6 opacity-40 text-xs italic">No assets owned</div>
      ) : (
        <div className="flex flex-col gap-2">
          {myNfts.map((nft) => (
            <div key={nft.assetId} className="p-3 bg-base-200 rounded-lg flex flex-col gap-2 border border-base-300">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] font-bold">#{nft.assetId}</span>
                <div className="badge badge-outline badge-xs text-[8px]">FENFT</div>
              </div>
              <button className="btn btn-xs btn-primary btn-block text-[10px]" onClick={() => onAction(nft.assetId)}>
                Manage Asset
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-base-300">
        <div className="text-[10px] opacity-50 uppercase font-bold">Portfolio Value</div>
        <div className="text-lg font-black">{myNfts.length * 15} ALGO</div>
      </div>
    </div>
  )
}
