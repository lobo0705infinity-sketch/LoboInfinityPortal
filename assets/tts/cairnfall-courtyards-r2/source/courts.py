"""Positions measured on the deployed Battleground map, in inches. New terrain uses one locked object per site."""
# Slug, label, description, world X/Z, rotation about Y.
SITES=[
 ('laundry-yard','Copper Laundry | Drying court','Linen dries between the washhouse and its stone windbreak. A wringer sits beside the tub.',(-14.50,.25),0.),
 ('refectory-stores','Long Refectory | Kitchen deliveries','A roofed flour store and bread handcart serve the kitchen. The receiving entrance opens onto the kitchen yard.',(-13.24,-8.87),0.),
 ('archive-receiving','Stepped Archive | Bindery receiving bay','A masoned book-return counter, travelling book chest and cloth-bound volumes stand beside the approach to the Archive stairs.',(-8.26,9.70),0.),
 ('potting-yard','Gardeners Workshop | Potting yard','A potting bench, cold frame and rain barrel flank the workshop path. The limewashed wall shelters the seedlings.',(-2.10,-13.02),-18.),
 ('pilgrim-shrine','Listening Rooms | Wayside shrine','An arched lamp niche gives pilgrims a sheltered stop on the walk between the listening rooms.',(7.79,-17.06),12.),
 ('header-cistern','Solar Pump House | Header cistern','The riveted header tank shares a pipe and valve with the pump-house service court.',(3.10,19.30),0.),
 ('gate-porters','East Gate Lodge | Porters’ luggage stand','The porters keep visiting pilgrims’ trunks on raised racks inside this sheltered baggage court.',(20.13,9.91),-4.),
 ('dispensary-nursery','North Dispensary | Propagation beds','The walled propagation beds supply the dispensary. Clay pots and a potting trough stand beneath a timber wind screen.',(-9.47,16.94),4.),
 ('fuel-store','Laundry and Refectory | Boiler wood store','Split wood is stacked under a slate lean-to beside the service lane shared by the laundry and kitchen.',(-21.68,-5.28),0.),
 ('clinic-rest','Apse Field Clinic | Ambulant patients’ rest','A solid windbreak and timber bench shelter patients on the approach to the clinic. The bronze cross faces the path.',(11.50,-3.0),60.),
 ('pump-filters','Solar Pump House | Irrigation filter court','Two screened filters and a pipe run feed the adjacent herb beds. Service covers face the groundskeepers’ path.',(9.55,14.18),-90.)
]
# Individual public paths stay within the operating areas instead of crossing the original cloister walkway.
SERVICE=[
 [(-18.8,-3.7),(-18.55,-4.72),(-17.3,-5.50),(-15.30,-5.78),(-13.94,-6.48),(-12.55,-6.5),(-11.2,-6.33)],
 [(-18.0,-17.95),(-17.68,-19.0),(-15.54,-18.75),(-14.12,-17.36),(-13.96,-13.7),(-14.05,-11.64),(-13.66,-10.93)],
 [(-16.4,2.8),(-14.65,3.40),(-13.,3.30),(-12.92,1.3),(-13.0,-1.9),(-12.38,-3.52),(-11.5,-4.36)],
 [(-12.80,10.7),(-11.52,10.75),(-10.52,11.55),(-9.55,12.74),(-8.10,12.84),(-6.72,12.61),(-5.54,12.21),(-2.25,12.12)],
 [(-9.55,12.74),(-9.54,13.5),(-10.04,14.61),(-10.36,15.73)],
 [(-5.75,-10.86),(-4.83,-11.64),(-3.42,-11.86),(-1.47,-11.56),(.23,-12.64),(1.42,-14.14),(2.22,-15.05),(4.59,-15.57),(6.18,-15.92),(7.8,-15.94)],
 [(1.42,-14.14),(.86,-15.64),(-.08,-16.51)],
 [(4.63,17.02),(4.18,16.09),(3.20,16.12),(2.65,16.99)],
 [(18.32,12.02),(18.62,11.45),(19.31,11.38),(20.03,11.5)]
]

# Refit the existing ground planter and walls to the new courtyards, including both tree states.
REFIT={
 12:(-11.96,4.,-11.99,90.,'Refectory receiving yard | Stone return'),
 24:(20.84,4.,-18.50,0.,'Listening Room | Rear garden wall'),
 31:(-8.82,4.,15.10,0.,'North Dispensary | Companion herb bed'),
 32:(20.30,4.,7.97,-4.,'East Gate Lodge | Baggage-court border'),
 37:(.67,4.,-13.2,0.,None),
 38:(.60,4.,16.65,0.,None),
}
