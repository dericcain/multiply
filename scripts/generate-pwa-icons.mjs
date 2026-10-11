import { readFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const logo = await readFile(new URL('../public/multiply-logo.svg', import.meta.url), 'utf8')
// Keep the purple tile inside a separate opaque surround, rather than using
// purple as the edge-to-edge background iOS may replace in its dark treatment.
const artwork = logo
  .replace(/<svg[^>]*>/, '<svg x="24" y="24" width="52" height="52" viewBox="-0.6601 -34.8203 40.6476 36.1328">')
  .replace('fill="#5c55d5"', 'fill="#ffffff"')
  .replace('fill="#000000"', 'fill="#fff0bb"')
const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="purple" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9383ff"/>
      <stop offset="0.5" stop-color="#7c6aee"/>
      <stop offset="1" stop-color="#6957df"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="#f6f5ff"/>
  <rect x="5" y="5" width="90" height="90" rx="20" fill="url(#purple)"/>
  ${artwork}
</svg>`)
const directory = new URL('../public/icons/', import.meta.url)
await mkdir(directory, { recursive: true })
for (const size of [32, 180, 192, 512]) {
  await sharp(icon).resize(size, size).removeAlpha().png().toFile(new URL(`icon-${size}.png`, directory).pathname)
}
