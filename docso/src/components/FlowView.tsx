import { useState, useEffect, useRef, useCallback, Fragment, type CSSProperties } from 'react'

export type Step = {
  order: number
  title: string
  description?: string
  url?: string
  notes?: string
  sectionTitle?: string
  sectionIndex?: number
}

export type GatewayBranch = {
  id: string
  label: string
  color: string
  steps: Step[]
}

export type Gateway = {
  id: string
  afterStep: number
  type?: 'exclusive' | 'parallel' | 'inclusive'
  question: string
  branches: GatewayBranch[]
}

type NodePos = { x: number; y: number }
type FlowPositions = Record<string, NodePos>

const EVT_R        = 28
const CRD_W        = 192
const CRD_H        = 84
const F_GAP        = 80
const F_INIT_Y     = 200
const GW_SIZE      = 22
const TRACK_STROKE    = 2.5
const BRANCH_MID_BASE = 32
const BRANCH_MID_STEP = 22

const LANE_H_MIN   = 200
const LANE_LABEL_W = 100
const LANE_TOP     = 40
const LANE_ROW_PAD = 44
const LANE_ROW_GAP = 20

type Lane = { index: number; title: string }

function deriveLanes(steps: Step[], gateways: Gateway[] = []): Lane[] {
  const map = new Map<number, string>()
  steps.forEach(s => {
    const idx = s.sectionIndex ?? 0
    if (!map.has(idx)) map.set(idx, s.sectionTitle ?? '')
  })
  gateways.forEach(gw => gw.branches.forEach(b => b.steps.forEach(s => {
    const idx = s.sectionIndex ?? 0
    if (!map.has(idx)) map.set(idx, s.sectionTitle ?? '')
  })))
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, title]) => ({ index, title }))
}

function layoutSig(steps: Step[], gateways: Gateway[]): string {
  const lanes = deriveLanes(steps, gateways)
  return `lc${lanes.length}:sc${steps.length}:${gateways.map(gw => `${gw.id}:${gw.branches.map(b => b.steps.length).join(',')}`).join('|')}`
}

function computeLaneHeights(gateways: Gateway[], laneCount: number): number[] {
  const maxRows = new Array(laneCount).fill(1)
  gateways.forEach(gw => {
    const perLane = new Map<number, number>()
    gw.branches.forEach(branch => {
      const seen = new Set<number>()
      branch.steps.forEach(bs => {
        const idx = Math.min(bs.sectionIndex ?? 0, laneCount - 1)
        if (!seen.has(idx)) {
          seen.add(idx)
          perLane.set(idx, (perLane.get(idx) ?? 0) + 1)
        }
      })
    })
    perLane.forEach((count, i) => { maxRows[i] = Math.max(maxRows[i], count) })
  })
  return maxRows.map(rows =>
    Math.max(LANE_H_MIN, LANE_ROW_PAD * 2 + rows * CRD_H + Math.max(0, rows - 1) * LANE_ROW_GAP)
  )
}

function laneTopY(laneIdx: number, heights: number[]): number {
  return LANE_TOP + heights.slice(0, laneIdx).reduce((a, b) => a + b, 0)
}

function laneCenterY(laneIdx: number, heights: number[]): number {
  return laneTopY(laneIdx, heights) + heights[laneIdx] / 2
}

function stepLanePos(step: Step, lanes: Lane[]): number {
  const idx = step.sectionIndex ?? 0
  const p = lanes.findIndex(l => l.index === idx)
  return p >= 0 ? p : 0
}

