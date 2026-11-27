const icons = {
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
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  eyeOff: 'M3 3l18 18M10.5 6.1C17.8 5 22 12 22 12a14 14 0 0 1-3 3.2M15.2 17.5C7.1 20.2 2 12 2 12a14 14 0 0 1 4-3.9',
  rotateLeft: 'M3 4v6h6M3 10a9 9 0 1 1 1 8',
  rotateRight: 'M21 4v6h-6m6 0a9 9 0 1 0-1 8',
  plus: 'M5 12h14m-7-7v14',
  duplicate: 'M8 8h12v12H8zM16 4H4v12',
  trash: 'M4 7h16m-11 0V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6',
  done: 'm5 12 4 4L19 6',
  chevron: 'm9 6 6 6-6 6',
}

export function Icon({ name }: { name: keyof typeof icons }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
}

