import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectPoint,projectionBounds} from '../js/pages/state-map-projection.js';
const asset=JSON.parse(await readFile(new URL('../assets/state-map/large-map.json',import.meta.url),'utf8')),original=JSON.stringify(asset);
for(const view of ['top','game']){const b=projectionBounds(asset.cells,view);assert.ok(b.width>0&&b.height>0);for(const c of asset.cells)for(const p of c.polygon){const [x,y]=projectPoint(p,view);assert.ok(x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height);}}
assert.equal(JSON.stringify(asset),original);
const a=projectPoint([512,512],'top'),b=projectPoint([612,612],'top');assert.ok(Math.abs(a[1]-b[1])<1e-8);
const c=projectPoint([512,612],'game');assert.equal(c[1]-512,65);
console.log('PASS both projection bounds, orthographic alignment, game tilt, original map data preserved');
