// Development-only schema pinning. This never contacts a server or registers tools.
// node qhooks-pin.mjs --check <definitions.ts> --catalog <tools-list.json> --names <reviewed-tool-names.json>
// node qhooks-pin.mjs --write <definitions.ts> --catalog <tools-list.json> --names <reviewed-tool-names.json>
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const args=process.argv.slice(2),mode=args[0],target=args[1];
const option=name=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw Error('Supply '+name);return args[i+1];};
if(!['--check','--write'].includes(mode)||!target)throw Error('Use --check or --write, a definitions path, --catalog and --names.');
const bytes=await readFile(option('--catalog'),'utf8'),catalog=JSON.parse(bytes),names=JSON.parse(await readFile(option('--names'),'utf8'));
if(!Array.isArray(catalog.tools)||!Array.isArray(names))throw Error('Expected tools/list result and explicitly reviewed names.');
assert.equal(new Set(names).size,names.length,'Duplicate reviewed names');
try { assert.deepEqual(catalog.tools.map(t=>t.name),names); } catch { throw Error('Catalog names changed: review the static allowlist before updating.'); }
for(const t of catalog.tools){
 assert.equal(t.title,t.annotations?.title,t.name+' title');
 assert.equal(t.inputSchema?.type,'object',t.name+' schema');
 for(const flag of ['readOnlyHint','destructiveHint','idempotentHint','openWorldHint'])assert.equal(typeof t.annotations[flag],'boolean',t.name+' '+flag);
 assert.equal(t.annotations.destructiveHint,false,t.name+' destructive hint');
}
if(mode==='--write'){
 const old=await readFile(target,'utf8').catch(()=>''),license=old.startsWith('// SPDX-License-Identifier: Apache-2.0')?'// SPDX-License-Identifier: Apache-2.0\n':'';
 const hash=createHash('sha256').update(bytes).digest('hex');
 await writeFile(target,license+'// Generated from the reviewed 31-tool QHooks server catalog; static schemas, no runtime registration.\n// Catalog SHA256: '+hash+'\nexport const DEFINITIONS = '+JSON.stringify(catalog.tools,null,2)+' as const;\nexport type ToolName = (typeof DEFINITIONS)[number]["name"];\n');
}else{
 const source=await readFile(target,'utf8');
 const match=source.match(/export\s+const\s+DEFINITIONS\s*=([\s\S]*?)\s+as\s+const\s*;/);
 if(!match)throw Error('Expected the static DEFINITIONS literal.');
 // Evaluate only the owned literal from the generated source, with no imports,
 // wallet, process or transport objects. This is a build check, not a security sandbox.
 const actual=vm.runInNewContext('('+match[1]+')',Object.create(null),{timeout:1000});
 try { assert.deepEqual(JSON.parse(JSON.stringify(actual)),catalog.tools); } catch { throw Error('Tool metadata/schema drift; explicitly review and regenerate.'); }
}
console.log('QHooks static catalog parity: '+names.length+' tools');
