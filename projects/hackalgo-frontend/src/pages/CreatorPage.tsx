import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useMemo, useState } from 'react'
import { useAlgoMint } from '../hooks/useAlgoMint'

export default function CreatorPage(props: { onRequestWalletConnect: () => void }) {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const algoMint = useAlgoMint()

  const [nftCount, setNftCount] = useState<number>(10)
  const [totalPercent, setTotalPercent] = useState<number>(5)
  const [durationYears, setDurationYears] = useState<number>(3)
  const [incomeAmount, setIncomeAmount] = useState<number>(10_000)
  const [quarter, setQuarter] = useState<number>(20261)
  const [salePriceMicroAlgo, setSalePriceMicroAlgo] = useState<number>(1_000_000)

  const canReportIncome = useMemo(
    () => !!activeAddress && algoMint.creatorAddress === activeAddress && !!algoMint.terms,
    [activeAddress, algoMint.creatorAddress, algoMint.terms],
  )

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="card-title">Mint your future earnings NFTs</h2>
            <p className="text-sm opacity-70">Hackathon demo: mints real NFTs + distributes real payouts on-chain.</p>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await algoMint.resetMock()
              enqueueSnackbar('Mock state reset', { variant: 'info' })
            }}
          >
            Reset demo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="form-control">
            <div className="label">
              <span className="label-text">Number of NFTs</span>
            </div>
            <input
              type="number"
              min={1}
              className="input input-bordered"
              value={nftCount}
              onChange={(e) => setNftCount(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Total % of earnings</span>
            </div>
            <input
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              className="input input-bordered"
              value={totalPercent}
              onChange={(e) => setTotalPercent(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Duration (years)</span>
            </div>
            <input
              type="number"
              min={1}
              className="input input-bordered"
              value={durationYears}
              onChange={(e) => setDurationYears(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">NFT price (microAlgos)</span>
            </div>
            <input
              type="number"
              min={1}
              className="input input-bordered"
              value={salePriceMicroAlgo}
              onChange={(e) => setSalePriceMicroAlgo(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!activeAddress) {
                props.onRequestWalletConnect()
                enqueueSnackbar('Connect wallet first', { variant: 'warning' })
                return
              }

              try {
                const totalPctBps = Math.round(totalPercent * 100)
                const assetIds = await algoMint.mint_future_nft({
                  creator: activeAddress,
                  nft_count: nftCount,
                  total_pct_bps: totalPctBps,
                  duration_years: durationYears,
                  start_quarter: quarter,
                  sale_price_micro_algo: salePriceMicroAlgo,
                })
                enqueueSnackbar(`Minted ${assetIds.length} NFTs`, { variant: 'success' })
              } catch (e) {
                enqueueSnackbar((e as Error).message, { variant: 'error' })
              }
            }}
          >
            Mint future NFTs
          </button>

          <div className="text-sm opacity-80">
            {algoMint.terms ? (
              <>
                Minted: <b>{algoMint.terms.nft_count}</b> NFTs, <b>{(algoMint.terms.total_pct_bps / 100).toFixed(2)}%</b> for{' '}
                <b>{algoMint.terms.duration_years}</b> years, price <b>{algoMint.terms.sale_price_micro_algo}</b> µALGO
              </>
            ) : (
              <>No mint yet</>
            )}
          </div>
        </div>

        <div className="divider">Quarterly payout demo</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="form-control">
            <div className="label">
              <span className="label-text">Quarter</span>
            </div>
            <input
              type="number"
              min={1}
              className="input input-bordered"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Reported income amount (mock USD)</span>
            </div>
            <input
              type="number"
              min={1}
              className="input input-bordered"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(Number(e.target.value))}
            />
          </label>

          <button
            className="btn"
            disabled={!canReportIncome}
            onClick={async () => {
              if (!activeAddress) {
                props.onRequestWalletConnect()
                enqueueSnackbar('Connect wallet first', { variant: 'warning' })
                return
              }

              try {
                const res = await algoMint.report_income({ creator: activeAddress, quarter, income_amount: incomeAmount })
                enqueueSnackbar(`Reported income. Total payout: ${res.totalPayout.toFixed(2)}; per NFT: ${res.perNft.toFixed(2)}`, {
                  variant: 'success',
                })
              } catch (e) {
                enqueueSnackbar((e as Error).message, { variant: 'error' })
              }
            }}
          >
            Report income → distribute
          </button>
        </div>

        {!canReportIncome && algoMint.terms && (
          <div className="text-xs opacity-70">Only the creator wallet that minted can report income in this demo.</div>
        )}
      </div>
    </div>
  )
}
