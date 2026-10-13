export type ActivityGame = {id:string;turn:number;date:string;location:string;mission:string;playerA:{name:string;faction:string};playerB:{name:string;faction:string};opA:number;opB:number;tpA:number;tpB:number}
export type Activity = {turn:number;totals:Array<{location:string;faction:string;tp:number;op:number}>;games:ActivityGame[]}
export function locationActivity(activity:Activity,location:string):{games:ActivityGame[];rows:Activity['totals'];leaders:string[];count:number}
