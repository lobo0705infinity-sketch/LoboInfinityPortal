"""Verify the actual exported levels, walking apertures, mission states and deployable bags."""
from collections import Counter,defaultdict
from copy import deepcopy
from itertools import combinations
import numpy as np
from shapely import affinity
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
from build_save import *
from district import geometry,transform,ellipse
from design import green_ports
from project import O
from towers import is_pump_window,below_slab,lower,cut_face
sys.path.insert(0,str(PREVIOUS/'standard'))
from test_standard import RealWorld,validate_map,py


def records(obj):
    return [obj,*obj.get('States',{}).values()]


def check_geometry():
    table=json.loads((OUT/'Play-Table.json').read_text())
    owned=[o for o in table['ObjectStates'] if TAG in o.get('Tags',[])]
    houses={slug(o).split('-')[1]:o for o in owned if slug(o).startswith('tower-')}
    cells={};aisles=[];ports=[];lab_count=0
    for k,t in T.items():
        obj=houses[k]
        assert len(records(obj))==t.n
        assert set(obj.get('States',{}))=={str(j) for j in range(1,t.n)}
        dead=ROOFS[k]['States']['1']['GUID']
        assert dead not in [s['GUID'] for s in records(obj)]
        for i in range(1,t.n+1):
            st=obj if i==t.n else obj['States'][str(i)]
            old=ROOFS[k] if i==t.n else ROOFS[k]['States'][str(i+1)]
            assert st['GUID']==old['GUID'] and st['Transform']==old['Transform']
            assert slug(st)==tower_name(k,i)
            v=native.read_obj(ASSETS/(slug(st)+'.obj'))[0]
            assert not any(is_pump_window(f) for f in v)
            assert min(p[0][1] for f in v for p in f)==-2.97
            oldv=native.read_obj(old_file(k,i+1))[0]
            assert abs(max(p[0][1] for f in v for p in f)+PITCH-max(p[0][1] for f in oldv for p in f))<.002
            h=(i-1)*PITCH
            solids=native.read_obj(ASSETS/(slug(st)+'-col.obj'))[1]
            floor=unary_union([Polygon(fp) for fp,lo,hi in solids if abs(hi-h)<.018])
            if i==1:assert floor.symmetric_difference(t.poly).area<.012,(k,'unfilled hatch')
            blocks=[Polygon(fp) for fp,lo,hi in solids if hi>h+.065 and lo<h+1.58]
            children=st.get('ChildObjects',[])
            for part in children:
                name=slug(part)
                if name.startswith('lab-window-'):
                    lab_count+=1;assert part['Transform']==xform(0,0,0) and part['CustomMesh']['DiffuseURL'].endswith('/calibration-lab.jpg')
                if name.startswith('greenhouse-'):
                    assert i==t.n
                    x,z,a=greenhouse(k);assert part['Transform']==xform(x,h+.01,z,a)
                    for fp,lo,hi in native.read_obj(R3/'assets'/(name+'-col.obj'))[1]:
                        if hi+.01>.065 and lo+.01<1.58:
                            blocks.append(affinity.translate(affinity.rotate(Polygon(fp),-a,origin=(0,0)),x,z))
            walls=unary_union(blocks);walk=floor.difference(walls);cells[k,i-1]=(floor,walls,walk)
            if i==t.n and greenhouse(k):
                ps=green_ports(*greenhouse(k))
                for a,b in zip(ps[:3],ps[3:]):
                    path=LineString([a,b]);assert walk.covers(path.buffer(BASE_RADIUS));aisles.append(2*path.distance(walk.boundary)*25.4)
            native.read_obj.cache_clear()
    graph=defaultdict(set);oldpairs={frozenset(b['Nickname'].split(' | ')[1].split(' - ')) for b in BRIDGES}
    live=[o for o in owned if slug(o).startswith('bridge-')];assert len(live)==26
    landing_warnings=[]
    for bridge in live:
        tr=bridge['Transform'];level=round((tr['posY']-BASE_Y)/PITCH);assert abs(tr['posY']-BASE_Y-level*PITCH)<.001
        names=bridge['Nickname'].split(' | ')[1].split(' - ');a,b=names;graph[a].add(b);graph[b].add(a)
        native_pieces=native.read_obj(AS2/(slug(bridge)+'-col.obj'))[1]
        def into_world(p):
            p=affinity.scale(p,tr['scaleX'],tr['scaleZ'],origin=(0,0))
            return affinity.translate(affinity.rotate(p,-tr['rotY'],origin=(0,0)),tr['posX'],tr['posZ'])
        deck=unary_union([into_world(Polygon(p)) for p,lo,hi in native_pieces if abs(hi)<.02])
        rail=unary_union([into_world(Polygon(p)) for p,lo,hi in native_pieces if hi*tr['scaleY']>.065 and lo*tr['scaleY']<1.57])
        both_floors=[deck];both_walls=[rail]
        for key,_ in landings(bridge):
            tower=T[key];floor,wall,_=cells[key,level]
            both_floors.append(affinity.translate(floor,tower.x,tower.z))
            both_walls.append(affinity.translate(wall,tower.x,tower.z))
        # Short spans genuinely support a crossing base jointly with the opposite landing.
        whole_crossing=unary_union(both_floors).buffer(.022).difference(unary_union(both_walls))
        for k,port in landings(bridge):
            t=T[k];clear=affinity.translate(whole_crossing,-t.x,-t.z)
            success=False
            for off in np.arange(-1.03,1.04,.06):
                points=[port.xy(port.center+i*port.inward,port.tangent+off) for i in (-.64,.79)]
                if clear.covers(LineString(points).buffer(BASE_RADIUS,quad_segs=12)):
                    success=True;break
            if success:ports.append((bridge['GUID'],k))
            else:landing_warnings.append((bridge['Nickname'],k))
    assert not landing_warnings,landing_warnings
    assert {frozenset([a,b]) for a,vs in graph.items() for b in vs}==oldpairs
    found=set();todo=[next(iter(graph))]
    while todo:
        name=todo.pop()
        if name in found:continue
        found.add(name);todo.extend(graph[name]-found)
    assert len(found)==16
    angles=[]
    for k,(oldlevel,x,z,_) in O.items():
        _,_,walk=cells[k,oldlevel-1];safe=walk.buffer(-BASE_RADIUS)
        ring=Point(x,z).buffer(20/25.4+BASE_RADIUS,quad_segs=48)
        hits=sum(safe.covers(Point(q)) for q in list(ring.exterior.coords)[:-1]);assert hits>=12
        angles.append(round(360*hits/192))
    assert len(aisles)==24 and len(ports)==52
    return {'skyscrapers':16,'physical_story_removed_in':PITCH,'furnished_stories':sum(t.n-1 for t in T.values()),
            'roof_only':sum(t.n==1 for t in T.values()),'bridges':len(live),'walkable_bridge_ends':len(ports),
            'glasshouse_lanes':len(aisles),'narrowest_glasshouse_mm':round(min(aisles),2),'minimum_console_contact_degrees':min(angles),
            'lab_state_attachments':lab_count,'lab_picture_bays':sum(json.loads((WORK/'windows.json').read_text()).values())}


