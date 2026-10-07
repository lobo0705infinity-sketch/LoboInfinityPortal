import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import sharp from 'sharp'
const dimensions=await readFile('src/config/artworkDimensions.ts','utf8')
const imported=[...dimensions.matchAll(/import (artwork\d+) from '([^']+)'/g)].map(m=>({key:`[${m[1]}]`,source:`src/${m[2].replace('../','')}`}))
const publicFiles=[...dimensions.matchAll(/'(\/assets\/[^']+)':/g)].map(m=>({key:JSON.stringify(m[1]),source:`public${m[1]}`}))
const extra=['current-league-overview-hero.png','team-tournament-overview-hero.png','lobo-infinity-portal-hero.png','game-submission-hero.png'].map(file=>({key:JSON.stringify(`/src/assets/${file}`),source:`src/assets/${file}`}))
const extraImports=extra.map((item,index)=>`import extraArtwork${index} from '../assets/${item.source.split("/").at(-1)}'`).join("\n")
const imports=[...dimensions.matchAll(/import artwork\d+ from '[^']+'/g)].map(m=>m[0]).join('\n')+'\n'+extraImports
await mkdir('public/assets/responsive-artwork',{recursive:true})
let original=0,optimized=0;const entries=[];const cssMap={}
for(const item of [...imported,...publicFiles,...extra]){
 const bytes=await readFile(item.source),hash=createHash('sha256').update(bytes).digest('hex').slice(0,10)
 const variants=[];original+=bytes.length
 for(const width of [640,1024,1600]){
  const path=`/assets/responsive-artwork/${hash}-${width}.webp`
  const output=await sharp(bytes).resize({width,withoutEnlargement:true}).webp({quality:82,effort:5}).toBuffer()
  await writeFile(`public${path}`,output);variants.push(path);if(width===1024)optimized+=output.length
 }
 if(extra.includes(item))entries.push(`[extraArtwork${extra.indexOf(item)}]: {src:${JSON.stringify(variants[2])},compact:${JSON.stringify(variants[0])},srcSet:${JSON.stringify(variants.map((p,i)=>`${p} ${[640,1024,1600][i]}w`).join(', '))}}`)
 entries.push(`${item.key}: {src:${JSON.stringify(variants[2])},compact:${JSON.stringify(variants[0])},srcSet:${JSON.stringify(variants.map((p,i)=>`${p} ${[640,1024,1600][i]}w`).join(', '))}}`)
 if(item.source.startsWith('src/assets/'))cssMap[`../assets/${item.source.split('/').at(-1)}`]=variants[2]
}
await writeFile('src/config/responsiveArtwork.ts',`${imports}\nconst artwork:Record<string,{src:string;compact:string;srcSet:string}>={\n${entries.join(',\n')}\n}\nexport function responsiveArtwork(src:string){return artwork[src]??{src,compact:src,srcSet:undefined}}\n`)
for(const file of ['src/public/SnapshotPublicApp.css','src/pages/SubmitResult.css']){
 let css=await readFile(file,'utf8');for(const [old,path] of Object.entries(cssMap))css=css.replaceAll(old,path);await writeFile(file,css)
}
console.log(`Responsive artwork: ${entries.length} sources, 1024px bytes ${optimized} versus ${original} original`)
