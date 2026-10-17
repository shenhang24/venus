import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {configureNetworkControls,followSelectedPosition,overviewDistance,mainTagRegion} from '../public/network-controls.js';

test('main category camera keeps the core readable independently of distant shared members',()=>{
  const nodes=[{id:'core',isMainTag:true,mainTag:'A'},{id:'near'},{id:'far'}],positions={core:[10,20,30],near:[12,20,30],far:[1e6,0,0]},radii={core:4,near:1,far:2};
  const before=structuredClone(positions);
  for(const [width,height]of [[1600,900],[400,900]]){
    const input={nodes,positions,radii,mainTag:'A',width,height},first=mainTagRegion(input);
    assert.deepEqual(first.center,positions.core);assert.ok(first.ids.includes('core'));assert.ok(!first.ids.includes('far'));assert.ok(first.coreDiameterPixels>=32);
    positions.far=[1e12,0,0];assert.deepEqual(mainTagRegion(input),first);positions.far=before.far;
  }
  assert.deepEqual(positions,before);assert.equal(mainTagRegion({nodes,positions,radii,mainTag:'missing'}),null);
});

test('overview fits the complete system with margins on wide and tall displays',()=>{
  const radius=900;
  for(const aspect of [.4,1,16/9,3]){
    const camera=new PerspectiveCamera(48,aspect,.1,10000),d=overviewDistance(radius,48,aspect);
    camera.position.set(0,0,d);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    for(let i=0;i<80;i++)for(let j=0;j<40;j++){
      const a=i*Math.PI/40,b=j*Math.PI/20;
      const p=new Vector3(radius*Math.sin(a)*Math.cos(b),radius*Math.cos(a),radius*Math.sin(a)*Math.sin(b)).project(camera);
      assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z<1);
    }
  }
  assert.ok(overviewDistance(radius,48,.4)>overviewDistance(radius,48,16/9));
});

class Canvas extends EventTarget {
  constructor(){super();this.style={};this.clientWidth=900;this.clientHeight=600;this.root=new EventTarget();}
  getRootNode(){return this.root;}
  setPointerCapture(){}
  releasePointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
}
function dispatch(canvas,type,values={}){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100,pageX:100,pageY:100,...values});
  canvas.dispatchEvent(event);return event;
}
test('real OrbitControls middle drag pans camera and target equally; left orbit and wheel zoom remain functional',()=>{
  const camera=new PerspectiveCamera(48,1.5,.1,8000);camera.position.set(0,0,100);
  const canvas=new Canvas(),controls=new OrbitControls(camera,canvas);
  const dispose=configureNetworkControls(controls,canvas);
  const position=camera.position.clone(),target=controls.target.clone(),orientation=camera.quaternion.clone();
  dispatch(canvas,'pointerdown',{button:1});
  dispatch(canvas,'pointermove',{button:1,clientX:160,clientY:130,pageX:160,pageY:130});
  dispatch(canvas,'pointerup',{button:1});
  const delta=camera.position.clone().sub(position);
  assert.ok(delta.length()>1);
  assert.ok(controls.target.clone().sub(target).distanceTo(delta)<1e-9);
  assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
  const panTarget=controls.target.clone(),panPosition=camera.position.clone();
  dispatch(canvas,'pointerdown');dispatch(canvas,'pointermove',{clientX:180,clientY:125,pageX:180,pageY:125});dispatch(canvas,'pointerup');
  assert.ok(camera.position.distanceTo(panPosition)>1);
  assert.ok(controls.target.distanceTo(panTarget)<1e-9);
  const distance=camera.position.distanceTo(controls.target);
  dispatch(canvas,'wheel',{deltaY:100,deltaMode:0});
  assert.notEqual(camera.position.distanceTo(controls.target),distance);
  assert.equal(dispatch(canvas,'mousedown',{button:1}).defaultPrevented,true);
  assert.equal(dispatch(canvas,'auxclick',{button:1}).defaultPrevented,true);
  dispose();controls.dispose();
});
test('floating selected node follows its movement without undoing pan or rewriting node positions',()=>{
  const positions={a:[10,20,30],b:[40,50,60]},before=JSON.stringify(positions);
  const camera=new PerspectiveCamera();camera.position.set(100,100,100);
  const controls={target:new Vector3(15,25,35)};
  const previous=new Vector3(...positions.a);
  let next=followSelectedPosition(camera,controls,positions.a,previous);
  assert.deepEqual(controls.target.toArray(),[15,25,35]);
  assert.equal(JSON.stringify(positions),before);
  next=followSelectedPosition(camera,controls,[12,23,34],next);
  assert.deepEqual(controls.target.toArray(),[17,28,39]);
  assert.deepEqual(camera.position.toArray(),[102,103,104]);
  assert.equal(JSON.stringify(positions),before);
});
