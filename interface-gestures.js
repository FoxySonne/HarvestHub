// The interface scrolls; each map handles its own independent scale.
(() => {
 const mapSelector='.map-canvas,.interactive-reservoir';
 for(const type of ['touchstart','touchmove'])document.addEventListener(type,event=>{
  if(event.touches.length>1&&!event.target.closest(mapSelector)&&event.cancelable)event.preventDefault();
 },{passive:false});
 for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,event=>{
  if(event.cancelable)event.preventDefault();
 },{passive:false});
})();
