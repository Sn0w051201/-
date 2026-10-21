import { build } from 'esbuild';
await build({entryPoints:['server/index.ts'],outfile:'cloudfunctions/api/index.js',bundle:true,platform:'node',target:'node20',format:'cjs',external:['@cloudbase/node-sdk'],logLevel:'info'});
