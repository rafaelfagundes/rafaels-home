import { lazy, Suspense, useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createRoot } from 'react-dom/client'
import { house, outdoorFeatures, safePosition, walkCollisionFor, zonePose, zones } from './model/house'
import { dictionary, roomName } from './model/i18n'
import { useApp, type Panel } from './model/store'
import { formatArea } from './model/units'
import { planters } from './model/landscape'
import type { Footprint } from './model/geometry'
import './styles.css'

const landscapeFills: Record<string, string> = {
  pool_deck: '#d7cfc1', fire_lounge: '#aba79f', wood_deck: '#ac987e', side_path: '#ac987e',
}

const showStats = new URLSearchParams(window.location.search).has('stats')
const Scene = lazy(() => import('./view/Scene'))

const icons = {
  house: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6',
  walk: 'M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 15 2-6-2-3 2-4 3 4 4 1m-7 2 4 2 1 4M6 13l2-4 3-1',
  dollhouse: 'm12 3 9 5v8l-9 5-9-5V8l9-5Zm0 18v-8M3 8l9 5 9-5',
  rooms: 'M4 4h16v16H4zM4 11h9m3 0h4m-8 0v9',
  measure: 'm3 16 13-13 5 5L8 21l-5-5Zm5-5 2 2m1-5 2 2m1-5 2 2',
  settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9 9a3 3 0 1 1 4.7 2.5c-1 .6-1.7 1.1-1.7 2.5m0 3h.01',
  expand: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  minus: 'M5 12h14', close: 'm6 6 12 12M18 6 6 18',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.8 15A9 9 0 0 1 9 3.2 9 9 0 1 0 20.8 15Z',
  chevron: 'm9 6 6 6-6 6',
}

function Icon({ name }: { name: keyof typeof icons }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
}

function pathFor({ polygon, holes = [] }: Footprint) {
  return [polygon, ...holes].map(ring => `M${ring.map(point => point.join(' ')).join('L')}Z`).join('')
}

function Plan({ interactive = false }: { interactive?: boolean }) {
  const pose = useApp(s => s.pose)
  const jump = useApp(s => s.jump)
  const t = dictionary[useApp(s => s.settings.language)]
  const [x, y] = pose.position
  function navigate(event: React.MouseEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const position = safePosition([point.x, point.y], undefined, walkCollisionFor(useApp.getState().settings))
    if (position) jump(position, pose.heading)
  }
  return <svg viewBox={`-0.2 -0.2 ${house.lot.width + 0.4} ${house.lot.depth + 0.4}`}
    className={interactive ? 'plan-svg interactive' : 'plan-svg'} role="img" aria-label={t.plan}
    onClick={interactive ? navigate : undefined}>
    <path d={pathFor(house.lot)} fill="#e2e7dd" />
    {zones.map(zone => <path key={zone.id} d={pathFor(zone)} fillRule="evenodd"
      fill={landscapeFills[zone.key] ?? (zone.kind === 'garden' ? '#d9e4d5' : zone.kind === 'pool' ? '#a8cbd7' : zone.indoor ? '#f8f6ed' : '#e1e4df')}
      stroke="#8f9f962e" strokeWidth=".07" />)}
    {outdoorFeatures.loungeApron.map((slab, index) => <path key={index} d={pathFor(slab)} fill={landscapeFills.pool_deck} />)}
    {outdoorFeatures.steps.map((step, index) => <path key={index} d={pathFor(step)}
      fill="#c7c2b8" stroke="#96918a" strokeWidth=".06" />)}
    {outdoorFeatures.bench.map((bench, index) => <path key={index} d={pathFor(bench)} fill="#ded9cd" />)}
    <path d={pathFor(outdoorFeatures.firePit)} fill="#3b3935" />
    {planters.map(planter => <path key={planter.point.join(',')} d={pathFor(planter)} fill="#41483e" />)}
    {[...house.walls, ...house.perimeterWalls].map(wall => <path key={wall.id} d={pathFor(wall)}
      fillRule="evenodd" fill="#4b5b55" />)}
    {house.openings.map((opening, i) => {
      const [x0, y0, x1, y1] = opening.rect
      return <rect key={i} x={x0} y={y0} width={x1 - x0} height={y1 - y0}
        fill={opening.kind === 'window' ? '#81aaba' : '#b8a380'} />
    })}
    <g transform={`translate(${x} ${y}) rotate(${pose.heading * 180 / Math.PI})`}>
      <path d="M1.43 0-.45-.72-.16 0-.45.72Z" fill="#285b50" stroke="white" strokeWidth=".15" />
      <circle r=".85" fill="none" stroke="#356a5860" strokeWidth=".16" />
    </g>
  </svg>
}

