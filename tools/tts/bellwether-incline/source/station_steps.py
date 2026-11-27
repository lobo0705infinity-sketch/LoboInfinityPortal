"""Individual granite stair flights with a closed, stepped physics surface."""
from mesh import Pair
from hillside import BASE, LEVELS, STAIR_LENGTH, STAIR_WIDTH, TREAD, closed_profile

def stair_flight(level):
    low, high = LEVELS[level:level+2]
    rise = (high-low)/16
    left = -STAIR_LENGTH/2
    intervals = []
    for step in range(1,17):
        right = left + TREAD + (1.25 if step==8 else 0)
        intervals.append((left, right, low+step*rise))
        left = right
    flight = Pair('passenger-stair-'+('lower','middle','summit')[level])
    half_width = STAIR_WIDTH/2
    # Each riser has only an exposed face. Adjacent treads share their edges.
    previous = BASE
    for left,right,top in intervals:
        flight.m.quad([(left,top,-half_width),(left,top,half_width),
                       (right,top,half_width),(right,top,-half_width)],'concrete')
        flight.m.quad([(left,previous,-half_width),(left,previous,half_width),
                       (left,top,half_width),(left,top,-half_width)],'ashlar')
        for side in (-1,1):
            z=half_width*side
            wall=[(left,BASE,z),(right,BASE,z),(right,top,z),(left,top,z)]
            flight.m.quad(wall if side==1 else wall[::-1],'ashlar')
        previous=top
    a,b=intervals[0][0],intervals[-1][1]
    flight.m.quad([(b,BASE,half_width),(b,BASE,-half_width),
                   (b,high,-half_width),(b,high,half_width)],'ashlar')
    flight.m.quad([(a,BASE,-half_width),(b,BASE,-half_width),
                   (b,BASE,half_width),(a,BASE,half_width)],'ashlar')

    # Extrude the complete section for a watertight 132-triangle collision mesh.
    polygon=[(a,BASE),(b,BASE),(b,high)]
    for index in range(15,-1,-1):
        left,_,height=intervals[index]
        polygon.append((left,height))
        if index:polygon.append((left,intervals[index-1][2]))
    closed_profile(flight.c,polygon,-half_width,half_width)

    for side in (-1,1):
        z=side*(half_width-.06)
        points=[(a+.11,low+rise+.74,z),(a+8*TREAD-.03,low+8*rise+.74,z),
                (a+8*TREAD+1.28,low+8*rise+.74,z),(b-.10,high+.74,z)]
        for x,y,z in points:
            flight.cyl((x,y-.76,z),(x,y,z),.039,'darkiron',8)
        for start,end in zip(points,points[1:]):
            flight.beam(start,end,.071,.070,'darkiron')
    return flight
