// Built to a Node ESM entrypoint for the release bundle (`bin/roster-invite`): the source command line itself, with the same arguments, output and
// refusals (tools/release/README.md, "Operator tools"). In the bundle `import.meta.main` of tools/roster-invite.ts is false, so this is the only call.
import { main } from './roster-invite'
await main()
