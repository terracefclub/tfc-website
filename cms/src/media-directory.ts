import path from 'node:path'

export function mediaDirectory(env = process.env) {
  const value = env.CMS_MEDIA_DIR
  if (value === undefined) return path.resolve('.state/media')
  if (!value || !path.isAbsolute(value) || value.includes('\0')) throw new Error('CMS_MEDIA_DIR must be an absolute directory.')
  return path.normalize(value)
}
