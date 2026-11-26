export const en = {
  walk: 'Walk', dollhouse: 'Dollhouse', rooms: 'Rooms', measure: 'Measure',
  settings: 'Settings', help: 'Help', close: 'Close', language: 'Language',
  style: 'Style', finished: 'Finished', white: 'White model', lighting: 'Lighting', day: 'Day', night: 'Night',
  roofInDollhouse: 'Roof in dollhouse', switchToDay: 'Switch to day', switchToNight: 'Switch to night',
  fire_lounge: 'Fire-Pit Lounge', wood_deck: 'Wood Deck', pool_deck: 'Pool Deck',
  units: 'Units', imperial: 'Imperial', metric: 'Metric', labels: 'Room labels',
  shadows: 'Shadows', off: 'Off', low: 'Low', high: 'High', clear: 'Clear',
  plan: 'Floor plan', expand: 'Expand plan', collapse: 'Hide plan', showPlan: 'Show plan',
  inside: 'Interior', outside: 'Outdoor', move: 'Movement joystick',
  helpTitle: "Explore Rafael’s Home",
  helpWalk: 'Drag to look around. Use the joystick, WASD, or arrow keys to move. Tap a floor to walk there.',
  helpOrbit: 'In Dollhouse, drag to orbit, pinch or scroll to zoom, and use two fingers or right-drag to pan.',
  helpRooms: 'Choose a room to jump there, or use Measure to pick two points on the model.',
  start: 'Start exploring', loading: 'Loading house…', unavailable: 'This viewer needs WebGL.',
  measureFirst: 'Pick the first point', measureSecond: 'Pick the second point',
  measureAgain: 'Pick a point to start again',
  drawCalls: 'draw calls', triangles: 'triangles',
}

export const pt: Record<keyof typeof en, string> = {
  walk: 'Caminhar', dollhouse: 'Maquete', rooms: 'Ambientes', measure: 'Medir',
  settings: 'Configurações', help: 'Ajuda', close: 'Fechar', language: 'Idioma',
  style: 'Estilo', finished: 'Acabado', white: 'Maquete branca', lighting: 'Iluminação', day: 'Dia', night: 'Noite',
  roofInDollhouse: 'Telhado na maquete', switchToDay: 'Mudar para dia', switchToNight: 'Mudar para noite',
  fire_lounge: 'Lounge com Lareira Externa', wood_deck: 'Deck de Madeira', pool_deck: 'Deck da Piscina',
  units: 'Unidades', imperial: 'Imperial', metric: 'Métrico', labels: 'Nomes dos ambientes',
  shadows: 'Sombras', off: 'Desligadas', low: 'Baixa', high: 'Alta', clear: 'Limpar',
  plan: 'Planta baixa', expand: 'Ampliar planta', collapse: 'Ocultar planta', showPlan: 'Mostrar planta',
  inside: 'Interior', outside: 'Área externa', move: 'Controle de movimento',
  helpTitle: 'Explore a casa do Rafael',
  helpWalk: 'Arraste para olhar ao redor. Use o controle, as teclas WASD ou as setas para se mover. Toque no piso para ir até lá.',
  helpOrbit: 'Na Maquete, arraste para girar, use a pinça ou a roda para aproximar e use dois dedos ou o botão direito para deslocar.',
  helpRooms: 'Escolha um ambiente para ir até ele ou use Medir para selecionar dois pontos na maquete.',
  start: 'Começar a explorar', loading: 'Carregando a casa…', unavailable: 'Este visualizador precisa de WebGL.',
  measureFirst: 'Selecione o primeiro ponto', measureSecond: 'Selecione o segundo ponto',
  measureAgain: 'Selecione um ponto para medir novamente',
  drawCalls: 'chamadas de desenho', triangles: 'triângulos',
}

export type Language = 'en' | 'pt-BR'
export const dictionary = { en, 'pt-BR': pt }

const englishRooms: Record<string, string> = {
  living: 'Living Room', dining: 'Dining Room', kitchen: 'Kitchen',
  semi_suite_1: 'Semi-suite 1 (shared bath)', semi_suite_2: 'Semi-suite 2 (shared bath)',
  bathroom: 'Bathroom', master_suite: 'Master Suite', closet: 'Walk-in Closet',
  master_bath: 'Master Bathroom', hallway: 'Hallway', service: 'Laundry / Service Area',
  powder_room: 'Powder Room', hall: 'Hall', veranda: 'Veranda',
  gourmet: 'Gourmet Area / Outdoor Kitchen', terrace: 'Terrace', garage: 'Garage',
  entry: 'Entrance Hall', front_walk: 'Front Walkway', driveway: 'Driveway Ramp',
  entry_walk: 'Entry Path', side_path: 'Side Walkway', rear_path: 'Rear Walkway',
  pool: 'Pool', garden: 'Garden', garden_front: 'Front Garden',
  garden_side: 'Side Garden', garden_rear: 'Rear Garden',
}

export function roomName(zone: { key: string; namePt: string }, language: Language) {
  const { key } = zone
  if (key === 'fire_lounge' || key === 'wood_deck' || key === 'pool_deck') return dictionary[language][key]
  return language === 'en' && Object.hasOwn(englishRooms, zone.key) ? englishRooms[zone.key] : zone.namePt
}
