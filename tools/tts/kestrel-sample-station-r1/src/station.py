"""Kestrel playtest: the sample, power and habitat footprints, in table inches."""
# Objects in this dictionary keep their original mesh and all native states.
MOVES={
 'c7002b':(.0836,8.18,0), 'c7c100':(11.02,8.18,270),
 'c70030':(19.0,9.80,180), 'c70012':(19.00,18.00,0),
 'c70043':(20.55,-8.97,0), 'c70045':(15.93,-3.02,0),
 'c70044':(13.25,-1.04,0), 'c70036':(1.65,15.08,90),
 'c7003f':(4.72,-22.1,90), 'c70040':(10.72,-21.72,0),
 'c70041':(13.75,-18.68,90), 'c70042':(16.80,-21.03,90),
 'c70046':(14.4,-13.1,0), 'c70047':(22.86,17.15,90),
 'c70048':(21.95,20.72,90), 'c7004b':(12.9,18.6,90),
 'c7004c':(14.3,16.0,90), 'c70022':(3.4,2.7,90),
 'c7a200':(20.10,-3.4,180), 'c7001f':(-18.48,20.24,270)}
# Each set piece has its own job, facing and collision; none are spawn scripts.
SITES=[
 ('e51001','intake','Sample receiving | Twin-door dust lock',10.2,-11.72,0,
  'Dirty-side intake for returned core cases. Both pressure doors are retracted. State 1 lifts the insulated canopy.'),
 ('e51002','corevault','Flight stores | Sealed core transport rack',14.1,-22.15,90,
  'Sealed return canisters, lift pockets and a solid thermal screen at the edge of the landing apron.'),
 ('e51003','power','Solar field | Feeder and battery gallery',-.81,14.08,90,
  'Two battery modules share the solar field disconnect, buried feeder and service trench.'),
 ('e51004','suits','Crew quarters | EVA suit porch',16.35,18.18,90,
  'Three suitports face the crew approach. Their pressure backs, helmets and umbilicals share the habitat service wall.'),
 ('e51005','drill','Western impact crater | Core drill and winch skid',-16.40,-12.40,16,
  'The tracked survey crew parks its core barrel and winch at the rim. The drill cabinet provides solid cover.'),
 ('e51006','westshield','Cryogenics | Regolith shielding cells',-22.205,16.0,0,
  'Filled shielding cells protect the cryogenic annex and screen its outer approach.'),
 ('e51007','water','Habitat services | Water reserve',22.17,22.82,0,
  'An insulated water reserve and its valved service panel sit outside the sleeping quarters.'),
 ('e51009','passage','Crew quarters | Pressurized link to the commons',19.0,13.24,0,
  'The sleeping block opens into the crew commons through a bolted pressure passage. The west EVA hatch gives access from the yard. State 1 exposes the walking surface.'),
 ('e5100a','transfer','Sample transfer | Transit node to expedition lab',4.585,8.18,90,
  'A clean transfer passage joins the four-way node to the expedition lab. The side hatch opens toward the solar yard. State 1 removes its roof.'),
 ('e51008','northshield','Navigation | Instrument shielding cells',12.3,22.205,90,
  'These filled cells screen the navigation vault. Cable inspection and optical servicing use the sheltered side.'),
]

# Exposed lips extend four existing impact features out to the edge of this map tile.
SITES += [
 ('e51010','westlip','Western impact crater | Fractured rim',-24,-8.75,0,'An exposed spur of the western crater rim. Its solid basalt continues to the edge of the survey tile.'),
 ('e51011','eastlip','Eastern survey crater | Ejecta spur',24,1.60,180,'An irregular tongue of dark ejecta joins the eastern survey crater to the adjoining highland.'),
 ('e51012','northlip','Northern impact crater | Outer crest',-7.25,24,90,'A faulted basalt crest carries the northern crater lip off the survey tile.'),
 ('e51013','southlip','Southern impact crater | Broken basalt sill',-11.72,-24,270,'A low, fractured sill rises out of the southern micro-impact apron.')]
