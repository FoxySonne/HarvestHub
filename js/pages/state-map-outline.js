// A visual inset only: source polygons and the gameplay neighbor graph stay intact.
export function insetPolygon(points,distance){
 if(distance<=0)return points.map(p=>[...p]);
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=area>=0?1:-1;
 return points.map((p,i)=>{
  const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
  const ax=p[0]-prev[0],ay=p[1]-prev[1],bx=next[0]-p[0],by=next[1]-p[1],al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);
  if(al<1e-8||bl<1e-8)return [...p];
  const na=[-ay/al*sign,ax/al*sign],nb=[-by/bl*sign,bx/bl*sign],den=1+na[0]*nb[0]+na[1]*nb[1];
  let dx,dy;if(den<.05){dx=na[0]*distance;dy=na[1]*distance;}else{dx=(na[0]+nb[0])*distance/den;dy=(na[1]+nb[1])*distance/den;}
  const length=Math.hypot(dx,dy),limit=distance*2.5;if(length>limit){dx*=limit/length;dy*=limit/length;}
  return[p[0]+dx,p[1]+dy];
 });
}
