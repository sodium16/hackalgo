import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityEvent } from '../components/ActivityFeed'
import { AlgoMintNft, useAlgoMint } from '../hooks/useAlgoMint'

type NftRow = AlgoMintNft & { pendingPayout: number }

export default function GalleryPage(props: {
  onRequestWalletConnect: () => void
  onEvent?: (type: ActivityEvent['type'], message: string, txId?: string) => void
}) {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const algoMint = useAlgoMint()

  const [rows, setRows] = useState<NftRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const nfts = await algoMint.listNfts()
      const withPending: NftRow[] = await Promise.all(
        nfts.map(async (n) => ({
          ...n,
          pendingPayout: activeAddress ? await algoMint.get_pending_payout({ asset_id: n.assetId, address: activeAddress }) : 0,
        })),
      )
      setRows(withPending)
    } catch (e) {
      enqueueSnackbar((e as Error).message ?? 'Failed to load gallery', { variant: 'error' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [activeAddress, algoMint.get_pending_payout, algoMint.listNfts, enqueueSnackbar])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ownedAssetIds = useMemo(() => {
    if (!activeAddress) return new Set<number>()
    return new Set(rows.filter((r) => r.owner === activeAddress).map((r) => r.assetId))
  }, [activeAddress, rows])

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="card-title">Gallery</h2>
            <p className="text-sm opacity-70">Buy NFTs and claim payouts on-chain.</p>
          </div>

          <button className="btn btn-sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner" />
            <span className="text-sm opacity-70">Loading NFTs…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Owner</th>
                  <th>Pending payout</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOwned = activeAddress ? ownedAssetIds.has(r.assetId) : false
                  const isForSale = !r.owner
                  return (
                    <tr key={r.assetId}>
                      <td className="font-mono">{r.assetId}</td>
                      <td className="text-xs">{r.owner ?? <span className="opacity-60">For sale</span>}</td>
                      <td className="font-mono">{(r.pendingPayout ?? 0).toFixed(2)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!isForSale}
                            onClick={async () => {
                              if (!activeAddress) {
                                props.onRequestWalletConnect()
                                enqueueSnackbar('Connect wallet first', { variant: 'warning' })
                                return
                              }
                              try {
                                await algoMint.buy_nft({ buyer: activeAddress, asset_id: r.assetId }).then(() => {
                                  props.onEvent?.('BUY', `Bought NFT #${r.assetId}`)
                                })
                                enqueueSnackbar('Bought NFT', { variant: 'success' })
                                await refresh()
                              } catch (e) {
                                enqueueSnackbar((e as Error).message, { variant: 'error' })
                              }
                            }}
                          >
                            Buy
                          </button>

                          <button
                            className="btn btn-sm"
                            disabled={!isOwned || r.pendingPayout <= 0}
                            onClick={async () => {
                              if (!activeAddress) {
                                props.onRequestWalletConnect()
                                enqueueSnackbar('Connect wallet first', { variant: 'warning' })
                                return
                              }
                              try {
                                await algoMint.claim_payout({ address: activeAddress, asset_id: r.assetId }).then(() => {
                                  props.onEvent?.('CLAIM', `Claimed payout for NFT #${r.assetId}`)
                                })
                                enqueueSnackbar('Claimed payout', { variant: 'success' })
                                await refresh()
                              } catch (e) {
                                enqueueSnackbar((e as Error).message, { variant: 'error' })
                              }
                            }}
                          >
                            Claim
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
