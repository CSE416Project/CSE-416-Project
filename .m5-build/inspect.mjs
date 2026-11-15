import fs from 'node:fs/promises';
import {PresentationFile,FileBlob} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('/Users/eva/Downloads/m2 pres.pptx'));
console.log((await p.inspect({kind:'layout',maxChars:3000})).ndjson);
for(let i=0;i<p.slides.items.length;i++) await fs.writeFile(`.m5-build/source-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
await fs.writeFile('.m5-build/source.webp',new Uint8Array(await (await p.export({format:'webp',montage:true})).arrayBuffer()));
console.log(JSON.stringify(p.slides.items.slice(0,3).map(s=>s.shapes.items.map(x=>({id:x.id,text:x.text.toString(),position:x.position,style:x.text.style})))));
