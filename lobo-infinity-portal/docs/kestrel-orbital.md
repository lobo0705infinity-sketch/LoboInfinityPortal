# Kestrel Lunar Base — Data Harvest

R12 replaces the crater's dark outline and stretched terrain photograph with
one fine lunar-dust material across the ground, bowls, lips and ridges.
Dominant-plane projection keeps grain density consistent on steep faces;
all UVs remain inside the texture atlas. Identical normals are deduplicated
so every imported terrain mesh remains below 25,000 vertices.

Crater rims now have irregular radial profiles, varying crest heights,
worn breaches and softly blended ejecta aprons. Their floors remain below
grade. The sixteen terrain sections partition the surface without overlays;
render and collision geometry agree.

All twenty buildings, thirteen glass domes, eighteen higher ridge systems,
six-array solar field, grouped equipment, interiors, controls, objectives,
deployment records and backgrounds are preserved. Full collection updates
patch only terrain fields in Kestrel and retain all unrelated maps.

Checks cover surface area, crater depth, facility/template pads, collision,
40 mm routes, controls, glazing, loading/clear lifecycle, UV stretch and
imported vertex counts. Actual mesh previews show the supplied geometry and
material. Native TTS playtesting remains pending.

Material provenance and the complete built-in image-generation prompt are
included in `Source/MATERIAL-PROMPT.txt`; the generated source scan is also
included. Mirrored tile packing produces a 4096-pixel diffuse atlas. The
material contains fine dust and tiny mineral chips, without baked craters.