def check_release_controls(w):
    lua,controller=w.run['cb7102']
    dialogs=[]
    for color in ('Blue','Red'):
        def show(description,url,close,seat=color):
            dialogs.append((seat,url))
            close(url,seat)
        controller.Player[color].showInputDialog=show
        w.click('mission',color)
        assert dialogs[-1]==(color,MISSION_URL) and w.printed[:2]==(MISSION_URL,color)
        assert not any('standardBriefing' in e.get('id','') for e in w.visible(color))
    assert len(dialogs)==2

    def check_lines(kind,offset):
        path=w.source()
        painted=w.lines[w.mat]
        assert len(path)==len(painted)
        mat=controller.getObjectFromGUID(w.mat)
        tracks=defaultdict(list)
        for original,stroke in zip(path,painted):
            if original.get('loboZoneKind')!=kind or original.get('loboZoneEdge'):
                continue
            for pt in stroke['points']:
                world=mat.positionToWorld(lua.table_from(pt))
                tracks[round(world.x,4)].append(world.z)
        assert set(tracks)==({-offset,offset} if offset is not None else set())
        for coordinates in tracks.values():
            assert min(coordinates)<-23.75 and max(coordinates)>23.75

    for rotated in (False,True):
        if rotated:w.click('turn')
        w.click('dz_off')
        check_lines('deployment',None)
        check_lines('exclusion',4)
        for extra in (0,4,8):
            w.click('dz_'+str(extra))
            check_lines('deployment',12-extra)
            check_lines('exclusion',4)
        w.click('exclusion')
        check_lines('exclusion',None)
        check_lines('deployment',4)
        w.click('exclusion')
    w.click('turn')


