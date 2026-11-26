"""Build both Stage bags and the deployed room directly from the Courtyards R2 save."""
from datetime import datetime
import json
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
ORIGINAL='/cairnfall-sanctuary-r3-access-fix/Assets/workshop-'
BASE_URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
PREFIX='assets/tts/cairnfall-workshop-roof-r3/'
TITLE='Cairnfall Sanctuary - Courtyards R3 - Battleground - Play Table'
FILES=('Cairnfall-Sanctuary.json','Cairnfall-Top40-Losers-R4.json','Play-Table.json')


def objects(items):
    for item in items:
        yield item
        yield from objects(item.get('ContainedObjects',()))
        yield from objects(item.get('States',{}).values())


def build(sha):
    if not re.fullmatch(r'[0-9a-f]{40}',sha):
        raise ValueError('Expected the complete immutable asset commit')
    when=datetime.now(ZoneInfo('America/New_York'))
    for name in FILES:
        doc=json.loads((ROOT/'base'/name).read_bytes())
        changed=[]
        for obj in objects(doc['ObjectStates']):
            if 'Courtyards R2' in obj.get('Description',''):
                obj['Description']=obj['Description'].replace('Courtyards R2','Courtyards R3')
            m=obj.get('CustomMesh',{})
            if ORIGINAL not in m.get('MeshURL',''):
                continue
            roof='workshop-roof.obj' in m['MeshURL']
            for field in ('MeshURL','ColliderURL'):
                filename=m[field].rsplit('/',1)[1]
                assert ORIGINAL in m[field] and (ROOT/'assets'/filename).is_file()
                m[field]=BASE_URL+sha+'/'+PREFIX+filename
            if roof:
                obj['Description']=re.sub(r'(Height \(base to top\): )[\d.]+',r'\g<1>3.90',obj['Description'])
            obj['Description']=obj['Description'].replace('Ladders remain with their building.','The exterior ladder serves the flat copper roof through the opening in the stone parapet.')
            changed.append(roof)
        assert sorted(changed)==[False,True],(name,changed)
        if name=='Play-Table.json':
            doc['SaveName']=TITLE
        doc.update(EpochTime=int(when.timestamp()),Date=when.strftime('%m/%d/%Y %I:%M:%S %p'))
        (ROOT/'release'/name).write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':')))

if __name__=='__main__':
    build(sys.argv[1])
