import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'

type Step = {
  order: number
  title: string
  description?: string
  url?: string
  notes?: string
  sectionTitle?: string
  sectionIndex?: number
}

type GatewayBranch = {
  id: string
  label: string
  color: string
  steps: Step[]
}

type Gateway = {
  id: string
  afterStep: number
  type?: 'exclusive' | 'parallel' | 'inclusive'
  question: string
  branches: GatewayBranch[]
}

type ProcessDetail = {
  id: string
  title: string
  objective: string | null
  executor: string | null
  frequency: string | null
  status: string
  steps: Step[]
  gateways?: Gateway[]
  updatedAt: string
  creator: { id: string; name: string }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const STATUS_CLASS: Record<string, string> = {
  published: 'status-publicado',
  draft: 'status-rascunho',
  archived: 'status-desatualizado',
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Desatualizado',
}

// ── FLUXOGRAMA ──
type NodePos = { x: number; y: number }
type FlowPositions = Record<string, NodePos>

const EVT_R        = 28
const CRD_W        = 192
const CRD_H        = 84
const F_GAP        = 80
const F_INIT_Y     = 200
const GW_SIZE      = 22
const TRACK_STROKE    = 2.5
const BRANCH_MID_BASE = 32   // gap from diamond to first vertical segment
const BRANCH_MID_STEP = 22   // spacing between each branch's vertical segment

const LANE_H_MIN   = 200
const LANE_LABEL_W = 100
const LANE_TOP     = 40
const LANE_ROW_PAD = 44   // vertical padding inside a lane
const LANE_ROW_GAP = 20   // gap between stacked branch rows in same lane

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

// For each lane, count the maximum number of branches (across all gateways)
// that place steps in that lane simultaneously → determines lane height.
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

      // Pre-compute: per lane, how many branches place steps there (for centering sub-rows)
      const laneMaxRows = new Map<number, number>()
      // Pre-compute: which sub-row each branch gets within each lane
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
            const laneIdx  = bs.sectionIndex ?? 0
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

function FlowView({ steps, gateways, processId }: { steps: Step[]; gateways: Gateway[]; processId: string }) {
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

  // Steps that have a gateway after them — skip their direct step→step connector
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

          {/* start → step[0]: single neutral line */}
          {steps[0] && (() => {
            const p0 = positions[String(steps[0].order)]
            if (!p0) return null
            return <path d={orthPath(startPos.x + EVT_R * 2, startPos.y + EVT_R, p0.x, p0.y + CRD_H / 2)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })()}

          {/* step[i] → step[i+1]: single neutral line (skip when gateway sits between) */}
          {steps.slice(0, -1).map((s, i) => {
            if (gwAfterSteps.has(s.order)) return null
            const pa = positions[String(s.order)]
            const pb = positions[String(steps[i + 1].order)]
            if (!pa || !pb) return null
            return <path key={s.order} d={orthPath(pa.x + CRD_W, pa.y + CRD_H / 2, pb.x, pb.y + CRD_H / 2)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })}

          {/* last step → end: single neutral line (no gateway ahead) */}
          {steps[steps.length - 1] && !gwAfterSteps.has(steps[steps.length - 1].order) && (() => {
            const pl = positions[String(steps[steps.length - 1].order)]
            if (!pl) return null
            return <path d={orthPath(pl.x + CRD_W, pl.y + CRD_H / 2, endPos.x, endPos.y + EVT_R)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
          })()}

          {/* Gateway edges */}
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
                {/* afterStep card → diamond: single neutral line (1 flow entering) */}
                {(() => {
                  const p = positions[String(gw.afterStep)]
                  if (!p) return null
                  return <path d={orthPath(p.x + CRD_W, p.y + CRD_H / 2, gwCX - GW_SIZE, gwCY)} fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round" />
                })()}

                {/* diamond → branches (1 colored line each), intra-branch, branch → next */}
                {gw.branches.map((branch, bi) => {
                  if (!branch.steps.length) return null
                  const key0 = `gw-${gw.id}-${branch.id}-${branch.steps[0].order}`
                  const bsp0 = positions[key0]
                  if (!bsp0) return null

                  // Each branch gets its own vertical segment X, staggered from the diamond
                  const divMidX = gwCX + GW_SIZE + BRANCH_MID_BASE + bi * BRANCH_MID_STEP
                  const gwExitX = gwCX + GW_SIZE
                  const gwExitY = gwCY

                  const paths: React.ReactElement[] = []

                  // diamond → first branch step
                  paths.push(
                    <path
                      key="gw-to-first"
                      d={orthPath(gwExitX, gwExitY, bsp0.x, bsp0.y + CRD_H / 2, divMidX)}
                      fill="none" stroke="#C4C4C4" strokeWidth={TRACK_STROKE} strokeLinejoin="round"
                    />
                  )

                  // intra-branch connectors (natural midpoint)
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

                  // branch last step → next main step or end
                  // convergence: stagger from the right side (reverse order so lines don't cross)
                  const lastBs = branch.steps[branch.steps.length - 1]
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
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12.5, color: '#0A0A0A', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
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
              {/* Diamond node */}
              {gwp && (
                <div
                  className="fnode"
                  data-key={`gw-${gw.id}`}
                  onMouseEnter={() => setHoveredGwId(gw.id)}
                  onMouseLeave={() => setHoveredGwId(null)}
                  style={{ position: 'absolute', left: gwp.x, top: gwp.y, width: GW_SIZE * 2, height: GW_SIZE * 2, cursor: 'grab' }}
                >
                  {/* Rotated square = diamond */}
                  <div style={{ width: GW_SIZE * 2, height: GW_SIZE * 2, background: '#30BCFE', transform: 'rotate(45deg)', borderRadius: 3, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round">
                        {(!gw.type || gw.type === 'exclusive') && (<><line x1="4" y1="4" x2="10" y2="10"/><line x1="10" y1="4" x2="4" y2="10"/></>)}
                        {gw.type === 'parallel'  && (<><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></>)}
                        {gw.type === 'inclusive' && (<circle cx="7" cy="7" r="3"/>)}
                      </svg>
                    </div>
                  </div>

                  {/* Hover tooltip */}
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

              {/* Branch step cards */}
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
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12.5, color: '#0A0A0A', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
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

export default function ProcessoPage() {
  const { id } = useParams({ from: '/processo/$id' })
  const navigate = useNavigate()
  const [tab, setTab] = useState<'doc' | 'flow'>('doc')
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  function handleCompartilhar() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { data: process, isLoading } = useQuery({
    queryKey: ['process', id],
    queryFn: () => api.get<ProcessDetail>(`/api/processes/${id}`),
  })

  const steps: Step[] = Array.isArray(process?.steps) ? (process.steps as Step[]) : []
  const gateways: Gateway[] = Array.isArray(process?.gateways) ? (process.gateways as Gateway[]) : []
  const progress = steps.length > 0 ? Math.round((doneSteps.size / steps.length) * 100) : 0

  function toggleStep(order: number) {
    setDoneSteps(prev => {
      const next = new Set(prev)
      if (next.has(order)) next.delete(order)
      else next.add(order)
      return next
    })
  }

  useEffect(() => {
    if (tab !== 'doc' || !contentRef.current || steps.length === 0) return
    const visible = new Map<number, boolean>()
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const order = parseInt(entry.target.id.replace('step-', ''))
          visible.set(order, entry.isIntersecting)
        })
        const first = steps.find(s => visible.get(s.order))
        setActiveStep(first?.order ?? null)
      },
      { root: contentRef.current, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    )
    steps.forEach(s => {
      const el = document.getElementById(`step-${s.order}`)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.id, tab])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, color: 'var(--preto)' }}>
        Carregando...
      </div>
    )
  }

  if (!process) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, color: 'var(--preto)' }}>
        Processo não encontrado.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* MAIN */}
      <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F2F2F2' }}>

        {/* TOPBAR */}
        <div className="process-topbar">
          <div className="breadcrumb">
            <a href="#" onClick={e => { e.preventDefault(); navigate({ to: '/biblioteca' }) }}>Home</a>
            <span className="breadcrumb-sep">/</span>
            {process.executor && <><span style={{ color: '#bbb' }}>{process.executor}</span><span className="breadcrumb-sep">/</span></>}
            <span className="breadcrumb-current">{process.title}</span>
          </div>
          <div className="topbar-actions">
            <button className="btn-ghost" onClick={() => navigate({ to: '/studio/$id', params: { id: process.id } })}>
              <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9.5V11h1.5l5-5-1.5-1.5-5 5zM10.5 3.5l-1-1a.7.7 0 0 0-1 0l-.9.9 1.5 1.5.9-.9a.7.7 0 0 0 0-1z"/></svg>
              Editar
            </button>
            <button className="btn-ghost" onClick={handleCompartilhar}>
              {copied ? (
                <>
                  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5,10 11,3"/></svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="2.5" r="1.5"/><circle cx="10" cy="10.5" r="1.5"/><circle cx="3" cy="6.5" r="1.5"/><line x1="4.4" y1="7.3" x2="8.6" y2="9.7"/><line x1="8.6" y1="3.3" x2="4.4" y2="5.7"/></svg>
                  Compartilhar
                </>
              )}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs-bar">
          <button className={`tab-btn${tab === 'doc' ? ' active' : ''}`} onClick={() => setTab('doc')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="9" height="11" rx="1.5"/><line x1="4.5" y1="4.5" x2="8.5" y2="4.5"/><line x1="4.5" y1="7" x2="8.5" y2="7"/><line x1="4.5" y1="9.5" x2="6.5" y2="9.5"/></svg>
            Documento
          </button>
          <button className={`tab-btn${tab === 'flow' ? ' active' : ''}`} onClick={() => setTab('flow')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="4" height="3" rx="1"/><rect x="8" y="5" width="4" height="3" rx="1"/><rect x="1" y="9" width="4" height="3" rx="1"/><path d="M5 2.5h2a1 1 0 0 1 1 1v1"/><path d="M5 10.5h2a1 1 0 0 0 1-1v-1"/></svg>
            Fluxograma
          </button>
        </div>

        {/* VIEW DOC */}
        {tab === 'doc' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div ref={contentRef} className="process-content">
              <div className="content-inner">
                <div className="process-meta">
                  {process.executor && <div className="meta-tag">{process.executor}</div>}
                  <div className={`status-pill ${STATUS_CLASS[process.status] ?? ''}`}>
                    <div className="dot" />
                    {STATUS_LABEL[process.status] ?? process.status}
                  </div>
                  <div className="meta-sep">·</div>
                  <div className="meta-date">
                    Atualizado em {new Date(process.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <h1 className="process-title">{process.title}</h1>

                {process.objective && (
                  <p className="process-desc">{process.objective}</p>
                )}

                <div className="owners-row">
                  <div className="owners-label">Criado por</div>
                  <div className="owners-list">
                    <div className="owner-chip">
                      <div className="owner-av" style={{ background: 'var(--azul)', color: 'var(--preto)' }}>
                        {initials(process.creator.name)}
                      </div>
                      {process.creator.name}
                    </div>
                  </div>
                </div>

                {steps.length > 0 && (
                  <div className="section-block">
                    <div className="section-eyebrow">— Passos</div>
                    <div className="steps-list">
                      {steps.map(s => {
                        const done = doneSteps.has(s.order)
                        return (
                          <div key={s.order} id={`step-${s.order}`} className={`step${done ? ' done' : ''}`} onClick={() => toggleStep(s.order)}>
                            <div className="step-left">
                              <div className="step-num">{s.order}</div>
                            </div>
                            <div className="step-right">
                              <div className="step-card">
                                <div className="step-header">
                                  <div className="step-name">{s.title}</div>
                                </div>
                                {s.description && <div className="step-desc">{s.description}</div>}
                                {s.notes && (
                                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(250,219,2,0.08)', borderRadius: 6, borderLeft: '2px solid var(--amarelo)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                                    {s.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {steps.length === 0 && (
                  <div style={{ color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.7 }}>
                    Este processo ainda não tem passos definidos.
                  </div>
                )}
              </div>
            </div>

            {/* TOC */}
            {steps.length > 0 && (
              <div className="process-toc">
                <div className="toc-label">— Passos</div>
                {steps.map(s => (
                  <a
                    key={s.order}
                    className={`toc-item${activeStep === s.order ? ' active' : ''}`}
                    href={`#step-${s.order}`}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById(`step-${s.order}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    <span className="toc-num">{String(s.order).padStart(2, '0')}</span>
                    {s.title}
                  </a>
                ))}
                <div className="toc-divider" />
                <div className="toc-progress">
                  <div className="toc-prog-label">
                    <span className="toc-prog-text">Progresso</span>
                    <span className="toc-prog-pct">{progress}%</span>
                  </div>
                  <div className="prog-bar">
                    <div className="prog-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW FLUXOGRAMA */}
        {tab === 'flow' && steps.length > 0 && (
          <FlowView steps={steps} gateways={gateways} processId={process.id} />
        )}
        {tab === 'flow' && steps.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
            Nenhum passo para exibir no fluxograma.
          </div>
        )}
      </div>
    </div>
  )
}
