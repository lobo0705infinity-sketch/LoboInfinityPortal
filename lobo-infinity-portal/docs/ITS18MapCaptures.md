# Fresh ITS18 map captures

The October 15 capture batch has been received and imported: 80 screenshots covering 40 setups, 20 missions and 16 terrain layouts. The browser groups the setups alphabetically by mission, two per mission. The Workshop update verified on 2026-10-15 at 06:45:36 UTC has matching bag names, object IDs and loader scripts.

Use the updated automatic Windows capture package: `public/assets/maps/its18-20261015T064536Z/Lobo-TTS-Map-Capture.zip`. It reuses the previous PowerShell helper and TTS external-editor connection, with all 40 current setups, matching portal filenames, restored alternate states, deployment markings and consistent camera orientation.

1. Extract into a new folder and run `TEST FIRST MAP.cmd`.
2. Open or restart TTS, start single-player, and load **Games → Save & Load → Lobo ITS18 Map Batch Capture - 40 setups**.
3. Use a 1920×1080 window if possible (minimum 1280×720 client area), hide the UI with F11, and keep TTS visible and in front.
4. Review the first overhead/angled pair. Run `CAPTURE ALL MAPS.cmd`, reload the same capture save, hide the UI and let it capture the entire batch.
5. Return both output ZIPs. `CONTINUE CAPTURE.cmd` can resume interrupted runs; it only reuses pairs from this exact revision.

The helper has been checked against all 40 manifests and simulated through 80 view acknowledgements and cleanup. Its first-map test is still needed on Windows in TTS. Nothing uploads automatically.

Review photos against each row in `ITS18MapCaptureChecklist.csv`. For manual retakes:

1. Load that exact Workshop bag and wait for the assets to finish loading.
2. Confirm the intended building states, upper floors, physical objectives and deployment markings. Keep the board orientation consistent with the top/bottom deployment edges. Check all four entrances on room maps.
3. Capture an overhead view showing the complete board, tightly framed with no menus, selected-object outlines, cursors over terrain, or import dialogs.
4. Capture a consistent angled view showing building heights and cover without cutting off the board. Keep lighting and zoom consistent across the batch.
5. Use the two filenames in the checklist. Each screenshot should be at least 1280×720; 1920×1080 or higher is preferred.
6. Retract that bag before loading the next setup.

Put the 80 images into one folder. Import them with:

```bash
node scripts/import-workshop-map-captures.mjs /path/to/captures
```

The importer validates the complete batch before updating the catalogue and writes versioned WebP assets. Review the resulting pages on desktop and mobile before publishing. Existing photos dated September 28 remain on historical map pages and must not stand in for revised setups. All current setup pages now show the fresh overhead and angled TTS screenshots; original diagrams remain stored as reference assets.

Google Forms for historical events keep their existing map scopes. This update changes the current portal map browser and preserves old report links and ratings; it does not silently reassign tables in completed events.