function autoLayout(steps: Step[], gateways: Gateway[]): FlowPositions {
  const lanes       = deriveLanes(steps, gateways)
  const multiLane   = lanes.length > 1
  const laneHeights = multiLane ? computeLaneHeights(gateways, lanes.length) : []
  const ox          = multiLane ? LANE_LABEL_W + 40 : 60
  const pos: FlowPositions = {}

  const cx = (lanePos: number) =>
    multiLane ? laneCenterY(lanePos, laneHeights) : F_INIT_Y

  const gwByAfterStep = new Map<number, Gateway>()
  gateways.forEach(gw => gwByAfterStep.set(gw.afterStep, gw))

  let curX = ox + EVT_R * 2 + F_GAP

  steps.forEach(s => {
    const cy = cx(stepLanePos(s, lanes))
    pos[String(s.order)] = { x: curX, y: cy - CRD_H / 2 }
    curX += CRD_W + F_GAP

    const gw = gwByAfterStep.get(s.order)
    if (gw) {
      pos[`gw-${gw.id}`] = { x: curX, y: cy - GW_SIZE }
      curX += GW_SIZE * 2 + F_GAP

      const nBranches = gw.branches.length

      const laneMaxRows    = new Map<number, number>()
      const laneSubCounter = new Map<number, number>()
      const branchSubRow   = new Map<string, Map<number, number>>()
      gw.branches.forEach(branch => {
        const bMap = new Map<number, number>()
        const seen = new Set<number>()
        branch.steps.forEach(bs => {
          const idx = bs.sectionIndex ?? 0
          if (!seen.has(idx)) {
            seen.add(idx)
            laneMaxRows.set(idx, (laneMaxRows.get(idx) ?? 0) + 1)
          }
        })
        branch.steps.forEach(bs => {
          const idx = bs.sectionIndex ?? 0
          if (!bMap.has(idx)) {
            const sub = laneSubCounter.get(idx) ?? 0
            bMap.set(idx, sub)
            laneSubCounter.set(idx, sub + 1)
          }
        })
        branchSubRow.set(branch.id, bMap)
      })

      let maxBranchX = curX
      gw.branches.forEach((branch, bi) => {
        const fallbackY = cy + (bi - (nBranches - 1) / 2) * 160
        const bRows     = branchSubRow.get(branch.id) ?? new Map()

        branch.steps.forEach((bs, bsi) => {
          const bsX = curX + bsi * (CRD_W + F_GAP)
          let bsY: number
          if (multiLane) {
            const laneIdx   = bs.sectionIndex ?? 0
            const totalRows = laneMaxRows.get(laneIdx) ?? 1
            const subRow    = bRows.get(laneIdx) ?? 0
            const lH        = laneHeights[laneIdx] ?? LANE_H_MIN
            const lTop      = laneTopY(laneIdx, laneHeights)
            const contentH  = totalRows * CRD_H + Math.max(0, totalRows - 1) * LANE_ROW_GAP
            bsY = lTop + (lH - contentH) / 2 + subRow * (CRD_H + LANE_ROW_GAP)
          } else {
            bsY = fallbackY - CRD_H / 2
          }
          pos[`gw-${gw.id}-${branch.id}-${bs.order}`] = { x: bsX, y: bsY }
          maxBranchX = Math.max(maxBranchX, bsX + CRD_W)
        })
      })
      curX = maxBranchX + F_GAP
    }
  })

  const firstCY = steps[0]     ? cx(stepLanePos(steps[0],                lanes)) : F_INIT_Y
  const lastCY  = steps.at(-1) ? cx(stepLanePos(steps[steps.length - 1], lanes)) : F_INIT_Y

  pos.start = { x: ox,   y: firstCY - EVT_R }
  pos.end   = { x: curX, y: lastCY  - EVT_R }

  return pos
}

