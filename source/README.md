# Original 13 builder source

This archive contains the R11 input save, retained artwork, reference geometry,
builder, integrator and independent validator used for R12. It creates the full
37-scenario save while replacing only the 16 layouts for the original 13 battles.

Run in a Linux Python environment with DejaVu Sans fonts. Dependencies:
`numpy scipy Pillow shapely mapbox-earcut lz4`. Blender is used for optional
visual renders. Network access to the public asset URLs is required for the
initial download. Run from the extracted directory:

```bash
python3 audit_assets.py
python3 build_original13.py
python3 package_original13.py COMMIT_SHA
python3 validate_original13.py
blender -b -t 4 -P render_original13.py
python3 make_installer.py
```

Before packaging, publish the referenced `original13-assets` files under
`original13/` in the configured GitHub repository and supply that immutable
commit SHA. Omitting the SHA creates a draft containing PENDING URLs that must
not be distributed. The scripts do not themselves authenticate or write to
GitHub. `make_installer.py` caches all updated-battle assets; other collection
assets load from their existing public URLs.

`original13-models.json` records artwork selection, model identities and figure
footprint checks. `original13-validation.json` is the independent saved-file
check. The code does not perform live Tabletop Simulator or Windows testing.

The complete source archive is split into three files for transport. From this directory, join them before extraction:

```bash
cat Original13-Builder-Source.zip.part* > Original13-Builder-Source.zip
unzip Original13-Builder-Source.zip -d builder
```

The installer contains the same source archive as one complete ZIP.
