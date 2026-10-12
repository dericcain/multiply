import type { NextConfig } from "next"
import createWithVercelToolbar from "@vercel/toolbar/plugins/next"

const nextConfig: NextConfig = {
}

const withVercelToolbar = createWithVercelToolbar()
export default withVercelToolbar(nextConfig)