function getFlowBounds(pos: FlowPositions, steps: Step[], gateways: Gateway[]) {
  const nodes = [
    { x: pos.start.x, y: pos.start.y, w: EVT_R * 2, h: EVT_R * 2 + 24 },
    { x: pos.end.x,   y: pos.end.y,   w: EVT_R * 2, h: EVT_R * 2 + 24 },
    ...steps.map(s => {
      const p = pos[String(s.order)] ?? pos.start
      return { x: p.x, y: p.y, w: CRD_W, h: CRD_H }
    }),
  ]
  gateways.forEach(gw => {
    const gwp = pos[`gw-${gw.id}`]
    if (gwp) nodes.push({ x: gwp.x, y: gwp.y, w: GW_SIZE * 2, h: GW_SIZE * 2 })
    gw.branches.forEach(branch => {
      branch.steps.forEach(bs => {
        const bsp = pos[`gw-${gw.id}-${branch.id}-${bs.order}`]
        if (bsp) nodes.push({ x: bsp.x, y: bsp.y, w: CRD_W, h: CRD_H })
      })
    })
  })

  const lanes = deriveLanes(steps, gateways)
  const multiLane = lanes.length > 1

  let minX = Math.min(...nodes.map(n => n.x)) - 60
  let minY = Math.min(...nodes.map(n => n.y)) - 60
  let maxX = Math.max(...nodes.map(n => n.x + n.w)) + 60
  let maxY = Math.max(...nodes.map(n => n.y + n.h)) + 60

  if (multiLane) {
    const laneHeights = computeLaneHeights(gateways, lanes.length)
    const totalH = laneHeights.reduce((a, b) => a + b, 0)
    minX = Math.min(minX, 0)
    minY = Math.min(minY, LANE_TOP - 20)
    maxY = Math.max(maxY, LANE_TOP + totalH + 20)
  }

  return { minX, minY, maxX, maxY }
}

function orthPath(x1: number, y1: number, x2: number, y2: number, midX?: number): string {
  if (Math.abs(y2 - y1) < 2) return `M${x1},${y1} H${x2}`
  const mx = midX ?? (x1 + x2) / 2
  return `M${x1},${y1} H${mx} V${y2} H${x2}`
}

type SelectedDetail = {
  key: string
  order: number
  title: string
  description?: string
  branchLabel?: string
}

