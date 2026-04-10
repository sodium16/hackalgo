import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function uniqueNote(prefix: string) {
  // Ensure unique txid even if suggestedParams are identical (same round).
  // Algorand txid includes the note field.
  const rand = new Uint8Array(8)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(rand)
  } else {
    const n = Date.now() ^ Math.floor(Math.random() * 1e9)
    for (let i = 0; i < rand.length; i++) rand[i] = (n >> (i * 3)) & 0xff
  }
  const text = `${prefix}_${Date.now()}_${Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`
  return new TextEncoder().encode(text)
}

export function useAlgoMint() {
  const { transactionSigner, activeAddress } = useWallet()
  const [state, setState] = useState<PersistedState>(() => loadState())
  const [termsValue, setTermsValue] = useState<AlgoMintTerms | null>(null)
  const [creatorAddressValue, setCreatorAddressValue] = useState<string | null>(null)

  // Wallet objects can be unstable references; store the latest in refs to avoid dependency loops.
  const activeAddressRef = useRef<string | null>(null)
  const signerRef = useRef<typeof transactionSigner | null>(null)
  useEffect(() => {
    activeAddressRef.current = activeAddress ?? null
    signerRef.current = transactionSigner ?? null
  }, [activeAddress, transactionSigner])

  // Prevent concurrent deploy races (refreshTerms/listNfts calling getClient simultaneously)
  const getClientPromiseRef = useRef<Promise<AlgomintClient> | null>(null)

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
    const signer = signerRef.current
    const sender = activeAddressRef.current
    if (!signer || !sender) throw new Error('Wallet not connected')

    if (state.appId) {
      return new AlgomintClient({
        algorand,
        appId: BigInt(state.appId),
        defaultSender: sender,
        defaultSigner: signer,
      })
    }

    if (getClientPromiseRef.current) return await getClientPromiseRef.current

    // Hackathon convenience: deploy the app from the UI on first use.
    getClientPromiseRef.current = (async () => {
      try {
        const factory = new AlgomintFactory({
          algorand,
          defaultSender: sender,
          defaultSigner: signer,
        })
        const deployed = await factory.send.create.bare({ note: uniqueNote('app_create') })
        const appId = deployed.appClient.appId.toString()
        persist({ appId })
        return deployed.appClient.clone({ defaultSender: sender, defaultSigner: signer })
      } finally {
        getClientPromiseRef.current = null
      }
    })()

    return await getClientPromiseRef.current
  }, [algorand, persist, state.appId])

  const fetchTerms = useCallback(async (): Promise<AlgoMintTerms | null> => {
    if (!state.appId) return null
    const client = await getClient()
    const gs = await client.state.global.getAll()
    const initialized = Number(gs.initialized ?? 0n) === 1
    if (!initialized) return null
    return {
      nft_count: Number(gs.totalNfts ?? 0n),
      total_pct_bps: Number(gs.totalPctBps ?? 0n),
      duration_years: Number(gs.durationYears ?? 0n),
      start_quarter: Number(gs.startQuarter ?? 0n),
      sale_price_micro_algo: Number(gs.salePrice ?? 0n),
      first_asset_id: Number(gs.firstAssetId ?? 0n),
    }
  }, [getClient, state.appId])

  const refreshTerms = useCallback(async () => {
    const signer = signerRef.current
    const sender = activeAddressRef.current
    if (!state.appId || !signer || !sender) {
      setTermsValue(null)
      setCreatorAddressValue(null)
      return
    }
    const client = await getClient()
    const gs = await client.state.global.getAll()
    const initialized = Number(gs.initialized ?? 0n) === 1
    if (!initialized) {
      setCreatorAddressValue(null)
      setTermsValue(null)
      return
    }
    setCreatorAddressValue((gs.creator ?? '').toString())
    setTermsValue({
      nft_count: Number(gs.totalNfts ?? 0n),
      total_pct_bps: Number(gs.totalPctBps ?? 0n),
      duration_years: Number(gs.durationYears ?? 0n),
      start_quarter: Number(gs.startQuarter ?? 0n),
      sale_price_micro_algo: Number(gs.salePrice ?? 0n),
      first_asset_id: Number(gs.firstAssetId ?? 0n),
    })
  }, [getClient, state.appId])

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

        const sender = activeAddressRef.current
        if (sender) {
          const youInfo = await algod.accountAssetInformation(sender, assetId).do().catch(() => null)
          const youHold = (youInfo?.assetHolding?.amount ?? 0n) === 1n
          if (youHold) return { assetId, owner: sender }
        }

        return { assetId, owner: 'unknown' }
      }),
    )

    return rows
  }, [algorand.client.algod, fetchTerms, getClient, state.appId, termsValue])

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

      const signer = signerRef.current
      const sender = activeAddressRef.current
      if (!signer || !sender) throw new Error('Wallet not connected')

      const client = await getClient()
      const sp = await algorand.client.algod.getTransactionParams().do()
      const mbrAmount = args.mbr_payment_micro_algo ?? algo(1).microAlgo
    const mbrPaymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver: client.appAddress,
      amount: mbrAmount,
      suggestedParams: sp,
      note: uniqueNote('mbr_payment'),
    })

      const group = client.newGroup()
      group.mintFutureNft({
        sender,
        signer,
        note: uniqueNote('app_call_mint'),
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
    [algorand.client.algod, fetchTerms, getClient, refreshTerms, termsValue],
  )

  const buy_nft = useCallback(
    async (args: { buyer: string; asset_id: number; purchase_payment?: number }) => {
      const signer = signerRef.current
      const sender = activeAddressRef.current
      if (!signer || !sender) throw new Error('Wallet not connected')
      const client = await getClient()
      const t = termsValue ?? (await fetchTerms())
      if (!t) throw new Error('Nothing minted yet')

      const sp = await algorand.client.algod.getTransactionParams().do()
      const assetId = args.asset_id

      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender,
        receiver: sender,
        assetIndex: assetId,
        amount: 0,
        suggestedParams: sp,
        note: uniqueNote('opt_in'),
      })

      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: client.appAddress,
        amount: Number(t.sale_price_micro_algo),
        suggestedParams: sp,
        note: uniqueNote('buy_payment'),
      })

      const group = client.newGroup()
      group.buyNft({
        sender,
        signer,
        note: uniqueNote('app_call_buy'),
        args: { assetId, optIn: optInTxn, payment: payTxn },
      })
      await group.send()
      await refreshTerms()
    },
    [algorand.client.algod, fetchTerms, getClient, refreshTerms, termsValue],
  )

  const get_pending_payout = useCallback(
    async (args: { asset_id: number; address: string }) => {
      if (!state.appId) return 0
      const client = await getClient()
      // Avoid simulate by computing pending from state:
      // pending = payout_per_nft if (holder owns NFT) AND last_reported_quarter > last_claimed_quarter
      const gs = await client.state.global.getAll()
      const lastReportedQuarter = gs.lastReportedQuarter ?? 0n
      if (lastReportedQuarter === 0n) return 0
      const payoutPerNft = gs.payoutPerNft ?? 0n
      if (payoutPerNft === 0n) return 0

      // Confirm address holds the NFT
      const hold = await algorand.client.algod.accountAssetInformation(args.address, args.asset_id).do().catch(() => null)
      const owns = (hold?.assetHolding?.amount ?? 0n) === 1n
      if (!owns) return 0

      const lastClaimed = (await client.state.box.lastClaimedQuarter.value(args.asset_id)) ?? 0n
      if (lastClaimed >= lastReportedQuarter) return 0
      return Number(payoutPerNft)
    },
    [algorand.client.algod, getClient, state.appId],
  )

  const claim_payout = useCallback(
    async (args: { address: string; asset_id: number }) => {
      const signer = signerRef.current
      const sender = activeAddressRef.current
      if (!signer || !sender) throw new Error('Wallet not connected')
      const client = await getClient()
      await client.send.claimPayout({
        sender,
        signer,
        note: uniqueNote('app_call_claim'),
        args: { assetId: args.asset_id },
      })
    },
    [getClient],
  )

  const report_income = useCallback(
    async (args: { creator: string; quarter: number; income_amount: number }) => {
      const signer = signerRef.current
      const sender = activeAddressRef.current
      if (!signer || !sender) throw new Error('Wallet not connected')
      const client = await getClient()
      const t = termsValue ?? (await fetchTerms())
      if (!t) throw new Error('Nothing minted yet')
      if (!creatorAddressValue || creatorAddressValue !== sender) throw new Error('Only the creator can report income')
      if (args.income_amount <= 0) throw new Error('Income must be > 0')
      if (args.quarter <= 0) throw new Error('Quarter must be > 0')

      const totalPayout = Math.floor((args.income_amount * t.total_pct_bps) / 10_000)
      const perNft = Math.floor(totalPayout / t.nft_count)

      const sp = await algorand.client.algod.getTransactionParams().do()
      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: client.appAddress,
        amount: totalPayout,
        suggestedParams: sp,
        note: uniqueNote('payout_funding'),
      })

      const group = client.newGroup()
      group.reportIncome({
        sender,
        signer,
        note: uniqueNote('app_call_report'),
        args: { quarter: args.quarter, incomeAmount: args.income_amount, payoutFunding: fundTxn },
      })
      await group.send()
      await refreshTerms()

      return { totalPayout, perNft }
    },
    [algorand.client.algod, creatorAddressValue, fetchTerms, getClient, refreshTerms, termsValue],
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
