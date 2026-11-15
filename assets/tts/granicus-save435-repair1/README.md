# Granicus — Arrian strengths: save 435 repair 1

Repairs only the e90100 battle bag from the user-provided TS_Save_435.json (SHA256 15f2bc5ae17436283389c0743dfb26ec140bf6b26570ad65b829c46aa5545b62).

Restores missing casualty columns from the original archived artwork, keeps every existing atlas pixel, and repairs opposing-surface normals. No redrawing or substitute figure art. Mesh triangle positions and winding are unchanged. Standing label/base UVs continue to address their exact existing pixels after atlas width restoration.

The save builder removes only the duplicate flat-label script from 249 states (79 troop stands and 6 commanders). Standing labels remain baked into the original meshes. The other 36 scenario bags, all deployment data, unit statistics and global rules are unchanged.

Checks: exact pixel comparisons, per-corner geometry/UV comparisons, normalized normals, all meshes under 65000 vertices, offline two-sided visual renders, and serialized save diff allowlist. Windows installer, live Tabletop Simulator and multiplayer fresh-cache loading remain untested.