export default function FlowView({ steps, gateways, processId }: { steps: Step[]; gateways: Gateway[]; processId: string }) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null)
  const [hoveredGwId, setHoveredGwId] = useState<string | null>(null)
  const [localGateways, setLocalGateways] = useState<Gateway[]>(gateways)

  useEffect(() => { setLocalGateways(gateways) }, [gateways])

  const storageKey = `flow-pos-${processId}`

  const [positions, setPositions] = useState<FlowPositions>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as FlowPositions & { _sig?: string }
        if (parsed._sig === layoutSig(steps, gateways)) {
          const { _sig: _, ...pos } = parsed
          return pos as FlowPositions
        }
      }
    } catch { /* ignore */ }
    return autoLayout(steps, gateways)
  })

  const posRef = useRef(positions)
  posRef.current = positions

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({ ...positions, _sig: layoutSig(steps, gateways) }))
    }, 500)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [positions, storageKey])

  const stateRef      = useRef({ scale: 1, tx: 0, ty: 0 })
  const dragRef       = useRef({ dragging: false, sx: 0, sy: 0, stx: 0, sty: 0 })
  const nodeDragRef   = useRef<{ key: string; sx: number; sy: number; spx: number; spy: number } | null>(null)
  const clickBlockRef = useRef(false)
  const drawerOpenRef = useRef(false)

  const applyTransform = useCallback((sc: number, ttx: number, tty: number) => {
    stateRef.current = { scale: sc, tx: ttx, ty: tty }
    setScale(sc)
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate(${ttx}px,${tty}px) scale(${sc})`
    }
  }, [])

  function doFit(drawerOpen: boolean) {
    const container = containerRef.current
    if (!container) return
    const b = getFlowBounds(posRef.current, steps, gateways)
    const cW = b.maxX - b.minX
    const cH = b.maxY - b.minY
    const drawerW  = drawerOpen ? 296 : 0
    const availW   = container.offsetWidth - drawerW - 80
    const availH   = container.offsetHeight - 80
    let sc = Math.min(1, availW / cW, availH / cH)
    sc = Math.round(sc * 10) / 10
    const centerCX = (b.minX + b.maxX) / 2
    const centerCY = (b.minY + b.maxY) / 2
    const ttx = (container.offsetWidth - drawerW) / 2 - centerCX * sc
    const tty = container.offsetHeight / 2 - centerCY * sc
    applyTransform(sc, ttx, tty)
  }

  useEffect(() => {
    drawerOpenRef.current = selectedDetail !== null
    doFit(selectedDetail !== null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDetail])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    doFit(false)

    const ro = new ResizeObserver(() => doFit(drawerOpenRef.current))
    ro.observe(container)

    function onMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.closest('.flow-controls,.flow-drawer')) return
      const nodeEl = t.closest('.fnode') as HTMLElement | null
      if (nodeEl) {
        const key = nodeEl.dataset.key!
        const p = posRef.current[key]
        if (!p) return
        nodeDragRef.current = { key, sx: e.clientX, sy: e.clientY, spx: p.x, spy: p.y }
        clickBlockRef.current = false
        e.preventDefault()
        return
      }
      dragRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, stx: stateRef.current.tx, sty: stateRef.current.ty }
    }

    function onMouseMove(e: MouseEvent) {
      if (nodeDragRef.current) {
        const { key, sx, sy, spx, spy } = nodeDragRef.current
        const dx = (e.clientX - sx) / stateRef.current.scale
        const dy = (e.clientY - sy) / stateRef.current.scale
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) clickBlockRef.current = true
        setPositions(prev => ({ ...prev, [key]: { x: spx + dx, y: spy + dy } }))
        return
      }
      if (!dragRef.current.dragging) return
      applyTransform(
        stateRef.current.scale,
        dragRef.current.stx + e.clientX - dragRef.current.sx,
        dragRef.current.sty + e.clientY - dragRef.current.sy,
      )
    }

    function onMouseUp() {
      nodeDragRef.current = null
      dragRef.current.dragging = false
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const f = e.deltaY > 0 ? 0.9 : 1.11
      const rect = (container as HTMLDivElement).getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const ns = Math.max(0.2, Math.min(3, stateRef.current.scale * f))
      const ntx = mx - (mx - stateRef.current.tx) * (ns / stateRef.current.scale)
      const nty = my - (my - stateRef.current.ty) * (ns / stateRef.current.scale)
      applyTransform(ns, ntx, nty)
    }

    container.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('wheel', onWheel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startPos = positions.start ?? autoLayout(steps, localGateways).start
  const endPos   = positions.end   ?? autoLayout(steps, localGateways).end

  const gwAfterSteps = new Set(localGateways.map(gw => gw.afterStep))

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#F7F7F8', backgroundImage: 'radial-gradient(circle, #D0D0D0 1px, transparent 1px)', backgroundSize: '24px 24px', userSelect: 'none', cursor: 'grab' }}
    >
      <div ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0' }}>

        {/* Swimlane bands */}
        {(() => {
          const lanes = deriveLanes(steps, localGateways)
          if (lanes.length <= 1) return null
          const laneHeights = computeLaneHeights(localGateways, lanes.length)
          const bounds = getFlowBounds(positions, steps, localGateways)
          return lanes.map((lane, i) => {
            const top = laneTopY(i, laneHeights)
            const h   = laneHeights[i]
            return (
              <div
                key={lane.index}
                style={{
                  position: 'absolute',
                  left: 0,
                  top,
                  width: bounds.maxX,
                  height: h,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(242,242,242,0.45)',
                  borderTop: '1px solid #DCDCDC',
                  borderBottom: i === lanes.length - 1 ? '1px solid #DCDCDC' : 'none',
                  pointerEvents: 'none',
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: LANE_LABEL_W,
                  height: h,
                  borderRight: '1px solid #DCDCDC',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(238,238,238,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    transform: 'rotate(-90deg)',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: '#B0B0B0',
                    whiteSpace: 'nowrap',
                    maxWidth: h - 20,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {lane.title || `Seção ${i + 1}`}
                  </span>
                </div>
              </div>
            )
          })
        })()}

        {/* SVG overlay — edges only */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 4000, height: 2000, overflow: 'visible', pointerEvents: 'none' }}>

          {steps[0] && (() => {
            const p0 = positions[String(steps[0].order)]
            if (!p0) return null
            return <path d={orthPath(startPos.x + EVT_R * 2, startPos.y + EVT_R, p0.x, p0.y + CRD_H / 2)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })()}

          {steps.slice(0, -1).map((s, i) => {
            if (gwAfterSteps.has(s.order)) return null
            const pa = positions[String(s.order)]
            const pb = positions[String(steps[i + 1].order)]
            if (!pa || !pb) return null
            return <path key={s.order} d={orthPath(pa.x + CRD_W, pa.y + CRD_H / 2, pb.x, pb.y + CRD_H / 2)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })}

          {steps[steps.length - 1] && !gwAfterSteps.has(steps[steps.length - 1].order) && (() => {
            const pl = positions[String(steps[steps.length - 1].order)]
            if (!pl) return null
            return <path d={orthPath(pl.x + CRD_W, pl.y + CRD_H / 2, endPos.x, endPos.y + EVT_R)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })()}

          {localGateways.map(gw => {
            const gwp = positions[`gw-${gw.id}`]
            if (!gwp) return null
            const gwCX = gwp.x + GW_SIZE
            const gwCY = gwp.y + GW_SIZE
            const afterStepIdx = steps.findIndex(s => s.order === gw.afterStep)
            const nextMainStep = steps[afterStepIdx + 1]
            const n = gw.branches.length

            return (
              <g key={`gw-edges-${gw.id}`}>
                {(() => {
                  const p = positions[String(gw.afterStep)]
                  if (!p) return null
                  return <path d={orthPath(p.x + CRD_W, p.y + CRD_H / 2, gwCX - GW_SIZE, gwCY)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
                })()}

                {gw.branches.map((branch, bi) => {
                  if (!branch.steps.length) return null
                  const key0 = `gw-${gw.id}-${branch.id}-${branch.steps[0].order}`
                  const bsp0 = positions[key0]
                  if (!bsp0) return null

                  const divMidX = gwCX + GW_SIZE + BRANCH_MID_BASE + bi * BRANCH_MID_STEP
                  const gwExitX = gwCX + GW_SIZE
                  const gwExitY = gwCY

                  const paths: React.ReactElement[] = []

                  paths.push(
                    <path
                      key="gw-to-first"
                      d={orthPath(gwExitX, gwExitY, bsp0.x, bsp0.y + CRD_H / 2, divMidX)}
                      fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round"
                    />
                  )

                  branch.steps.slice(0, -1).forEach((bs, bsi) => {
                    const pA = positions[`gw-${gw.id}-${branch.id}-${bs.order}`]
                    const pB = positions[`gw-${gw.id}-${branch.id}-${branch.steps[bsi + 1].order}`]
                    if (!pA || !pB) return
                    paths.push(
                      <path
                        key={`bs-${bsi}`}
                        d={orthPath(pA.x + CRD_W, pA.y + CRD_H / 2, pB.x, pB.y + CRD_H / 2)}
                        fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round"
                      />
                    )
                  })

                  const lastBs  = branch.steps[branch.steps.length - 1]
                  const lastBsp = positions[`gw-${gw.id}-${branch.id}-${lastBs.order}`]
                  if (lastBsp) {
                    const tp = nextMainStep ? positions[String(nextMainStep.order)] : endPos
                    if (tp) {
                      const ty = nextMainStep ? tp.y + CRD_H / 2 : tp.y + EVT_R
                      const convMidX = tp.x - BRANCH_MID_BASE - (n - 1 - bi) * BRANCH_MID_STEP
                      paths.push(
                        <path
                          key="branch-to-next"
                          d={orthPath(lastBsp.x + CRD_W, lastBsp.y + CRD_H / 2, tp.x, ty, convMidX)}
                          fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round"
                        />
                      )
                    }
                  }

                  return <g key={branch.id}>{paths}</g>
                })}
              </g>
            )
          })}
        </svg>

        {/* Nó de início */}
        <div className="fnode" data-key="start" style={{ position: 'absolute', left: startPos.x, top: startPos.y, width: EVT_R * 2, cursor: 'grab' }}>
          <div style={{ width: EVT_R * 2, height: EVT_R * 2, borderRadius: '50%', background: '#30BCFE', boxShadow: '0 2px 8px rgba(48,188,254,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={14} height={14} viewBox="0 0 14 14" style={{ pointerEvents: 'none' }}>
              <polygon points="2,2 12,7 2,12" fill="#0A0A0A" />
            </svg>
          </div>
          <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, color: '#B0B0B0', marginTop: 8, pointerEvents: 'none' }}>INÍCIO</div>
        </div>

        {/* Cards de etapa — fluxo principal */}
        {steps.map((s, i) => {
          const p = positions[String(s.order)]
          if (!p) return null
          const sel = selectedDetail?.key === String(s.order)
          return (
            <div
              key={s.order}
              className="fnode"
              data-key={String(s.order)}
              onClick={() => {
                if (clickBlockRef.current) return
                setSelectedDetail(sel ? null : { key: String(s.order), order: s.order, title: s.title, description: s.description })
              }}
              style={{
                position: 'absolute', left: p.x, top: p.y,
                width: CRD_W, height: CRD_H,
                background: '#fff',
                borderTop: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                borderRight: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                borderBottom: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                borderLeft: `3px solid #30BCFE`,
                borderRadius: 10,
                boxShadow: sel ? '0 0 0 3px rgba(48,188,254,0.14), 0 4px 20px rgba(0,0,0,0.1)' : '0 2px 12px rgba(0,0,0,0.06)',
                cursor: 'grab', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '14px 14px 10px 16px', overflow: 'hidden',
              }}
            >
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12.5, color: '#0A0A0A', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as CSSProperties}>
                {s.title}
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: sel ? '#30BCFE' : '#C8C8C8', letterSpacing: 0.5, pointerEvents: 'none' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          )
        })}

        {/* Gateway diamond nodes + branch step cards */}
        {localGateways.map(gw => {
          const gwp = positions[`gw-${gw.id}`]
          return (
            <Fragment key={`gw-${gw.id}`}>
              {gwp && (
                <div
                  className="fnode"
                  data-key={`gw-${gw.id}`}
                  onMouseEnter={() => setHoveredGwId(gw.id)}
                  onMouseLeave={() => setHoveredGwId(null)}
                  style={{ position: 'absolute', left: gwp.x, top: gwp.y, width: GW_SIZE * 2, height: GW_SIZE * 2, cursor: 'grab' }}
                >
                  <div style={{ width: GW_SIZE * 2, height: GW_SIZE * 2, background: '#30BCFE', transform: 'rotate(45deg)', borderRadius: 3, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round">
                        {(!gw.type || gw.type === 'exclusive') && (<><line x1="4" y1="4" x2="10" y2="10"/><line x1="10" y1="4" x2="4" y2="10"/></>)}
                        {gw.type === 'parallel'  && (<><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></>)}
                        {gw.type === 'inclusive' && (<circle cx="7" cy="7" r="3"/>)}
                      </svg>
                    </div>
                  </div>

                  {hoveredGwId === gw.id && (
                    <div style={{
                      position: 'absolute',
                      bottom: GW_SIZE * 2 + 10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#fff',
                      border: '1.5px solid var(--cinza-borda)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      minWidth: 180,
                      zIndex: 20,
                      pointerEvents: 'none',
                    }}>
                      {gw.question && (
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#0A0A0A', marginBottom: 10, lineHeight: 1.3 }}>
                          {gw.question}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {gw.branches.map(branch => (
                          <div key={branch.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 0.5, color: 'var(--cinza-texto)', flexShrink: 0 }}>
                              {branch.label}
                            </span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#444', lineHeight: 1.4 }}>
                              {branch.steps[0]?.title ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {gw.branches.map(branch =>
                branch.steps.map((bs, bsi) => {
                  const nodeKey = `gw-${gw.id}-${branch.id}-${bs.order}`
                  const bsp = positions[nodeKey]
                  if (!bsp) return null
                  const sel = selectedDetail?.key === nodeKey
                  return (
                    <div
                      key={nodeKey}
                      className="fnode"
                      data-key={nodeKey}
                      onClick={() => {
                        if (clickBlockRef.current) return
                        setSelectedDetail(sel ? null : { key: nodeKey, order: bsi + 1, title: bs.title, description: bs.description, branchLabel: branch.label })
                      }}
                      style={{
                        position: 'absolute', left: bsp.x, top: bsp.y,
                        width: CRD_W, height: CRD_H,
                        background: '#fff',
                        borderTop: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                        borderRight: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                        borderBottom: `1.5px solid ${sel ? '#30BCFE' : '#E8E8E8'}`,
                        borderLeft: `3px solid #30BCFE`,
                        borderRadius: 10,
                        boxShadow: sel ? '0 0 0 3px rgba(48,188,254,0.14), 0 4px 20px rgba(0,0,0,0.1)' : '0 2px 12px rgba(0,0,0,0.06)',
                        cursor: 'grab', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        padding: '14px 14px 10px 16px', overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12.5, color: '#0A0A0A', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as CSSProperties}>
                        {bs.title}
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: sel ? '#30BCFE' : '#C8C8C8', letterSpacing: 0.5, pointerEvents: 'none' }}>
                        {String(bsi + 1).padStart(2, '0')}
                      </span>
                    </div>
                  )
                })
              )}
            </Fragment>
          )
        })}

        {/* Nó de fim */}
        <div className="fnode" data-key="end" style={{ position: 'absolute', left: endPos.x, top: endPos.y, width: EVT_R * 2, cursor: 'grab' }}>
          <div style={{ width: EVT_R * 2, height: EVT_R * 2, borderRadius: '50%', background: '#30BCFE', boxShadow: '0 2px 8px rgba(48,188,254,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: '#0A0A0A', pointerEvents: 'none' }} />
          </div>
          <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, color: '#B0B0B0', marginTop: 8, pointerEvents: 'none' }}>FIM</div>
        </div>
      </div>

      {/* Controles de zoom */}
      <div className="flow-controls" style={{ position: 'absolute', bottom: 28, left: 28, display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid var(--cinza-borda)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', zIndex: 5 }}>
        <button onClick={() => applyTransform(Math.min(3, stateRef.current.scale * 1.15), stateRef.current.tx, stateRef.current.ty)} style={{ width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#666' }}>+</button>
        <div style={{ width: 1, height: 22, background: 'var(--cinza-borda)' }} />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--cinza-texto)', padding: '0 12px', minWidth: 52, textAlign: 'center' }}>{Math.round(scale * 100)}%</div>
        <div style={{ width: 1, height: 22, background: 'var(--cinza-borda)' }} />
        <button onClick={() => applyTransform(Math.max(0.2, stateRef.current.scale * 0.87), stateRef.current.tx, stateRef.current.ty)} style={{ width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#666' }}>−</button>
      </div>

      {/* Resetar layout */}
      <button
        className="flow-controls"
        onClick={() => {
          const l = autoLayout(steps, localGateways)
          setPositions(l)
          posRef.current = l
          setTimeout(() => doFit(drawerOpenRef.current), 0)
        }}
        style={{ position: 'absolute', bottom: 28, left: 168, height: 36, background: '#fff', border: '1.5px solid var(--cinza-borda)', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', zIndex: 5, padding: '0 14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--cinza-texto)', letterSpacing: 0.5 }}
      >
        Resetar layout
      </button>

      {/* Drawer de detalhe */}
      {selectedDetail && (
        <div className="flow-drawer" style={{ position: 'absolute', top: 0, right: 0, width: 296, height: '100%', background: '#fff', borderLeft: '1px solid var(--cinza-borda)', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10, overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setSelectedDetail(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 20, lineHeight: 1, padding: '4px 8px', borderRadius: 5 }}>×</button>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--cinza-texto)' }}>
            {selectedDetail.branchLabel ? `— ${selectedDetail.branchLabel}` : `— Etapa ${String(steps.findIndex(s => s.order === selectedDetail.order) + 1).padStart(2, '0')}`}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: -0.5, color: 'var(--preto)', lineHeight: 1.25 }}>{selectedDetail.title}</div>
          {selectedDetail.description && (
            <>
              <div style={{ height: 1, background: 'var(--cinza-borda)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cinza-texto)' }}>Descrição</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#444', lineHeight: 1.6 }}>{selectedDetail.description}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
