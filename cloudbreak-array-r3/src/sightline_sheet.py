"""Annotate two measured sightlines on the orthographic map and pair them with camera views."""
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import LineString

from district import OUT3, WORK3, ellipse, json, slug
from sightlines import mesh_ray

WIDTH, HEIGHT = 1720, 1180
PLAN_X, PLAN_Y, PLAN_SIZE = 34, 120, 980
TEXT = '#eaf0ed'
MUTED = '#b1c1c5'
INK = '#13232a'
ACCENTS = ['#ffc878', '#78ecdf']
FONT = Path('/usr/share/fonts/truetype/open-sans')


@lru_cache(None)
def font(size, strong=False):
    face = 'OpenSans-Semibold.ttf' if strong else 'OpenSans-Regular.ttf'
    return ImageFont.truetype(str(FONT / face), size)


def project(p):
    # The square map render is 52 inches wide, centered on the mat, with +Z up.
    return np.array([PLAN_X + PLAN_SIZE * (.5 + p[0] / 52),
                     PLAN_Y + PLAN_SIZE * (.5 - p[2] / 52)])


def entry_point(example, pieces, airspace):
    start = np.array(example['a'])
    end = np.array(example['b'])
    if example['kind'] == 'cloud':
        bank = next(c for c in airspace['high'] if c['name'] == example['obstacle'])
        section = LineString([start[[0, 2]], end[[0, 2]]]).intersection(ellipse(bank))
        coords = list(section.coords)
        point = min(coords, key=lambda p: np.linalg.norm(np.array(p) - start[[0, 2]]))
        return np.array([point[0], start[1], point[1]])
    obj = next(o for o in pieces if o.get('Nickname', '').split(' |')[0] == example['obstacle'])
    ray = mesh_ray(((slug(obj), tuple(obj['Transform'].items())),))
    hits, _, _ = ray.intersects_location([start], [(end-start)/np.linalg.norm(end-start)], multiple_hits=False)
    assert len(hits) == 1
    return hits[0]


def stroke(draw, a, b, color, dashed=False):
    vector = b - a
    distance = np.linalg.norm(vector)
    ranges = [(0, distance)]
    if dashed:
        ranges = [(i, min(i+9, distance)) for i in range(0, int(distance), 19)]
    for begin, stop in ranges:
        segment = [tuple(a+vector*begin/distance), tuple(a+vector*stop/distance)]
        draw.line(segment, fill=INK, width=8 if not dashed else 6)
        draw.line(segment, fill=color, width=4 if not dashed else 3)


def circle(draw, p, radius, fill, outline, width=2):
    x, y = p
    draw.ellipse((x-radius,y-radius,x+radius,y+radius), fill=fill, outline=outline, width=width)


def draw_sheet():
    page = Image.new('RGB', (WIDTH, HEIGHT), '#15252d')
    d = ImageDraw.Draw(page)
    audit = json.loads((WORK3/'los-audit.json').read_text())
    table = json.loads((OUT3/'Play-Table.json').read_text())['ObjectStates']
    airspace = json.loads((WORK3/'airspace.json').read_text())
    d.text((34,19), 'Rooftop sightlines', font=font(48,True), fill=TEXT)
    d.text((37,80), 'Cloudbreak Array  /  Harmony City  /  Network Node', font=font(21), fill=MUTED)
    d.text((WIDTH-36,78), 'View from a standing S2 silhouette', font=font(21), fill=MUTED, anchor='ra')
    plan = Image.open(WORK3/'plan.png').convert('RGB').resize((PLAN_SIZE,PLAN_SIZE),Image.Resampling.LANCZOS)
    page.paste(plan,(PLAN_X,PLAN_Y))
    d.rectangle((PLAN_X,PLAN_Y,PLAN_X+PLAN_SIZE,PLAN_Y+PLAN_SIZE),outline='#4a6068',width=2)
    for i, e in enumerate(audit['examples'][:2]):
        a, b, stop = project(e['a']), project(e['b']), project(entry_point(e, table, airspace))
        color = ACCENTS[i]
        stroke(d,stop,b,color,True)
        stroke(d,a,stop,color)
        circle(d, a, 16, INK, color, 3)
        d.text(tuple(a),str(i+1),anchor='mm',font=font(18,True),fill=color,stroke_width=0)
        circle(d,b,7,INK,color,2)
        circle(d,stop,10,INK,color,3)
        d.line((stop[0]-4,stop[1]-4,stop[0]+4,stop[1]+4),fill=color,width=2)
        d.line((stop[0]-4,stop[1]+4,stop[0]+4,stop[1]-4),fill=color,width=2)
        y = PLAN_Y + i*493
        x = 1040
        d.text((x,y-2), str(i+1)+'   '+e['obstacle'], font=font(31,True),fill=color)
        d.text((x+1,y+49),e['start']+' to '+e['end'],font=font(24),fill=TEXT)
        photo = Image.open(WORK3/f'eye{i}.png').convert('RGB')
        photo.thumbnail((644,345),Image.Resampling.LANCZOS)
        page.paste(photo,(x,y+96))
        d.rectangle((x,y+96,x+photo.width-1,y+96+photo.height-1),outline='#52676e',width=1)
        d.text((x,y+438),f'{e["distance"]:.1f}″ rooftop to rooftop',font=font(20),fill=MUTED)
    d.text((PLAN_X,1120),'Solid line to the obstruction. Dashes continue to the target.',font=font(21),fill=TEXT)
    d.text((WIDTH-36,1120),'112 of 219 previously clear test lines between the tallest roofs now blocked.',font=font(19),fill=MUTED,anchor='ra')
    page.save(OUT3/'Cloudbreak-Array-R3-Sightlines.jpg',quality=94,subsampling=0)


if __name__ == '__main__':
    draw_sheet()