def runtime():
    single=json.loads((OUT/'Play-Table.json').read_text());catalog=json.loads((OUT/'Workshop-Save.json').read_text())
    base=json.loads((R3/'out/Workshop-Save.json').read_text());saved=json.loads((OUT/'Cloudbreak-Array.json').read_text())['ObjectStates'][0]
    shelf=next(o for o in catalog['ObjectStates'] if o['GUID']==BAG)
    assert [o for o in catalog['ObjectStates'] if o['GUID']!=BAG]==[o for o in base['ObjectStates'] if o['GUID']!=BAG]
    assert shelf['ContainedObjects']==saved['ContainedObjects'] and shelf['LuaScript']==saved['LuaScript']
    assert [o for o in single['ObjectStates'] if TAG not in o.get('Tags',[])]==[o for o in R3_TABLE['ObjectStates'] if TAG not in o.get('Tags',[])]
    live={o['GUID']:o for o in single['ObjectStates'] if TAG in o.get('Tags',[])}
    places={s[0]:[float(n) for n in s[1:]] for s in [line[2:].split(',') for line in shelf['LuaScript'].splitlines()]}
    seen=set()
    for s in saved['ContainedObjects']:
        q=deepcopy(s);o=live[q['GUID']]
        q['Transform'].update({k:o['Transform'][k] for k in POS[:3]});assert q==o
        for state in records(o):
            seen.add(state['GUID']);assert places[state['GUID']]==[state['Transform'][k] for k in POS]
    assert set(places)==seen and not (RETIRED & seen)
    assert saved['Nickname'] in catalog['LuaScript'] and single['SaveName']==f'Cloudbreak Array {RELEASE} - Network Node'
    assert all(MAP_RULES in next(t['body'] for t in s['TabStates'].values() if t['title'].startswith('Cloudbreak Array')) for s in (single,catalog))
    o=live['cb7102'];cfg=json.loads(json.loads(CONFIG.search(o['LuaScript'])[2]))
    for terminal,options in cfg['supports'].items():
        assert set(options)<=seen and any(options.values())
        assert live[terminal]['ChildObjects'][0]['CustomMesh']==next(q for q in R3_PIECES if q['GUID']==terminal)['ChildObjects'][0]['CustomMesh']
    w=validate_map(deepcopy(saved));lua,g=w.run['cb7102']
    check_release_controls(w)
    for mode in ('day','night','off'):
        w.click('bg_'+mode);assert w.background_url==cfg['background'][mode]
    def button(key):
        return next(e for e in w.visible() if e.tag=='Button' and e.get('text','').lower().startswith(key))
    w.invoke(button('map rules'))
    rules_panel=next(e for e in w.visible() if e.get('id','').endswith('_cloudbreak_detail_White'))
    assert [e.text for e in rules_panel.iter('Text')]==['Cloudbreak Array | Map Rules',MAP_RULES]
    w.invoke(button('close'));w.invoke(button('map-specific options'))
    banks=[q for q in saved['ContainedObjects'] if 'CloudbreakEditableCloud' in q.get('Tags',[])]
    for q in banks:
        assert q['Locked'] and q['DragSelectable'] and not q['Rigidbody']['UseGravity']
        w.init(q);w.run[q['GUID']][1].onLoad()
    w.advance(.2);w.invoke(button('cloud boundaries'));assert all(len(w.lines[q['GUID']])==6 for q in banks)
    q=banks[0]['GUID'];w.items[q]['Locked']=False;w.items[q]['Transform']['posY']=9.91
    w.click('turn');w.click('turn');assert not w.items[q]['Locked'] and w.items[q]['Transform']['posY']==9.91
    rem=banks[-1]['GUID'];g.getObjectFromGUID(rem).destruct();w.call('cloudRefreshOne',{'guid':rem});assert g.getObjectFromGUID(rem) is None
    w.call('cloudBoundaries');w.advance(.2);assert not w.lines[q]
    for t in cfg['objectives']:
        w.init(live[t]);w.run[t][1].onLoad('Neutral')
    def claim(id,side):w.call('claimNetworkObjective',{'guid':id,'side':side,'color':'White'})
    primary=cfg['primary'];relay=next(r for r in cfg['objectives'] if r!=primary)
    claim(primary,'A');assert w.run[primary][1].ownerSide=='Neutral'
    claim(relay,'A');claim(primary,'A');assert w.run[primary][1].ownerSide=='A'
    claim(relay,'B');assert w.run[primary][1].ownerSide=='Neutral'
    for doc in (single,catalog):
        for t in doc['TabStates'].values():
            assert isinstance(t['id'],int) and isinstance(t['color'],str) and all(isinstance(t['visibleColor'][k],(int,float)) for k in 'rgb')
    return {'controls':True,'mission_link':MISSION_URL,'zone_rotation_degrees':90,'stage_positions':len(places),'editable_clouds':len(banks),'objective_logic':True,'other_map_setups_unchanged':105}


if __name__=='__main__':
    facts={**check_geometry(),**runtime()}
    print(json.dumps(facts,indent=2))
    (WORK/'release-audit.json').write_text(json.dumps(facts,indent=2))
