import { readFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const logo = await readFile(new URL('../public/multiply-logo.svg', import.meta.url), 'utf8')
const artwork = logo.replace(/<svg[^>]*>/, '<svg x="24" y="24" width="52" height="52" viewBox="-0.6601 -34.8203 40.6476 36.1328">')
const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f6f5ff"/>${artwork}</svg>`)
const directory = new URL('../public/icons/', import.meta.url)
await mkdir(directory, { recursive: true })
for (const size of [32, 180, 192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(new URL(`icon-${size}.png`, directory).pathname)
}
