# Portal walkthrough, version 2

The final video uses the original Bradley recording throughout. No new voice, ElevenLabs credits, or paid service was used.

All spoken narration is preserved. Five silent on-screen guides explain navigation and artwork, Known Army Lists routing, desktop View List, mobile Copy Army Code, and global versus in-faction ranks. The page transcript distinguishes these instructions from spoken narration.

Duration: 5 minutes and 0.5 seconds. Chapters: 22. Screenshots were captured from the live portal on October 8, 2026 (UTC); the mobile import steps are an instruction diagram, not a fabricated mobile screenshot. Numbers and active mission periods shown are examples from the capture date.

## Reproduce

Install Pillow and FFmpeg. From the app root, run:

```sh
python docs/portal-guide-v2/render.py
```

The renderer reads `source-scenes.json`, the original `walkthrough-bradley-v1.mp4`, and the screenshots in `captures/`. It writes the MP4, poster, caption and chapter tracks, the TypeScript chapter list, and `storyboard.json`. Generated `frames-final/` and `frames.ffconcat` are temporary render files.

The website player, dashboard card, chapter links, caption track, and transcript point to version 2. The original assets remain available for rollback.
