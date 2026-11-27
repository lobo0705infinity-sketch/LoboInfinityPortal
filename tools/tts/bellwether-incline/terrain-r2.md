# Bellwether Incline R2.1

The 48-inch railway rises 13.5 inches. Run `python source/layout.py` with NumPy and Shapely 2.1 or higher to generate its OBJ files and its station and world coordinates. R2.1 uses the R2 layout. Each of the twelve stair flights is a separate locked object. Three reusable models provide the exact rises. The granite beneath each flight also has a sloped surface and a level landing.

The R2.1 geometry is in `assets/tts/bellwether-incline-r21` at the repository root. The original photographic textures and unmodified station assets are in `assets/tts/bellwether-incline-r2` at `d40e2c385163dca206715ef4aa54dacd73ba72b0`. The Wavefront import check uses the native Assimp library to test both merged vertices and fully expanded triangles. Run `python qa/test-obj-import.py` after generating the models.
