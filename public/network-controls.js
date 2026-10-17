import {MOUSE,Vector3} from 'three';

export function overviewDistance(radius,fov,aspect){
  const vertical=fov*Math.PI/360;
  const limiting=Math.min(vertical,Math.atan(Math.tan(vertical)*Math.max(.01,aspect)));
  return Math.max(100,Math.max(0,radius)/Math.sin(limiting)*1.16);
}

export function mainTagRegion({nodes,positions,radii,mainTag,width=1000,height=700,fov=48,aspect=width/height,minDistance=8}){
  const anchor=nodes.find(n=>n.isMainTag&&n.mainTag===mainTag),center=anchor&&positions[anchor.id];
  if(!center?.every(Number.isFinite))return null;
  const coreRadius=radii[anchor.id]||2,vertical=fov*Math.PI/360,half=Math.min(vertical,Math.atan(Math.tan(vertical)*Math.max(.01,aspect)));
  const targetPixels=Math.min(48,Math.max(Math.min(32,Math.min(width,height)*.2),Math.min(width,height)*.08));
  const distance=Math.max(minDistance,coreRadius*4,coreRadius*height/(Math.max(1,targetPixels)*Math.tan(vertical)));
  const radius=Math.max(coreRadius*2,distance*Math.sin(half)/1.16);
  const ids=nodes.filter(n=>n.id===anchor.id||(positions[n.id]&&Math.hypot(...positions[n.id].map((x,a)=>x-center[a]))+(radii[n.id]||2)<=radius)).map(n=>n.id);
  return {anchorId:anchor.id,center:[...center],radius,distance,ids,coreDiameterPixels:coreRadius*height/(distance*Math.tan(vertical))};
}

export function configureNetworkControls(controls, canvas) {
  controls.enablePan=true;
  controls.screenSpacePanning=true;
  controls.mouseButtons.LEFT=MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE=MOUSE.PAN;
  const preventMiddleDefault=event=>{if(event.button===1)event.preventDefault();};
  canvas.addEventListener('mousedown',preventMiddleDefault);
  canvas.addEventListener('auxclick',preventMiddleDefault);
  return ()=>{
    canvas.removeEventListener('mousedown',preventMiddleDefault);
    canvas.removeEventListener('auxclick',preventMiddleDefault);
  };
}

export function followSelectedPosition(camera, controls, position, previous) {
  const next=new Vector3().fromArray(position);
  if(previous){
    const delta=next.clone().sub(previous);
    camera.position.add(delta);
    controls.target.add(delta);
  }
  return next;
}
