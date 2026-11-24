// Built to a Node ESM entrypoint for the release bundle (`bin/wp-import`): the source command line itself, with the same arguments, output and
// refusals (tools/release/README.md, "Operator tools"). In the bundle `import.meta.main` of tools/wp-import.ts is false, so this is the only call.
import { main } from './wp-import'
await main()
