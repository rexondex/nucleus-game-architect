/**
 * 공통 콘텐츠 규격을 소유한다.
 * React, R3F, 브라우저 API를 import하지 않는다.
 * 새 의상 슬롯이나 희귀도는 여기에서 타입과 함께 추가한다.
 */
export const CLOTHING_SLOTS = [
  'hair',
  'face',
  'top',
  'bottom',
  'shoes',
  'accessory',
] as const

export type ClothingSlot = (typeof CLOTHING_SLOTS)[number]

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

export type ItemRarity = (typeof ITEM_RARITIES)[number]

export interface ClothingDefinition {
  /** 출시 후에도 유지되는 콘텐츠 참조 ID */
  id: string
  displayName: string
  slot: ClothingSlot
  /** public/ 기준 경로. 예: /assets/clothing/hat.glb */
  asset: string
  /** public/ 기준 경로. 예: /assets/icons/hat.webp */
  icon: string
  compatibleRigIds: string[]
  rarity: ItemRarity
}

export interface WorldObjectDefinition {
  id: string
  displayName: string
  asset: string
  interaction: 'inspect' | 'open-link' | 'collect'
}
