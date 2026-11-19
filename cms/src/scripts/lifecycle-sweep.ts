import { getPayload } from 'payload'
import config from '../payload.config'
import { sweep } from '../lifecycle/sweep'

// bun src/scripts/lifecycle-sweep.ts [--purge-moderated]
const payload = await getPayload({ config })
try {
  console.log(JSON.stringify(await sweep(payload, { purgeModerated: process.argv.includes('--purge-moderated') }), null, 2))
} finally { await payload.db.destroy?.() }
