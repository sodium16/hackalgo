import { useEffect, useState } from 'react'

export interface ActivityEvent {
  id: string
  type: 'MINT' | 'BUY' | 'REPORT' | 'CLAIM'
  message: string
  timestamp: Date
  txId?: string
}

export default function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="card bg-base-100 shadow-xl border-l-4 border-info">
      <div className="card-body p-4">
        <h3 className="text-xs font-black uppercase tracking-tighter text-info mb-4 flex justify-between">
          Live Transparency Log
          <span className="badge badge-info badge-xs animate-pulse">LIVE</span>
        </h3>

        <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-2">
          {events.length === 0 ? (
            <div className="text-center py-10 opacity-30 text-xs italic">Waiting for on-chain events...</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="text-[11px] border-b border-base-200 pb-2 last:border-0">
                <div className="flex justify-between font-bold uppercase mb-1">
                  <span className={event.type === 'MINT' ? 'text-primary' : event.type === 'REPORT' ? 'text-secondary' : 'text-accent'}>
                    {event.type}
                  </span>
                  <span className="opacity-40">{event.timestamp.toLocaleTimeString()}</span>
                </div>
                <p className="opacity-80 leading-tight">{event.message}</p>
                {event.txId && <div className="mt-1 font-mono opacity-40 truncate text-[9px]">TX: {event.txId}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
