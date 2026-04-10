import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlgomintClient, AlgomintFactory } from '../contracts/Algomint'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

type AlgoMintTerms = {
  nft_count: number
  total_pct_bps: number
  duration_years: number
  start_quarter: number
  sale_price_micro_algo: number
  first_asset_id: number
}

export type AlgoMintNft = {
  assetId: number
  owner: string | null
}

type PersistedState = {
  appId: string | null
}

const STORAGE_KEY = 'algomint:mock:state:v1'

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as PersistedState
    return {
      ...defaultState(),
      ...parsed,
    }
  } catch {
    return defaultState()
  }
}

function saveState(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function defaultState(): PersistedState {
  return {
    appId: null,
  }
}

export function useAlgoMint() {
  const { transactionSigner, activeAddress } = useWallet()
  const [state, setState] = useState<PersistedState>(() => loadState())
  const [termsValue, setTermsValue] = useState<AlgoMintTerms | null>(null)
  const [creatorAddressValue, setCreatorAddressValue] = useState<string | null>(null)

  const persist = useCallback((next: PersistedState) => {
    setState(next)
    saveState(next)
  }, [])

  // Important: Memoize configs to avoid recreating AlgorandClient every render
  // (which can cause effects to re-run and lock the UI in a re-render loop).
  const algodConfig = useMemo(() => getAlgodConfigFromViteEnvironment(), [])
  const indexerConfig = useMemo(() => getIndexerConfigFromViteEnvironment(), [])
  const algorand = useMemo(() => AlgorandClient.fromConfig({ algodConfig, indexerConfig }), [algodConfig, indexerConfig])

  const getClient = useCallback(async (): Promise<AlgomintClient> => {
    if (!transactionSigner || !activeAddress) {
      throw new Error('Wallet not connected')
    }

    if (state.appId) {
      return new AlgomintClient({
        algorand,
        appId: BigInt(state.appId),
        defaultSender: activeAddress,
        defaultSigner: transactionSigner,
      })
    }

    // Hackathon convenience: deploy the app from the UI on first use.
    const factory = new AlgomintFactory({
      algorand,
      defaultSender: activeAddress,
      defaultSigner: transactionSigner,
    })

    const deployed = await factory.send.create.bare({})
    const appId = deployed.appClient.appId.toString()
    persist({ appId })

    return deployed.appClient.clone({ defaultSender: activeAddress, defaultSigner: transactionSigner })
  }, [activeAddress, algorand, persist, state.appId, transactionSigner])

  const fetchTerms = useCallback(async (): Promise<AlgoMintTerms | null> => {
    if (!state.appId) return null
    const client = await getClient()
    const [creator, totalNfts, totalPctBps, durationYears, startQuarter, salePrice, firstAssetId] =
      await client.getTerms()
    return {
      nft_count: Number(totalNfts),
      total_pct_bps: Number(totalPctBps),
      duration_years: Number(durationYears),
      start_quarter: Number(startQuarter),
      sale_price_micro_algo: Number(salePrice),
      first_asset_id: Number(firstAssetId),
    }
  }, [getClient, state.appId])

  const refreshTerms = useCallback(async () => {
    if (!state.appId || !transactionSigner || !activeAddress) {
      setTermsValue(null)
      setCreatorAddressValue(null)
      return
    }
    const client = await getClient()
    const [creator, totalNfts, totalPctBps, durationYears, startQuarter, salePrice, firstAssetId] =
      await client.getTerms()
    setCreatorAddressValue(creator)
    setTermsValue({
      nft_count: Number(totalNfts),
      total_pct_bps: Number(totalPctBps),
      duration_years: Number(durationYears),
      start_quarter: Number(startQuarter),
      sale_price_micro_algo: Number(salePrice),
      first_asset_id: Number(firstAssetId),
    })
  }, [activeAddress, getClient, state.appId, transactionSigner])

  useEffect(() => {
    void refreshTerms()
  }, [refreshTerms])

  const listNfts = useCallback(async (): Promise<AlgoMintNft[]> => {
    if (!state.appId) return []
    const t = termsValue ?? (await fetchTerms())
    if (!t) return []

    const client = await getClient()
    const appAddr = client.appAddress

    const assetIds = Array.from({ length: t.nft_count }).map((_, i) => t.first_asset_id + i)
    const algod = algorand.client.algod

    const rows = await Promise.all(
      assetIds.map(async (assetId) => {
        // Avoid Indexer for responsiveness. We only detect:
        // - For sale: app holds the NFT
        // - Owned by you: connected wallet holds the NFT
        // - Otherwise: owner unknown (treated as not-for-sale)
        const appInfo = await algod.accountAssetInformation(appAddr, assetId).do().catch(() => null)
        const appHolds = (appInfo?.assetHolding?.amount ?? 0n) === 1n
        if (appHolds) return { assetId, owner: null }

        if (activeAddress) {
          const youInfo = await algod.accountAssetInformation(activeAddress, assetId).do().catch(() => null)
          const youHold = (youInfo?.assetHolding?.amount ?? 0n) === 1n
          if (youHold) return { assetId, owner: activeAddress }
        }

        return { assetId, owner: 'unknown' }
      }),
    )

    return rows
  }, [activeAddress, algorand.client.algod, fetchTerms, getClient, state.appId, termsValue])

  const mint_future_nft = useCallback(
    async (args: {
      creator: string
      nft_count: number
      total_pct_bps: number
      duration_years: number
      start_quarter: number
      sale_price_micro_algo: number
      mbr_payment_micro_algo?: number
    }) => {
      if (args.nft_count <= 0) throw new Error('NFT count must be > 0')
      if (args.total_pct_bps <= 0 || args.total_pct_bps > 10_000) throw new Error('Total % bps must be between 1 and 10000')
      if (args.duration_years <= 0) throw new Error('Duration years must be > 0')
      if (args.start_quarter <= 0) throw new Error('Start quarter must be > 0')
      if (args.sale_price_micro_algo <= 0) throw new Error('Sale price must be > 0')

      if (!transactionSigner || !activeAddress) throw new Error('Wallet not connected')

      const client = await getClient()
      const sp = await algorand.client.algod.getTransactionParams().do()
      const mbrAmount = args.mbr_payment_micro_algo ?? algo(1).microAlgo
    const mbrPaymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: client.appAddress,
      amount: mbrAmount,
      suggestedParams: sp,
    })

      const group = client.newGroup()
      group.addTransaction(mbrPaymentTxn, transactionSigner)
      group.mintFutureNft({
        sender: activeAddress,
        args: {
          totalNfts: args.nft_count,
          totalPctBps: args.total_pct_bps,
          durationYears: args.duration_years,
          startQuarter: args.start_quarter,
          salePrice: args.sale_price_micro_algo,
          mbrPayment: mbrPaymentTxn,
        },
      })
      await group.send()

      await refreshTerms()
      const nextTerms = termsValue ?? (await fetchTerms())
      if (!nextTerms) return []
      return Array.from({ length: nextTerms.nft_count }).map((_, i) => nextTerms.first_asset_id + i)
    },
    [activeAddress, algorand.client.algod, fetchTerms, getClient, refreshTerms, termsValue, transactionSigner],
  )

  const buy_nft = useCallback(
    async (args: { buyer: string; asset_id: number; purchase_payment?: number }) => {
      if (!transactionSigner || !activeAddress) throw new Error('Wallet not connected')
      const client = await getClient()
      const t = termsValue ?? (await fetchTerms())
      if (!t) throw new Error('Nothing minted yet')

      const sp = await algorand.client.algod.getTransactionParams().do()
      const assetId = args.asset_id

      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        assetIndex: assetId,
        amount: 0,
        suggestedParams: sp,
      })

      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: client.appAddress,
        amount: Number(t.sale_price_micro_algo),
        suggestedParams: sp,
      })

      const group = client.newGroup()
      group.addTransaction(optInTxn, transactionSigner)
      group.addTransaction(payTxn, transactionSigner)
      group.buyNft({
        sender: activeAddress,
        args: { assetId, optIn: optInTxn, payment: payTxn },
      })
      await group.send()
      await refreshTerms()
    },
    [activeAddress, algorand.client.algod, fetchTerms, getClient, refreshTerms, termsValue, transactionSigner],
  )

  const get_pending_payout = useCallback(
    async (args: { asset_id: number; address: string }) => {
      if (!state.appId) return 0
      const client = await getClient()
      const pending = await client.getPendingPayout({ args: { assetId: args.asset_id, address: args.address } })
      return Number(pending)
    },
    [getClient, state.appId],
  )

  const claim_payout = useCallback(
    async (args: { address: string; asset_id: number }) => {
      if (!transactionSigner || !activeAddress) throw new Error('Wallet not connected')
      const client = await getClient()
      await client.send.claimPayout({
        sender: activeAddress,
        args: { assetId: args.asset_id },
      })
    },
    [activeAddress, getClient, transactionSigner],
  )

  const report_income = useCallback(
    async (args: { creator: string; quarter: number; income_amount: number }) => {
      if (!transactionSigner || !activeAddress) throw new Error('Wallet not connected')
      const client = await getClient()
      const t = termsValue ?? (await fetchTerms())
      if (!t) throw new Error('Nothing minted yet')
      if (!creatorAddressValue || creatorAddressValue !== activeAddress) throw new Error('Only the creator can report income')
      if (args.income_amount <= 0) throw new Error('Income must be > 0')
      if (args.quarter <= 0) throw new Error('Quarter must be > 0')

      const totalPayout = Math.floor((args.income_amount * t.total_pct_bps) / 10_000)
      const perNft = Math.floor(totalPayout / t.nft_count)

      const sp = await algorand.client.algod.getTransactionParams().do()
      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: client.appAddress,
        amount: totalPayout,
        suggestedParams: sp,
      })

      const group = client.newGroup()
      group.addTransaction(fundTxn, transactionSigner)
      group.reportIncome({
        sender: activeAddress,
        args: { quarter: args.quarter, incomeAmount: args.income_amount, payoutFunding: fundTxn },
      })
      await group.send()
      await refreshTerms()

      return { totalPayout, perNft }
    },
    [activeAddress, algorand.client.algod, creatorAddressValue, fetchTerms, getClient, refreshTerms, termsValue, transactionSigner],
  )

  const resetMock = useCallback(async () => {
    persist(defaultState())
  }, [persist])

  const api = useMemo(
    () => ({
      terms: termsValue,
      creatorAddress: creatorAddressValue,
      listNfts,
      mint_future_nft,
      buy_nft,
      get_pending_payout,
      claim_payout,
      report_income,
      resetMock,
    }),
    [
      creatorAddressValue,
      listNfts,
      mint_future_nft,
      buy_nft,
      get_pending_payout,
      claim_payout,
      report_income,
      resetMock,
      termsValue,
    ],
  )

  return api
}
