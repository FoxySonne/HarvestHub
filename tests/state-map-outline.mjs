import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {insetPolygon} from '../js/pages/state-map-outline.js';
import {projectPoint} from '../js/pages/state-map-projection.js';
const rect=[[0,0],[10,0],[10,10],[0,10]];
assert.deepEqual(insetPolygon(rect,1),[[1,1],[9,1],[9,9],[1,9]]);
assert.deepEqual(insetPolygon([...rect].reverse(),1),[[1,9],[9,9],[9,1],[1,1]]);
const asset=JSON.parse(await readFile(new URL('../assets/state-map/large-map.json',import.meta.url),'utf8')),before=JSON.stringify(asset);
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
for(const view of ['top','game'])for(const cell of asset.cells)for(const amount of [.1,.8,1.5,2.5]){const p=cell.polygon.map(p=>projectPoint(p,view)),out=insetPolygon(p,amount);assert.equal(out.length,p.length);assert.ok(out.every(p=>p.every(Number.isFinite)));assert.ok(area(out)>0&&area(out)<area(p),cell.id+' '+view+' '+amount);}
assert.equal(JSON.stringify(asset),before);
console.log('PASS inset direction, both windings, positive reduced areas at phone/desktop/zoom sizes, source data unchanged');
