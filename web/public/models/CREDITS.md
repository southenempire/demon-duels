# Model credits

- `mire-phantom.glb` — original Demon Duels model, rig, vertex colors, and animation built in Blender, based on the in-game Mire Phantom design. The GLB is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); this dedication does not cover the reference artwork.
- `hunter.glb` — Ash Gate Hunter, original Demon Duels mesh, textures, rig and animation built with Blender, dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No third-party geometry, textures, or animations were used.
- `ash-warden.glb` — original Demon Duels model, rig, textures, and animation built in Blender, based on the in-game Ash Warden design. The GLB is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); this dedication does not cover the reference artwork.
- `void-wraith.glb` — original Demon Duels model, rig, textures, and animation built in Blender, based on the in-game Void Wraith design. The GLB is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); this dedication does not cover the reference artwork.
- `marrow-king.glb` — original Demon Duels model, rig, vertex colors, and animation built in Blender, based on the in-game Marrow King design. The GLB is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); this dedication does not cover the reference artwork.

Regenerate the Hunter from the repository root with Blender 4.5 LTS:

```sh
blender -b -t 1 --python-exit-code 1 --python web/tools/build-hunter.py
```

Run `npm run dev` and open `/models/hunter-viewer.html` to inspect the model and play or scrub every clip. The viewer loads its pinned three.js modules from jsDelivr.
