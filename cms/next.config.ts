import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  images: { localPatterns: [{ pathname: '/api/media/file/**' }] },
  turbopack: { root: path.resolve('.') },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
