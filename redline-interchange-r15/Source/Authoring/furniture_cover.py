"""Intended furniture contact positions, validated against exported colliders."""
def sites_for(w,d,role,style,upper=False):
    if upper:
        w,d,role,style=4.,4.5,'office','container'
    rows=[]
    def add(label,x,z):
        rows.append(dict(item=label,x=x,z=z))
    if style=='capsule':
        for sign in (-1,1):
            for z in (-.65,.65):add('relay bank playable face',sign*1.145,z)
    elif style=='octagon':
        for sign in (-1,1):add('dispatch desk free end',sign*1.395,-.85)
    elif style=='booth' or w<5.5:
        add('wall desk free end',-w/2+1.255,-.65)
        if style=='booth':add('security locker inward face',w/2-1.31,.15)
    elif style=='loading':
        for sign in (-1,1):add('parcel shelf free face',sign*(w/2-1.205),-.65)
    elif role in ('cafe','mess'):
        add('service counter front',-w/2+1.655,0)
        for sign in (-1,1):add('dining set outer edge',.75,sign*2.155)
    elif role=='workshop':
        for sign in (-1,1):add('workbench front',sign*(w/2-1.355),.65)
    elif role=='ticket':
        for sign in (-1,1):add('waiting bench front',sign*(w/2-1.205),.65)
    else:
        add('office desk free end',-w/2+1.305,-.55)
        if role!='signal':add('second office desk free end',w/2-1.305,.25)
    return rows