function Joystick() {
  const t = dictionary[useApp(s => s.settings.language)]
  const [x, y] = useApp(s => s.joystick)
  const pointer = useRef<number | null>(null)
  function move(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return
    const box = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - box.left - box.width / 2) / (box.width * 0.33)
    const dy = (box.top + box.height / 2 - event.clientY) / (box.width * 0.33)
    const length = Math.max(1, Math.hypot(dx, dy))
    useApp.setState({ joystick: [dx / length, dy / length] })
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return
    pointer.current = null
    useApp.setState({ joystick: [0, 0] })
  }
  return <div className="joystick" role="group" aria-label={t.move} onPointerDown={event => {
    if (pointer.current !== null || event.button !== 0) return
    pointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    move(event)
  }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
    <div className="joystick-axis" aria-hidden="true" />
    <div className="joystick-knob" style={{ transform: `translate(${x * 28}px, ${-y * 28}px)` }} />
  </div>
}

function Rooms() {
  const { language, units } = useApp(s => s.settings)
  const jump = useApp(s => s.jump)
  const t = dictionary[language]
  return [true, false].map(indoor => <section className="room-group" key={String(indoor)}>
    <h3>{indoor ? t.inside : t.outside}</h3>
    <ul>{zones.filter(zone => zone.indoor === indoor).map(zone => <li key={zone.id}>
      <button className="room-row" onClick={() => {
        const { position, heading } = zonePose(zone, walkCollisionFor(useApp.getState().settings))
        jump(position, heading)
      }}>
        <span>{roomName(zone, language)}</span>
        <span className="room-area">{formatArea(zone.areaLabeled ?? zone.areaComputed, units, language)}</span>
        <Icon name="chevron" />
      </button>
    </li>)}</ul>
  </section>)
}

function Settings() {
  const settings = useApp(s => s.settings)
  const change = useApp(s => s.changeSettings)
  const t = dictionary[settings.language]
  return <div className="settings-list">
    <label>{t.language}<select value={settings.language} onChange={event => change({ language: event.target.value === 'pt-BR' ? 'pt-BR' : 'en' })}>
      <option value="en" lang="en">English</option><option value="pt-BR" lang="pt-BR">Português (Brasil)</option>
    </select></label>
    <label>{t.units}<select value={settings.units} onChange={event => change({ units: event.target.value === 'metric' ? 'metric' : 'imperial' })}>
      <option value="imperial">{t.imperial}</option><option value="metric">{t.metric}</option>
    </select></label>
    <label>{t.style}<select value={settings.style} onChange={event => change({ style: event.target.value === 'white' ? 'white' : 'finished' })}>
      <option value="finished">{t.finished}</option><option value="white">{t.white}</option>
    </select></label>
    <label>{t.lighting}<select value={settings.lighting} onChange={event => change({ lighting: event.target.value === 'night' ? 'night' : 'day' })}>
      <option value="day">{t.day}</option><option value="night">{t.night}</option>
    </select></label>
    <label>{t.roofInDollhouse}<input type="checkbox" checked={settings.roofInDollhouse}
      onChange={event => change({ roofInDollhouse: event.target.checked })} /></label>
    <label>{t.furniture}<input type="checkbox" checked={settings.furniture}
      onChange={event => change({ furniture: event.target.checked })} /></label>
    <label>{t.vehicles}<input type="checkbox" checked={settings.vehicles}
      onChange={event => change({ vehicles: event.target.checked })} /></label>
    <label>{t.labels}<input type="checkbox" checked={settings.labels}
      onChange={event => change({ labels: event.target.checked })} /></label>
    <label>{t.shadows}<select value={settings.shadows} onChange={event => {
      const value = event.target.value
      change({ shadows: value === 'off' || value === 'high' ? value : 'low' })
    }}><option value="off">{t.off}</option><option value="low">{t.low}</option><option value="high">{t.high}</option></select></label>
  </div>
}

