import sharp from 'sharp'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const inputSvg = join(__dirname, '../public/icon-512.svg')
const outputDir = join(__dirname, '../public')

const iconSizes = [
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-120.png', size: 120 },
  { name: 'icon-72.png', size: 72 },
  { name: 'icon-96.png', size: 96 },
  { name: 'icon-128.png', size: 128 },
  { name: 'icon-144.png', size: 144 },
  { name: 'icon-152.png', size: 152 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-384.png', size: 384 },
  { name: 'icon-512.png', size: 512 },
]

const splashScreens = [
  { name: 'splash-640x1136.png', width: 640, height: 1136 },
  { name: 'splash-750x1334.png', width: 750, height: 1334 },
  { name: 'splash-1125x2436.png', width: 1125, height: 2436 },
  { name: 'splash-1242x2688.png', width: 1242, height: 2688 },
  { name: 'splash-1536x2048.png', width: 1536, height: 2048 },
  { name: 'splash-1668x2224.png', width: 1668, height: 2224 },
  { name: 'splash-1668x2388.png', width: 1668, height: 2388 },
  { name: 'splash-2048x2732.png', width: 2048, height: 2732 },
]

async function generateIcons() {
  console.log('Generating PWA icons...')

  for (const { name, size } of iconSizes) {
    const outputPath = join(outputDir, name)
    try {
      await sharp(inputSvg, { density: 300 })
        .resize(size, size, { fit: 'contain', background: '#050505' })
        .png()
        .toFile(outputPath)
      console.log(`  ✓ ${name} (${size}x${size})`)
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message)
    }
  }
}

async function generateSplashScreens() {
  console.log('\nGenerating splash screens...')

  const splashSvg = `
    <svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
      <rect width="2732" height="2732" fill="#050505"/>
      <text x="1366" y="1400" font-family="system-ui, sans-serif" font-size="800" fill="#baff39" text-anchor="middle">👻</text>
      <text x="1366" y="1600" font-family="system-ui, sans-serif" font-size="120" fill="#baff39" text-anchor="middle" font-weight="bold">YARD</text>
    </svg>
  `

  for (const { name, width, height } of splashScreens) {
    const outputPath = join(outputDir, name)
    try {
      await sharp(Buffer.from(splashSvg), { density: 300 })
        .resize(width, height, { fit: 'cover' })
        .png()
        .toFile(outputPath)
      console.log(`  ✓ ${name} (${width}x${height})`)
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message)
    }
  }
}

async function main() {
  await generateIcons()
  await generateSplashScreens()
  console.log('\nDone! Check public/ folder for generated assets.')
}

main().catch(console.error)