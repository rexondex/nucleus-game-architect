import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = resolve(projectRoot, 'src/01_nucleus-core/clothing-catalog.json')
const publicRoot = resolve(projectRoot, 'public')
const allowedSlots = new Set(['hair', 'face', 'top', 'bottom', 'shoes', 'accessory'])
const allowedRarities = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary'])
const errors = []

function validatePublicAsset(assetPath, label) {
  if (typeof assetPath !== 'string' || !assetPath.startsWith('/assets/')) {
    errors.push(`${label}: 경로는 /assets/로 시작해야 합니다.`)
    return
  }

  const diskPath = resolve(publicRoot, `.${assetPath}`)
  if (!diskPath.startsWith(`${publicRoot}${sep}`)) {
    errors.push(`${label}: public 폴더 바깥 경로는 사용할 수 없습니다.`)
    return
  }

  if (!existsSync(diskPath)) errors.push(`${label}: 파일이 없습니다 (${assetPath}).`)
}

let catalog
try {
  catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
} catch (error) {
  console.error(`의상 카탈로그를 읽을 수 없습니다: ${error.message}`)
  process.exit(1)
}

if (!Array.isArray(catalog)) {
  console.error('의상 카탈로그 최상위 값은 배열이어야 합니다.')
  process.exit(1)
}

const seenIds = new Set()
for (const [index, item] of catalog.entries()) {
  const label = `clothing[${index}]`
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    errors.push(`${label}: 객체여야 합니다.`)
    continue
  }

  if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(item.id)) {
    errors.push(`${label}.id: 소문자 영문, 숫자, 하이픈으로 된 안정적인 ID가 필요합니다.`)
  } else if (seenIds.has(item.id)) {
    errors.push(`${label}.id: 중복 ID입니다 (${item.id}).`)
  } else {
    seenIds.add(item.id)
  }

  if (typeof item.displayName !== 'string' || item.displayName.trim() === '') {
    errors.push(`${label}.displayName: 비어 있지 않은 표시 이름이 필요합니다.`)
  }
  if (!allowedSlots.has(item.slot)) errors.push(`${label}.slot: 알 수 없는 의상 슬롯입니다.`)
  if (!allowedRarities.has(item.rarity)) errors.push(`${label}.rarity: 알 수 없는 희귀도입니다.`)
  if (!Array.isArray(item.compatibleRigIds) || item.compatibleRigIds.length === 0) {
    errors.push(`${label}.compatibleRigIds: 하나 이상의 리그 ID가 필요합니다.`)
  }
  validatePublicAsset(item.asset, `${label}.asset`)
  validatePublicAsset(item.icon, `${label}.icon`)
}

if (errors.length > 0) {
  console.error(`콘텐츠 검사에서 ${errors.length}개 오류를 찾았습니다:`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`의상 카탈로그 ${catalog.length}개 항목을 확인했습니다.`)
