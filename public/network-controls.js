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


export function relationDisplayTypes(types){return [...types.filter(t=>t.id!=='@semantic'),{id:'@semantic',name:'主分类归属',color:'#8a9aac',membershipLink:true}];}
export function createRelationVisibility(storage=null){
  const key='venus-relation-visibility-v2';let selected=new Set();
  try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.version===2&&Array.isArray(saved.selected))selected=new Set(saved.selected.filter(id=>typeof id==='string'));}catch{}
  const save=()=>{try{storage?.setItem(key,JSON.stringify({version:2,selected:[...selected]}));}catch{}};
  save();return {selected,hiddenFor:types=>new Set(relationDisplayTypes(types).filter(t=>!selected.has(t.id)).map(t=>t.id)),set(id,checked){if(checked)selected.add(id);else selected.delete(id);save();},selectAll(types){for(const t of relationDisplayTypes(types))selected.add(t.id);save();}};
}

export function nodeFocusRegion(options){
  const anchor=options.nodes.find(n=>n.id===options.nodeId);if(!anchor)return null;
  return mainTagRegion({...options,nodes:[{...anchor,isMainTag:true,mainTag:anchor.id},...options.nodes.filter(n=>n.id!==anchor.id)],mainTag:anchor.id});
}
