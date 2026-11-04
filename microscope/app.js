/* High-fidelity standalone adaptation of the original Intelligent UI microscope. */
(function(){
const root=document.getElementById('microLab');if(!root||root.dataset.init)return;root.dataset.init='1';
const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
const c=$('#microView'),ctx=c.getContext('2d'),N=420;
let obj=10,coarse=0,fine=0,xx=0,yy=0,light=75,spec='onion',knobDrag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
const specimens={};
function buildSpec(type){
const cv=document.createElement('canvas');cv.width=cv.height=1100;const g=cv.getContext('2d'),r=rng(531);
g.fillStyle=type==='onion'?'#edc3e1':type==='leaf'?'#b9df96':'#f5d1d2';g.fillRect(0,0,1100,1100);
if(type==='onion'){
for(let row=-2;row<16;row++)for(let col=-2;col<12;col++){
let x=col*105+(row%2)*41-80,y=row*86-60,w=100+r()*18,h=81+r()*12;
g.beginPath();g.moveTo(x+11,y);g.bezierCurveTo(x+42,y-5,x+w-6,y+1,x+w,y+12);g.lineTo(x+w+2,y+h-12);g.quadraticCurveTo(x+w,y+h+4,x+w-13,y+h);g.lineTo(x+11,y+h);g.quadraticCurveTo(x-5,y+h-5,x,y+h-15);g.lineTo(x,y+11);g.closePath();g.fillStyle='rgba(246,207,228,'+(.2+r()*.38)+')';g.fill();g.strokeStyle='#a66c9b';g.lineWidth=4;g.stroke();g.beginPath();g.ellipse(x+32+r()*44,y+24+r()*34,11,8,r(),0,Math.PI*2);g.fillStyle='#98608c';g.fill();g.beginPath();g.arc(x+38,y+42,26,0,7);g.fillStyle='#f6def133';g.fill();
}
}else if(type==='leaf'){
for(let i=0;i<85;i++){let x=r()*1160-30,y=r()*1160-30;g.save();g.translate(x,y);g.rotate(r()*6.28);g.beginPath();g.ellipse(0,0,37+r()*20,19+r()*12,0,0,7);g.fillStyle=['#8abe70','#82ba60','#a7d98c','#72a958'][i%4];g.fill();g.strokeStyle='#538a48';g.lineWidth=3;g.stroke();for(let j=0;j<8;j++){g.beginPath();g.ellipse((r()-.5)*47,(r()-.5)*18,6,3,r()*6.28,0,7);g.fillStyle='#36883c';g.fill()}g.restore()}
for(let i=0;i<25;i++){let x=r()*1100,y=r()*1100;g.strokeStyle='#426e42';g.lineWidth=3;g.strokeRect(x,y,10,18)}
}else{
for(let i=0;i<450;i++){let x=r()*1100,y=r()*1100,rad=16+r()*8;g.beginPath();g.ellipse(x,y,rad,rad*.82,r()*6.28,0,Math.PI*2);g.fillStyle=['#d97781','#df8a91','#d68a95'][i%3];g.fill();g.strokeStyle='#b66a77';g.lineWidth=2;g.stroke();g.beginPath();g.ellipse(x-2,y-1,rad*.48,rad*.36,0,0,7);g.fillStyle='#efb6b6';g.fill()}
for(let i=0;i<12;i++){let x=r()*1100,y=r()*1100;g.beginPath();g.arc(x,y,25,0,7);g.fillStyle='#a98ab0';g.fill();for(let j=0;j<4;j++){g.beginPath();g.ellipse(x+(r()-.5)*20,y+(r()-.5)*20,8,6,r()*6,0,7);g.fillStyle='#67527e';g.fill()}}
}
return cv
}
['onion','leaf','blood'].forEach(s=>specimens[s]=buildSpec(s));
function draw(){
const rad=199;ctx.clearRect(0,0,N,N);ctx.save();ctx.beginPath();ctx.arc(210,210,rad,0,Math.PI*2);ctx.clip();
ctx.fillStyle='#d8d5cb';ctx.fillRect(0,0,N,N);
let zoom=obj/10,field=clamp(590/zoom,8,1100),centerX=550+xx*2.35,centerY=550+yy*2.35;
ctx.imageSmoothingEnabled=true;ctx.drawImage(specimens[spec],centerX-field/2,centerY-field/2,field,field,0,0,N,N);
const err=Math.abs(coarse*5+fine*.05),blur=clamp(err*(obj>=40?.45:.25),0,18);
if(blur>.3){const off=document.createElement('canvas');off.width=off.height=N;off.getContext('2d').drawImage(c,0,0);ctx.filter='blur('+blur.toFixed(2)+'px)';ctx.drawImage(off,0,0);ctx.filter='none'}
ctx.fillStyle='rgba(3,9,16,'+((.8-light/100)*.9)+')';ctx.fillRect(0,0,N,N);
let rim=ctx.createRadialGradient(210,210,105,210,210,203);rim.addColorStop(0,'#08172600');rim.addColorStop(.78,'#0d19221e');rim.addColorStop(1,'#000912c8');ctx.fillStyle=rim;ctx.fillRect(0,0,N,N);
ctx.restore();ctx.beginPath();ctx.arc(210,210,rad,0,7);ctx.strokeStyle='#394959';ctx.lineWidth=7;ctx.stroke();
}
function update(){
$('#microMag').textContent=obj*10+'×';$('#microObjective').textContent=obj+'×';$('#coarseLabel').textContent=(coarse*.05).toFixed(2)+' mm';$('#fineLabel').textContent=(fine*2).toFixed(0)+' μm';$('#micXLabel').textContent=xx;$('#micYLabel').textContent=yy;$('#micLightLabel').textContent=light+'%';
let err=Math.abs(coarse*5+fine*.05);$('#microStatus').textContent=err<1?'清晰':err<8?'略微模糊':'失焦';$('#microStatus').style.color=err<1?'#31b980':err<8?'#dca54c':'#ef7474';$('#microScale').textContent='视野直径约 '+(18/obj).toFixed(obj===100?2:1)+' mm';$('#microSpecName').textContent={onion:'洋葱表皮细胞',leaf:'植物叶片',blood:'血液涂片'}[spec];
$('#micBeam').style.opacity=light/100;$('#illumination').style.opacity=.3+light/140;$('#knobMark').setAttribute('transform','rotate('+(coarse*3)+')');$('#lensActive').setAttribute('transform','translate(0 '+(13+coarse*.06)+')');$('#micLensBand').setAttribute('fill',({4:'#e33a39',10:'#e4bd35',40:'#49a8ff',100:'#f0f1f3'})[obj]);$('#microKnob').setAttribute('aria-valuenow',String(coarse));
$$('[data-obj]').forEach(b=>b.classList.toggle('selected',+b.dataset.obj===obj));$$('[data-spec]').forEach(b=>b.classList.toggle('selected',b.dataset.spec===spec));draw();
}
function setObj(v){obj=v;update()}
$$('[data-obj]').forEach(b=>b.addEventListener('click',()=>setObj(+b.dataset.obj)));
$$('[data-spec]').forEach(b=>b.addEventListener('click',()=>{spec=b.dataset.spec;update()}));
const inputMap=[['#microCoarse',v=>coarse=v],['#microFine',v=>fine=v],['#micX',v=>xx=v],['#micY',v=>yy=v],['#micLight',v=>light=v]];
inputMap.forEach(([id,fn])=>$(id).addEventListener('input',e=>{fn(+e.target.value);update()}));
const turret=$('#objTurret');function cycleObj(){setObj(({4:10,10:40,40:100,100:4})[obj])}
turret.addEventListener('click',cycleObj);turret.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cycleObj()}});
$('#autoFocusMic').addEventListener('click',()=>{coarse=0;fine=0;$('#microCoarse').value=0;$('#microFine').value=0;update()});
$('#micReset').addEventListener('click',()=>{obj=10;coarse=0;fine=0;xx=0;yy=0;light=75;spec='onion';inputMap.forEach(([id])=>$(id).value=id==='#micLight'?75:0);update()});
const knob=$('#microKnob');
knob.addEventListener('pointerdown',e=>{knobDrag={y:e.clientY,start:coarse};knob.setPointerCapture(e.pointerId);e.preventDefault()});
knob.addEventListener('pointermove',e=>{if(!knobDrag)return;coarse=clamp(Math.round(knobDrag.start+(knobDrag.y-e.clientY)*.7),-100,100);$('#microCoarse').value=coarse;update()});
knob.addEventListener('pointerup',()=>knobDrag=null);knob.addEventListener('pointercancel',()=>knobDrag=null);
knob.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();coarse=clamp(coarse+(e.key==='ArrowUp'?1:-1),-100,100);$('#microCoarse').value=coarse;update()}});
update();
})();