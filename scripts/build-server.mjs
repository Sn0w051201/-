import {build} from 'esbuild';
await build({entryPoints:['server/standalone.ts'],outfile:'server-dist/server.mjs',bundle:true,platform:'node',target:'node22',format:'esm',logLevel:'info'});
