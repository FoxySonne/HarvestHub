// Presentation only. Ownership, adjacency and plan actions retain their IDs and
// source coordinates; switching views never mutates saved map data.
export function projectPoint([x,y],view){
 const dx=x-512,dy=y-512;
 if(view==='game')return[x,512+dy*.65];
 return[512+(dx+dy)/Math.SQRT2,512+(dy-dx)/Math.SQRT2];
}
export function projectionBounds(cells,view){
 const points=cells.flatMap(c=>c.polygon.map(p=>projectPoint(p,view)));
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs)-10,y=Math.min(...ys)-10;
 return{x,y,width:Math.max(...xs)+10-x,height:Math.max(...ys)+10-y};
}
