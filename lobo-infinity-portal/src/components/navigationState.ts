export function navigationItemActive(to:string, pathname:string, search:string) {
  pathname=pathname.replace(/^\/(player|faction|mission|game)\//,(_,name)=>`/${name}s/`)
  const [path,query='']=to.split('?')
  const overview=/^\/event\/[^/]+$/.test(path)
  const route=pathname===path || path!=='/' && !overview && pathname.startsWith(`${path}/`)
  const actual=new URLSearchParams(search)
  return route && [...new URLSearchParams(query)].every(([key,value])=>(actual.get(key) || (key==='eventId' && ['/standings','/rules','/analytics'].includes(pathname)?'event-current-league':''))===value)
}
