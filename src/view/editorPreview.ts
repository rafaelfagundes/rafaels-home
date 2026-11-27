import { create } from 'zustand'
import type { FurnitureItem } from '../model/furniture'

export const useEditorPreview = create<{ item: FurnitureItem | null }>(() => ({ item: null }))
