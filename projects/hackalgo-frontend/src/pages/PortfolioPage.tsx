import { useAlgoMint } from '../hooks/useAlgoMint'
import { useMemo } from 'react'

// Hardcoded historical data for the demo
const historicalPerformance = [
  { quarter: 'Q1', revenue: 4500, payout: 450 },
  { quarter: 'Q2', revenue: 7200, payout: 720 },
  { quarter: 'Q3', revenue: 5800, payout: 580 },
]

export default function PortfolioPage() {
  const { terms, creatorAddress } = useAlgoMint()

  const stats = useMemo(
    () => ({
      totalRevenue: historicalPerformance.reduce((acc, curr) => acc + curr.revenue, 0),
      avgYield: '8.4%',
      projectStatus: terms ? 'Active' : 'Not Initialized',
    }),
    [terms],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title">Total Platform Revenue</div>
          <div className="stat-value text-primary">{stats.totalRevenue} ALGO</div>
          <div className="stat-desc">Historical + Live Data</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title">Average Annual Yield</div>
          <div className="stat-value text-secondary">{stats.avgYield}</div>
          <div className="stat-desc">Across all FENFTs</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-title">Project Status</div>
          <div className="stat-value text-accent text-2xl">{stats.projectStatus}</div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border-l-4 border-success">
        <div className="card-body py-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="badge badge-success badge-sm">SECURE</span>
            On-Chain Safety Check
          </h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span>Atomic Payment Enforcement</span>
              <span className="text-success">✔ Verified</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Immutable Revenue Share</span>
              <span className="text-success">✔ Locked</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Box Storage Allocation</span>
              <span className="text-success">✔ Funded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graphical Representation (Hardcoded for Demo) */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-sm opacity-70 uppercase tracking-widest font-mono">Revenue Distribution</h2>
          {/* FIX: Ensure flex items stretch and parent has a relative height */}
          <div className="flex items-end justify-between gap-4 h-64 mt-4 border-b border-base-300 pb-2 relative">
            {historicalPerformance.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                {/* Label for value on hover */}
                <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{data.revenue}</span>
                {/* THE BAR: Using min-height and background color explicitly */}
                <div
                  className="w-full bg-blue-500 rounded-t-md transition-all hover:bg-blue-400 cursor-help"
                  style={{
                    height: `${(data.revenue / 8000) * 100}%`,
                    minHeight: '4px', // Ensures it's visible even at low values
                  }}
                ></div>
                <span className="text-[10px] font-black uppercase opacity-60">{data.quarter}</span>
              </div>
            ))}
            {/*Projected column */}
            <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
              <span className="text-[10px] font-italic opacity-50 italic">Projected</span>
              <div className="w-full bg-blue-200 border-2 border-dashed border-blue-400 rounded-t-md h-[85%]"></div>
              <span className="text-[10px] font-black uppercase opacity-40 italic font-mono">NEXT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Data Footer */}
      <div className="alert shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <div>
          <h3 className="font-bold">On-Chain Config</h3>
          <div className="text-xs">
            Creator: {creatorAddress || 'Not linked'} | Revenue Share: {terms ? terms.total_pct_bps / 100 : 0}%
          </div>
        </div>
      </div>
    </div>
  )
}