function Sheet({ panel, title, children }: { panel: Panel; title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useApp(s => s.setPanel)
  const t = dictionary[useApp(s => s.settings.language)]
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return <dialog ref={dialog} className={`sheet sheet-${panel}`} aria-labelledby="sheet-title"
    onCancel={event => { event.preventDefault(); close(null) }}
    onClick={event => { if (event.target === event.currentTarget) close(null) }}>
    <div className="sheet-content">
      <header className="sheet-header">
        <h2 id="sheet-title">{title}</h2>
        <button className="icon-button" aria-label={t.close} onClick={() => close(null)}><Icon name="close" /></button>
      </header>
      <div className="sheet-body">{children}</div>
    </div>
  </dialog>
}

function App() {
  const { mode, panel, setMode, setPanel, measuring, toggleMeasure } = useApp(useShallow(s => ({ mode: s.mode, panel: s.panel, setMode: s.setMode, setPanel: s.setPanel, measuring: s.measuring, toggleMeasure: s.toggleMeasure })))
  const language = useApp(s => s.settings.language)
  const t = dictionary[language]
  const night = useApp(s => s.settings.lighting === 'night')
  const style = useApp(s => s.settings.style)
  const changeSettings = useApp(s => s.changeSettings)
  const lightingAction = night ? t.switchToDay : t.switchToNight
  const points = useApp(s => s.points)
  const map = useRef<HTMLDivElement>(null)
  const stats = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = t.appName
  }, [language, t.appName])

  useEffect(() => {
    const preventZoom = (event: Event) => event.preventDefault()
    document.addEventListener('gesturestart', preventZoom, { passive: false })
    return () => document.removeEventListener('gesturestart', preventZoom)
  }, [])

  function togglePlan(hidden: boolean) {
    const element = map.current
    if (!element) return
    element.dataset.collapsed = String(hidden)
    element.querySelector<HTMLButtonElement>(hidden ? '.map-show' : '.map-hide')?.focus()
  }

  return <main className="app">
    <div className="viewport" data-style={style} data-lighting={night ? 'night' : 'day'}>
      <Suspense fallback={<p className="loading">{t.loading}</p>}><Scene stats={showStats ? stats : undefined} /></Suspense>
    </div>
    <header className="topbar surface">
      <div className="brand"><span className="brand-icon"><Icon name="house" /></span><h1>{t.appName}</h1></div>
      <div className="modes">
        {(['walk', 'dollhouse'] as const).map(value => <button key={value} aria-pressed={mode === value}
          onClick={() => setMode(value)}><Icon name={value} />{t[value]}</button>)}
      </div>
      <button className="icon-button" aria-label={lightingAction} title={lightingAction}
        onClick={() => changeSettings({ lighting: night ? 'day' : 'night' })}><Icon name={night ? 'moon' : 'sun'} /></button>
      <button className="icon-button top-help" aria-label={t.help} title={t.help}
        onClick={() => setPanel('help')}><Icon name="help" /></button>
      {showStats && <div className="render-stats" ref={stats} />}
    </header>
    <div className="map surface" ref={map}>
      <button className="icon-button map-show" onClick={() => togglePlan(false)} aria-label={t.showPlan}
        title={t.showPlan}><Icon name="rooms" /></button>
      <div className="map-content">
        <div className="map-heading"><span>{t.plan}</span>
          <div className="map-actions">
            <button className="icon-button" aria-label={t.expand} title={t.expand}
              onClick={() => setPanel('plan')}><Icon name="expand" /></button>
            <button className="icon-button map-hide" aria-label={t.collapse} title={t.collapse}
              onClick={() => togglePlan(true)}><Icon name="minus" /></button>
          </div>
        </div>
        <div className="map-drawing"><Plan interactive /></div>
      </div>
    </div>
    {measuring && <div className="measure-status surface">
      <span role="status">{points.length === 0 ? t.measureFirst : points.length === 1 ? t.measureSecond : t.measureAgain}</span>
      <button disabled={!points.length} onClick={() => useApp.setState({ points: [] })}>{t.clear}</button>
    </div>}
    {mode === 'walk' && !panel && <Joystick />}
    <div className="toolbar surface">
      <button onClick={() => setPanel('rooms')}><Icon name="rooms" />{t.rooms}</button>
      <button onClick={toggleMeasure} aria-pressed={measuring}><Icon name="measure" />{t.measure}</button>
      <button onClick={() => setPanel('settings')}><Icon name="settings" />{t.settings}</button>
    </div>
    {panel && <Sheet key={panel} panel={panel} title={panel === 'help' ? t.helpTitle : t[panel]}>
      {panel === 'rooms' && <Rooms />}
      {panel === 'settings' && <Settings />}
      {panel === 'plan' && <Plan interactive />}
      {panel === 'help' && <>
        <ul className="help-list">
          <li><Icon name="walk" /><p>{t.helpWalk}</p></li>
          <li><Icon name="dollhouse" /><p>{t.helpOrbit}</p></li>
          <li><Icon name="measure" /><p>{t.helpRooms}</p></li>
        </ul>
        <button className="primary" onClick={() => setPanel(null)}>{t.start}</button>
      </>}
    </Sheet>}
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
