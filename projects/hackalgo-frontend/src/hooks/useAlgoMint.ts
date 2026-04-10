import { useCallback, useMemo, useState } from 'react'
import assetIdsJson from '../assets/asset_ids.json'

type AlgoMintTerms = {
  nft_count: number
  total_pct_bps: number
  duration_years: number
}

export type AlgoMintNft = {
  assetId: number
  owner: string | null
}

type PersistedState = {
  terms: AlgoMintTerms | null
  creatorAddress: string | null
  nfts: AlgoMintNft[]
  pendingPayoutByAssetId: Record<number, number>
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
    terms: null,
    creatorAddress: null,
    nfts: [],
    pendingPayoutByAssetId: {},
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function useAlgoMint() {
  const [state, setState] = useState<PersistedState>(() => loadState())

  const persist = useCallback((next: PersistedState) => {
    setState(next)
    saveState(next)
  }, [])

  const terms = state.terms
  const creatorAddress = state.creatorAddress

  const listNfts = useCallback(async (): Promise<AlgoMintNft[]> => {
    await delay(400)
    if (state.nfts.length > 0) return state.nfts

    const fallback = (assetIdsJson as { assetIds: number[] }).assetIds.map((assetId) => ({
      assetId,
      owner: null,
    }))
    return fallback
  }, [state.nfts])

  // ABI-shaped method names/args (mocked for now)
  const mint_future_nft = useCallback(
    async (args: { creator: string; nft_count: number; total_pct_bps: number; duration_years: number; mbr_payment?: number }) => {
      await delay(900)

      if (args.nft_count <= 0) throw new Error('NFT count must be > 0')
      if (args.total_pct_bps <= 0 || args.total_pct_bps > 10_000) throw new Error('Total % bps must be between 1 and 10000')
      if (args.duration_years <= 0) throw new Error('Duration years must be > 0')

      // Mock: generate unique-ish asset IDs.
      const base = Date.now() % 1_000_000_000
      const nfts: AlgoMintNft[] = Array.from({ length: args.nft_count }).map((_, i) => ({
        assetId: base + i + 1,
        owner: null,
      }))

      const next: PersistedState = {
        ...state,
        creatorAddress: args.creator,
        terms: { nft_count: args.nft_count, total_pct_bps: args.total_pct_bps, duration_years: args.duration_years },
        nfts,
        pendingPayoutByAssetId: {},
      }
      persist(next)

      return nfts.map((n) => n.assetId)
    },
    [persist, state],
  )

  const buy_nft = useCallback(
    async (args: { buyer: string; asset_id: number; purchase_payment?: number }) => {
      await delay(700)
      const nextNfts = state.nfts.map((n) => (n.assetId === args.asset_id ? { ...n, owner: args.buyer } : n))
      const next = { ...state, nfts: nextNfts }
      persist(next)
    },
    [persist, state],
  )

  const get_pending_payout = useCallback(
    async (args: { asset_id: number; address: string }) => {
      await delay(250)
      const nft = state.nfts.find((n) => n.assetId === args.asset_id) ?? null
      if (!nft || nft.owner !== args.address) return 0
      return state.pendingPayoutByAssetId[args.asset_id] ?? 0
    },
    [state.nfts, state.pendingPayoutByAssetId],
  )

  const claim_payout = useCallback(
    async (args: { address: string; asset_id: number }) => {
      await delay(600)
      const nft = state.nfts.find((n) => n.assetId === args.asset_id) ?? null
      if (!nft || nft.owner !== args.address) throw new Error('You do not own this NFT')

      const nextPending = { ...state.pendingPayoutByAssetId }
      nextPending[args.asset_id] = 0
      persist({ ...state, pendingPayoutByAssetId: nextPending })
    },
    [persist, state],
  )

  const report_income = useCallback(
    async (args: { creator: string; quarter: number; income_amount: number }) => {
      await delay(800)
      if (!state.terms || !state.creatorAddress) throw new Error('Nothing minted yet')
      if (args.creator !== state.creatorAddress) throw new Error('Only the creator can report income')
      if (args.income_amount <= 0) throw new Error('Income must be > 0')
      if (args.quarter <= 0) throw new Error('Quarter must be > 0')

      const { nft_count, total_pct_bps } = state.terms
      const totalPayout = (args.income_amount * total_pct_bps) / 10_000
      const perNft = totalPayout / nft_count

      const nextPending = { ...state.pendingPayoutByAssetId }
      for (const nft of state.nfts) {
        if (!nft.owner) continue
        nextPending[nft.assetId] = (nextPending[nft.assetId] ?? 0) + perNft
      }

      persist({ ...state, pendingPayoutByAssetId: nextPending })
      return { totalPayout, perNft }
    },
    [persist, state],
  )

  const resetMock = useCallback(async () => {
    await delay(250)
    const next = defaultState()
    persist(next)
  }, [persist])

  const api = useMemo(
    () => ({
      terms,
      creatorAddress,
      listNfts,
      mint_future_nft,
      buy_nft,
      get_pending_payout,
      claim_payout,
      report_income,
      resetMock,
    }),
    [terms, creatorAddress, listNfts, mint_future_nft, buy_nft, get_pending_payout, claim_payout, report_income, resetMock],
  )

  return api
}
