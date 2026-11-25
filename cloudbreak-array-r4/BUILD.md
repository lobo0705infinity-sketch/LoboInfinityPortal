# Cloudbreak Array R4.1

R4 removes the first playable story from each of the sixteen R3 models. The real upper-floor triangles, furniture and colliders are translated together by 3.2 inches. The foundation facade stays at the mat and the old downward ladder openings are filled. The back of the photographed weather lab sits on the same mullioned window plane as the room it replaces.

R4.1 uses those same assets. Its map-specific Lua draws deployment and exclusion boundaries along the Z axis at fixed X offsets. Mission presents the public MissionGeist URL to the player who pressed it. Map Rules ends with the cloud bank visibility rule.

## Inputs

Keep the R2 and R3 build directories as siblings named `cloudbreak-array-r2` and `cloudbreak-array-r3`, or `r2` and `r3`. Prepare their inputs and saved tables as described in their individual build notes. R4 reads the R3 deployed table, shelf, and standalone bag along with the R2 meshes. The generated calibration photograph is in `assets/calibration-lab.jpg`. The photograph used for the distant lower city is in `work/lower-city-plate.jpg`.

## Build

1. Create `assets`, `work` and `out`. Run `python src/towers.py`. It rebuilds each cumulative state, closes the downward shafts, reopens the two relocated bridge passages and generates the photographic facade attachments.
2. Run `python src/sky_mat.py`. It projects the actual sixteen foundation outlines down through a virtual tower district and combines the facades, distant street photograph, service roofs and thin localized haze into the 3072-pixel mat.
3. Publish the production OBJ and JPEG assets. Write the immutable asset commit to `work/assets-commit.txt` and pass the SHA as the argument to `python src/build_save.py`. Copy `assets/city-shafts.jpg` to `out/Cloudbreak-Array-R4-Playmat.jpg`.
4. Run `python src/check_table.py`, `python src/check_assets.py`, and `python src/check_host.py`. Run the R2 canonical panel checker against `out/Workshop-Save.json`. These tests use the installed saves and exercise the navigable bridge ends, physical floor supports, objective access and Lua controls, cloud banks, silhouette samples, mat registration and every hosted asset URL.
5. Render the tabletop with Blender in background mode using `--python src/render_table.py -- MODE`. The released cameras use `roofs`, `ledge`, `courier-floor`, `courier-roof` and `lab`. Build the review images using `python src/review_images.py`.
6. Use Go in `src/installer` to build the windows/amd64 executable into `work/Lobo-Cloudbreak-Array-Setup.exe` and the native Linux test executable into `work/install-test`. Run `python src/pack_installer.py` and `python src/check_installer.py`.

The 106-setup Workshop collection includes the same deployable bag as the standalone release. The Windows installer also installs the directly playable Cloudbreak table.
