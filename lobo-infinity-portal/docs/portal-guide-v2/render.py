"""Rebuild the tour with current screenshots and the original Bradley recording.

Requires Python/Pillow and FFmpeg. No speech synthesis or paid service is used.
Browser captures are kept beside this script under captures/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, re, subprocess, textwrap

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CAP = HERE / 'captures'
FRAMES = HERE / 'frames-final'
ASSETS = ROOT / 'public/assets/portal-guide'
FRAMES.mkdir(exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(size, bold=False): return ImageFont.truetype(BOLD if bold else FONT, size)
BG, PANEL, CYAN, WHITE, SOFT, GOLD = '#07111a', '#102330', '#77dcec', '#f2f6fa', '#c1d1db', '#f1cb70'

def lines(draw, text, xy, size, width, color=WHITE, bold=False, leading=1.35):
    x,y=xy; f=font(size,bold); buf=''
    for word in text.split():
        candidate=(buf+' '+word).strip()
        if draw.textlength(candidate,font=f)>width and buf:
            draw.text((x,y),buf,font=f,fill=color); y+=size*leading; buf=word
        else: buf=candidate
    if buf: draw.text((x,y),buf,font=f,fill=color); y+=size*leading
    return y

def slide(id,title,bullets,capture=None,highlight=None,onscreen=False):
    im=Image.new('RGB',(1920,1080),BG); d=ImageDraw.Draw(im)
    d.text((32,22),'LOBO INFINITY PORTAL / PLAYER WALKTHROUGH',font=font(26,True),fill=CYAN)
    d.text((1640,23),'OCTOBER 2026',font=font(23,True),fill=SOFT)
    d.rounded_rectangle((1452,78,1892,1018),radius=22,fill=PANEL,outline='#375467',width=2)
    d.text((1480,113),'ON-SCREEN GUIDE' if onscreen else 'PLAYER GUIDE',font=font(24,True),fill=CYAN)
    y=lines(d,title,(1480,178),39,382,bold=True)
    y+=34
    for label,body in bullets:
        y=lines(d,label,(1480,y),25,382,color=GOLD,bold=True)+14
        if body: y=lines(d,body,(1480,y),29,382,color=SOFT)+28
    if onscreen: d.text((1480,953),'Read these steps · then continue',font=font(20),fill=CYAN)
    else: d.text((1480,953),'PORTAL TOUR · OCT 2026',font=font(20),fill=SOFT)
    if capture:
        shot=Image.open(CAP/capture).convert('RGB')
        if highlight:
            sd=ImageDraw.Draw(shot); sd.rounded_rectangle(highlight,radius=9,outline='#f1cb70',width=4)
        shot.thumbnail((1396,952),Image.Resampling.LANCZOS)
        im.paste(shot,(30+(1396-shot.width)//2,78+(952-shot.height)//2))
    else:
        # Instruction diagram, rather than a simulated portal screenshot.
        d.rounded_rectangle((110,135,1310,945),radius=28,fill=PANEL,outline='#375467',width=3)
        d.text((170,183),'ON YOUR PHONE',font=font(32,True),fill=CYAN)
        steps=[('1','Open Army Lists','Use the faction and mission filters.'),
               ('2','Tap Copy Army Code','The list code is copied to your clipboard.'),
               ('3','Import into Infinity Army','Paste the copied code into the import tool.')]
        yy=300
        for n,head,body in steps:
            d.ellipse((172,yy,247,yy+75),fill='#245066')
            d.text((197,yy+15),n,font=font(34,True),fill=WHITE)
            d.text((280,yy),head,font=font(40,True),fill=WHITE)
            lines(d,body,(280,yy+67),30,890,color=SOFT); yy+=190
    im.save(FRAMES/(id+'.jpg'),quality=92)
    return str(FRAMES/(id+'.jpg'))

old=json.loads((HERE/'source-scenes.json').read_text())['scenes']
original=sorted([s for s in old if 'originalStart' in s],key=lambda s:s['originalStart'])
notes={
 'welcome':('Welcome to the portal',[('Your next game','Find a game, prepare, play, and submit the result.')],'dashboard.jpg'),
 'dashboard':('Start on the dashboard',[('Choose your first move','Army Intelligence, a battle report, or events.'),('Public browsing','Open to everyone.')],'dashboard.jpg'),
 'events':('Find your next game',[('Open All Events','Check registration for your competition.'),('Casual play','Use the Game Network or Discord.')],'events.jpg'),
 'standings':('Follow your event',[('Event selector','Choose the competition in the sidebar.'),('Standings','Choose your division to see recorded scores.')],'standings.jpg'),
 'mission-map':('Prepare for the game',[('Mission & Map','Check the current period and assigned maps.'),('View Mission','Open the scenario on Infinity Geist.')],'mission-map.jpg'),
 'tts-maps':('Choose your table',[('TTS Map Library','Search by name or mission setup.'),('Ratings & events','Sort by highest rated and check the collection.')],'tts-maps.jpg'),
 'table-details':('Inspect the terrain',[('Two views','Overhead for the layout; angled for heights and cover.'),('Workshop bag','Match the bag name shown on the page.')],'table-details.jpg'),
 'submit-game':('Record your result',[('Choose the correct form','League, Team Tournament, Casual, or Top 40.'),('Before submitting','Check the scores with your opponent.')],'submit-game.jpg'),
 'battle-reports':('Browse recorded games',[('Battle Reports','Players, mission, and scores in each row.'),('Open the report','Select the game number.')],'battle-reports.jpg'),
 'report-details':('Read the full report',[('OP · TP · VP','Objective, tournament, and victory points.'),('Recorded facts','Use results and player notes. Battle stories are fictionalized.')],'report-details.jpg'),
 'army-intelligence':('Explore an army',[('Select a faction','Choose an army or try Corregidor.'),('Army Intelligence','Submitted lists, common profiles, and battlefield roles.')],'army-intelligence.jpg'),
 'rankings':('Compare combat profiles',[('Weapon & combat state','Check the exact profile and linked status.'),('Rating vs popularity','Combat performance and submitted-list use are different measures.')],'rankings.jpg'),
 'factions':('Explore factions',[('Open an army card','Browse recorded results and reports.'),('Check the game count','These are games submitted to the portal.')],'factions.jpg'),
 'players':('Meet the community',[('Player directory','Filter by event or choose All Events.'),('Open a profile','Scroll to Game History for recorded games.')],'players.jpg'),
 'missions':('Explore missions',[('Choose an event','Or browse all recorded missions.'),('Mission analysis','Read game counts alongside percentages.')],'missions.jpg'),
 'little-helper':("Lobo’s Little Helper",[('Start with /help','Open the private command guide in Discord.'),('List & combat tools','Analyse a roster, compare profiles, or find counters.'),('Find a game','Use /play for availability and game requests.')],'little-helper.jpg'),
 'next-move':('Ready for your next game',[('Find an opponent','Check the mission and map.'),('Play & submit','Return for reports and inspiration.')],'dashboard.jpg')}
updates={
20.834:[('navigation','Navigation & artwork',16,[('Find your way back','Use the links above the page.'),('Artwork control','Switch between full and compact artwork.')],'desktop.jpg',None)],
127.929:[
 ('known-lists','Known Army Lists',10,[('From Army Intelligence','Select Known Army Lists.'),('Faction already selected','Arrive on Army Lists with your army filter set.')],'known-lists.jpg',(270,75,470,260)),
 ('army-lists','Army Lists on desktop',10,[('View List','Opens the roster in Corvus Belli Infinity Army.'),('Find a list','Search, filter by faction or mission, and sort headings.')],'desktop.jpg',(1158,552,1255,615)),
 ('mobile-lists','Army Lists on mobile',15,[('Copy Army Code','Tap to copy, then paste into Infinity Army’s import tool.'),('Same faction filter','Known Army Lists keeps your selected army.')],None,None)],
142.849:[('rank-comparisons','Global & in-faction ranks',12,[('Global rank','Compares profiles across all armies.'),('In-faction rank','Compares profiles within the selected army.'),('Compare like with like','Match the weapon and combat state.')],'rankings.jpg',(284,231,377,503))]}

timeline=[]; output=0.0
for i,s in enumerate(original):
    start=s['originalStart']; end=original[i+1]['originalStart'] if i+1<len(original) else 237.5
    for uid,title,dur,bullets,cap,hi in updates.get(start,[]):
        path=slide(uid,title,bullets,cap,hi,True)
        timeline.append(dict(id=uid,title=title,start=round(output,3),duration=dur,frame=path,onscreen=True,text=' '.join(a+'. '+b for a,b in bullets)))
        output+=dur
    title,bullets,cap=notes[s['id']]; path=slide(s['id'],title,bullets,cap)
    timeline.append(dict(id=s['id'],title=s['title'],start=round(output,3),duration=round(end-start,3),frame=path,originalStart=start,onscreen=False))
    output+=end-start

def stamp(t):
    ms=round(t*1000); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); sec,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{sec:02}.{ms:03}'
def parse(t):
    h,m,s=t.split(':'); return int(h)*3600+int(m)*60+float(s)
def shift(t,end=False):
    return t+sum(sum(x[2] for x in scenes) for when,scenes in updates.items() if t>when+1e-6 or (not end and abs(t-when)<1e-6))
captions=[]
for block in (ASSETS/'captions-v1.vtt').read_text().strip().split('\n\n')[1:]:
    a,b=block.split('\n',1); st,en=a.split(' --> ')
    captions.append((shift(parse(st)),shift(parse(en),True),b))
for s in timeline:
    if s['onscreen']:
        text=s['text']
        # Navigation uses two demonstrated artwork states, with the same readable steps.
        captions.append((s['start'],s['start']+s['duration'],'[On-screen guide]\n'+'\n'.join(textwrap.wrap(text,58))))
captions.sort()
(ASSETS/'captions-v2.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(stamp(a)+' --> '+stamp(b)+'\n'+c for a,b,c in captions)+'\n')
(ASSETS/'chapters-v2.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(stamp(s['start'])+' --> '+stamp(s['start']+s['duration'])+'\n'+s['title'] for s in timeline)+'\n')
chapters=[{k:s[k] for k in ('id','title','start')} for s in timeline]
(ROOT/'src/pages/portalGuideChapters.ts').write_text('export const portalGuideChapters = '+json.dumps(chapters,indent=2,ensure_ascii=False)+' as const\n')
(HERE/'storyboard.json').write_text(json.dumps({'version':2,'duration':round(output,3),'narration':'Original Bradley recording; added guides have on-screen text only','scenes':[{**s,'frame':str(Path(s['frame']).relative_to(HERE))} for s in timeline]},indent=2,ensure_ascii=False)+'\n')
Image.open(FRAMES/'welcome.jpg').resize((1280,720),Image.Resampling.LANCZOS).save(ASSETS/'poster-v2.jpg',quality=88)
# Split selected demonstrations into two views without touching the audio timeline.
nav_full=slide('navigation-full','Navigation & artwork',[('Show full artwork','Expand the page illustration.'),('Use compact artwork','Bring the page controls back into view.')],'artwork-expanded.jpg',onscreen=True)
segments=[]
for s in timeline:
    if s['id']=='navigation': segments.extend([(s['frame'],8),(nav_full,8)])
    elif s['id']=='little-helper':
        command=slide('helper-commands',"Lobo’s Little Helper",[('/list analyse','Roster, legality, ratings, and 2D TTS export.'),('/combat matchup','Compare two profiles.'),('/combat counters','Find a reactive answer.')],'helper-commands.jpg')
        segments.extend([(s['frame'],12),(command,s['duration']-12)])
    else: segments.append((s['frame'],s['duration']))
concat=HERE/'frames.ffconcat'
concat.write_text('ffconcat version 1.0\n'+''.join(f"file '{path}'\nduration {dur:.3f}\n" for path,dur in segments)+f"file '{segments[-1][0]}'\n")
audio='[1:a]asplit=4[a0][a1][a2][a3];'+\
'[a0]atrim=start=0:end=20.834,asetpts=PTS-STARTPTS[p0];'+\
'[a1]atrim=start=20.834:end=127.929,asetpts=PTS-STARTPTS[p1];'+\
'[a2]atrim=start=127.929:end=142.849,asetpts=PTS-STARTPTS[p2];'+\
'[a3]atrim=start=142.849:end=237.5,asetpts=PTS-STARTPTS[p3];'+\
'anullsrc=r=44100:cl=mono,atrim=duration=16[z0];'+\
'anullsrc=r=44100:cl=mono,atrim=duration=35[z1];'+\
'anullsrc=r=44100:cl=mono,atrim=duration=12[z2];'+\
'[p0][z0][p1][z1][p2][z2][p3]concat=n=7:v=0:a=1[a]'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-safe','0','-i',str(concat),'-i',str(ASSETS/'walkthrough-bradley-v1.mp4'),'-filter_complex',audio,'-map','0:v','-map','[a]','-t',str(output),'-r','12','-c:v','libx264','-preset','fast','-tune','stillimage','-crf','24','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',str(ASSETS/'walkthrough-bradley-v2.mp4')],check=True)
print(json.dumps({'duration':output,'chapters':len(timeline),'bytes':(ASSETS/'walkthrough-bradley-v2.mp4').stat().st_size}))
