import { parseCanonicalStreamDate } from './streamOrdering.ts'
import type { PublicGame } from './snapshotTypes'
type Stream={date:string;division:string;mission:string;player1:string;player2:string;title:string;youtubeUrl:string}
function day(value:string){const timestamp=parseCanonicalStreamDate(value);return timestamp===null?'':new Date(timestamp).toISOString().slice(0,10)}
export function presentStream<T extends Stream>(stream:T,games:PublicGame[]):T{
 const division=stream.division.replace(/^proving\s+grounds?\b/i,'Proving Grounds')
 const same=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase()
 const matches=games.filter(g=>day(g.date)&&day(g.date)===day(stream.date)&&((same(stream.player1,g.player1)||same(stream.player1,g.player1DisplayName))&&(same(stream.player2,g.player2)||same(stream.player2,g.player2DisplayName))||(same(stream.player2,g.player1)||same(stream.player2,g.player1DisplayName))&&(same(stream.player1,g.player2)||same(stream.player1,g.player2DisplayName))))
 if(matches.length!==1)return {...stream,division}
 const game=matches[0];return {...stream,division,mission:game.mission,title:game.player1Faction&&game.player2Faction?`${game.player1Faction} vs ${game.player2Faction} · ${game.mission}`:stream.title}
}
