import { useAlgoMint } from '../hooks/useAlgoMint'
import { useMemo } from 'react'
import ActivityFeed, { ActivityEvent } from '../components/ActivityFeed'

interface PortfolioPageProps {
  events: ActivityEvent[]
}

// Hardcoded historical data for the demo
const historicalPerformance = [
  { quarter: 'Q1', revenue: 4500, payout: 450 },
  { quarter: 'Q2', revenue: 7200, payout: 720 },
  { quarter: 'Q3', revenue: 5800, payout: 580 },
]

export default function PortfolioPage({ events }: PortfolioPageProps) {
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
      {/* Metrics Row (Total Revenue, Avg Yield, etc.) */}
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

      {/* Main Content Grid: Chart + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Revenue Growth Chart (Takes up 2/3 space) */}
        <div className="lg:col-span-2 card bg-base-100 shadow-xl overflow-hidden">
          <div className="card-body">
            <h2 className="card-title text-sm opacity-70 uppercase tracking-widest font-mono">Revenue Growth Distribution</h2>
            <div className="flex items-end justify-between gap-4 h-64 mt-4 border-b border-base-300 pb-2 relative">
              {historicalPerformance.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                  <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{data.revenue}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t-md transition-all hover:bg-blue-400 cursor-help"
                    style={{
                      height: `${(data.revenue / 8000) * 100}%`,
                      minHeight: '4px',
                    }}
                  ></div>
                  <span className="text-[10px] font-black uppercase opacity-60">{data.quarter}</span>
                </div>
              ))}
              <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                <span className="text-[10px] font-italic opacity-50 italic">Projected</span>
                <div className="w-full bg-blue-200 border-2 border-dashed border-blue-400 rounded-t-md h-[85%]"></div>
                <span className="text-[10px] font-black uppercase opacity-40 italic font-mono">NEXT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Feed (Takes up 1/3 space) */}
        <div className="lg:col-span-1">
          <ActivityFeed events={events} />
        </div>
      </div>

      {/* On-Chain Config Footer */}
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
