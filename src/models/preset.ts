export type SetupFeePreset = {
  id: number
  name: string
  description: string | null
  unitLabel: string
  defaultRate: number
  defaultCost: number
  sortOrder: number
  isActive: boolean
}

export type LineItemPreset = {
  id: number
  name: string
  description: string | null
  defaultPrice: number
  defaultCost: number
  sortOrder: number
  isActive: boolean
}
