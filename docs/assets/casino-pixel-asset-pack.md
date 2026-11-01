# Casino Pixel Asset Pack

Transparent, standalone pixel-art PNG textures for a 2D casino-management game using PixiJS 8. Sprites share a bold comic outline and the project role palette (violet identity, cyan service, pink guest, gold value, red danger, green success, orange warning). Textures are nearest-neighbor scaled with hard alpha edges; load them individually with `Assets.load`.

## Asset folders

- `assets/symbols/` — 15 reel/slot symbols (7, bell, cherries, plum, grapes, lemon, orange, watermelon, star, diamond, BAR, crown, horseshoe, clover, WILD). **64×64 px**.
- `assets/plinko/` — 8 jewel/steel peg colors, 3 diamond bumpers, a violet wedge bumper, 2 chevron deflectors, 2 slanted rails and 5 horizontal/diagonal rail variants. Pegs are **32×32 px**; bumpers **40×40 px**; deflectors/rails **32–64 px** high and **32–80 px** wide.
- `assets/machines/` — recognizable slot cabinet front/side, display bezel, button panel, coin tray, lever, 4 bar bottles, cocktail/beer/shot glasses, cash register, payment terminal and 5 chip stacks. Detail textures range from **24×40 px** to **128×48 px**; cabinet front is **96×160 px** and side panel **48×128 px**.
- `assets/decor/` — pendant lamp, oval neon, wall sconce, casino neon sign, neon column, 2 potted plants, velvet-rope barrier, planter greenery, upright neon tube and newspaper prop. Sizes range from **24×64 px** to **96×80 px**; the neon column is **40×112 px**.
- `assets/ui/` — 24 utility/status/role icons plus 5 beveled panel accents. Icons and badges are **32×32 px**; panel accents are **32×32 px**, **96×48 px** or **128×48 px**. Role badges are supplied in violet, cyan, pink, gold, red and green.

## PixiJS 8 example

```js
import { Assets, Sprite } from 'pixi.js';

const texture = await Assets.load('/assets/symbols/lucky-seven.png');
const sprite = new Sprite(texture);
sprite.texture.source.scaleMode = 'nearest';
```

Set nearest-neighbor sampling when scaling sprites. ZIP contents are limited to `README.md` and the `assets/` directory; no source code, fonts or runtime dependencies are included.
