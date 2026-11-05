(function(){
const root=document.getElementById('fls-lab');if(!root||root.dataset.ready)return;root.dataset.ready='1';
const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const RAD=Math.PI/180;
const sceneCv=$('#fls-scene'),sg=sceneCv.getContext('2d');
const ppiCv=$('#fls-ppi'),pg=ppiCv.getContext('2d');
const SW=800,SH=500,PW=500,PH=500,C=1500;
const S={maxRange:300,pulse:0.5,sector:90,beams:64,freq:200,gain:0,tvg:0.80,noise:-30,rate:2.0,speed:0,persistence:0.85,heading:0,vx:0,vy:0,obstacles:[],preset:'reef',placeType:'rock',cmap:'sonar',scanning:true,paused:false,paintRange:0,pingTimer:0,hoverR:null,hoverB:null,dragging:null};
const COLORMAPS={
  sonar:t=>{const s=clamp(t,0,1);return[clamp(Math.round(40*s+Math.max(0,s-0.6)/0.4*180),0,255),clamp(Math.round(255*Math.min(1,s*1.2)),0,255),clamp(Math.round(30*s+Math.max(0,s-0.85)/0.15*120),0,255)];},
  thermal:t=>{const s=clamp(t,0,1);let r,g,b;if(s<0.25){r=0;g=0;b=Math.round(255*s/0.25);}else if(s<0.5){r=Math.round(255*(s-0.25)/0.25);g=0;b=Math.round(255*(1-(s-0.25)/0.25));}else if(s<0.75){r=255;g=Math.round(255*(s-0.5)/0.25);b=0;}else{r=255;g=255;b=Math.round(255*(s-0.75)/0.25);}return[r,g,b];},
  gray:t=>{const v=Math.round(255*clamp(t,0,1));return[v,v,v];}
};
const cmap=t=>COLORMAPS[S.cmap](t);
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>13))*1274126177|0;return((h^(h>>16))>>>0)/4294967295;}
function noise2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v);}
function fbm(x,y){let s=0,a=0.5,f=1;for(let i=0;i<3;i++){s+=a*noise2(x*f,y*f);f*=2;a*=0.5;}return s;}
const OT={rock:{strength:18,size:6},wreck:{strength:24,size:10},fish:{strength:8,size:14,diffuse:true},mine:{strength:14,size:3}};
function addObstacle(t,wx,wy){const o=OT[t]||OT.rock;S.obstacles.push({type:t,wx,wy,size:o.size,strength:o.strength,diffuse:!!o.diffuse});}
function loadPreset(name){
  S.obstacles=[];S.vx=0;S.vy=0;const R=S.maxRange;
  if(name==='reef'){for(let i=0;i<7;i++){const a=(-0.4+Math.random()*0.8),r=R*(0.3+Math.random()*0.5);addObstacle('rock',Math.sin(a)*r,-Math.cos(a)*r);}}
  else if(name==='wreck'){addObstacle('wreck',0,-R*0.55);for(let i=0;i<3;i++)addObstacle('rock',(i-1)*18+5,-R*0.5+Math.random()*20);}
  else if(name==='fish'){for(let i=0;i<5;i++)for(let j=0;j<4;j++){const a=(-0.3+(i-2)*0.12),r=R*(0.4+j*0.08);addObstacle('fish',Math.sin(a)*r+(Math.random()-0.5)*10,-Math.cos(a)*r+(Math.random()-0.5)*10);}}
  else if(name==='slope'){for(let i=0;i<4;i++){const a=(-0.5+Math.random()),r=R*(0.35+Math.random()*0.5);addObstacle('rock',Math.sin(a)*r,-Math.cos(a)*r);}}
  S.preset=name;invalidatePPI();
}
function seabedTS(wx,wy,r){
  const tex=fbm(wx*0.02,wy*0.02),tex2=fbm(wx*0.005+100,wy*0.005+100);
  let slope=0;if(S.preset==='slope')slope=clamp((-wy)/(S.maxRange*2),-6,6);
  return -18+tex*8+tex2*6+slope-6*Math.max(0,(r/S.maxRange-0.2));
}
function cellIntensity(range,bearingRel){
  if(range<=0.5)return 0;
  const wb=S.heading+bearingRel,wx=S.vx+range*Math.sin(wb),wy=S.vy-range*Math.cos(wb);
  let ts=seabedTS(wx,wy,range);
  for(const o of S.obstacles){const dx=o.wx-wx,dy=o.wy-wy,d2=dx*dx+dy*dy,cell=Math.max(o.size,S.pulse*1.5);if(d2>cell*cell*4)continue;const prof=o.diffuse?Math.exp(-d2/(o.size*o.size*0.7)):Math.exp(-d2/(o.size*o.size*0.25));ts=10*Math.log10(Math.pow(10,ts/10)+o.strength*prof*0.18);}
  const alpha=0.00045*Math.pow(S.freq/100,2),spread=40*Math.log10(Math.max(range,1)),absorb=2*alpha*range;
  let lin=Math.pow(10,(ts+S.gain-(1-S.tvg)*spread-absorb)/20);
  lin+=Math.pow(10,S.noise/20)*0.5*(Math.random()+Math.random()-1);
  return lin;
}
let ppiImg=null,ppiData=null,grid=null,gridR=0;
function invalidatePPI(){ppiImg=null;grid=null;gridR=0;}
function ensurePPIImg(){if(!ppiImg){ppiImg=pg.createImageData(PW,PH);ppiData=ppiImg.data;}}
function computeGrid(){
  const N=S.beams,M=clamp(Math.round(S.maxRange/S.pulse),8,400);
  grid={N,M,dr:S.maxRange/M,beams:new Float32Array(N*M)};
  for(let b=0;b<N;b++){const br=(-S.sector/2+(b+0.5)/N*S.sector)*RAD;for(let m=0;m<M;m++){grid.beams[b*M+m]=cellIntensity((m+0.5)*grid.dr,br);}}
}
function sampleGrid(range,bearingRel){
  if(!grid)return 0;const N=grid.N,M=grid.M,dr=grid.dr,half=S.sector/2*RAD;
  if(Math.abs(bearingRel)>half)return 0;
  const bf=((bearingRel+half)/(S.sector*RAD))*N-0.5,rf=range/dr-0.5;
  if(rf<0||rf>=M-1)return 0;
  const b0=clamp(Math.floor(bf),0,N-2),r0=clamp(Math.floor(rf),0,M-2),tb=bf-b0,tr=rf-r0;
  return lerp(lerp(grid.beams[b0*M+r0],grid.beams[(b0+1)*M+r0],tb),lerp(grid.beams[b0*M+r0+1],grid.beams[(b0+1)*M+r0+1],tb),tr);
}
function ppiGeom(){const cx=PW/2,cy=PH*0.92,scale=(cy-20)/S.maxRange;return{cx,cy,scale};}
function renderPPI(){
  ensurePPIImg();const {cx,cy,scale}=ppiGeom(),half=S.sector/2*RAD,data=ppiData,p=S.persistence;
  if(p>0){for(let i=0;i<data.length;i+=4){data[i]*=p;data[i+1]*=p;data[i+2]*=p;}}else{for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=0;}}
  const lim=gridR;
  for(let py=0;py<PH;py++){const dy=cy-py;if(dy<=0)continue;for(let px=0;px<PW;px++){const dx=px-cx,range=Math.sqrt(dx*dx+dy*dy)/scale;if(range>S.maxRange||range<0.5)continue;const bearing=Math.atan2(dx,dy);if(Math.abs(bearing)>half||range>lim)continue;const t=clamp(sampleGrid(range,bearing),0,1);if(t<=0.012)continue;const [r,g,b]=cmap(t),idx=(py*PW+px)*4;data[idx]=Math.min(255,data[idx]+r);data[idx+1]=Math.min(255,data[idx+1]+g);data[idx+2]=Math.min(255,data[idx+2]+b);data[idx+3]=255;}}
  pg.putImageData(ppiImg,0,0);drawPPIOverlay();
}
function drawPPIOverlay(){
  const {cx,cy,scale}=ppiGeom(),half=S.sector/2*RAD;
  pg.strokeStyle='rgba(120,180,210,0.35)';pg.lineWidth=1;
  pg.beginPath();pg.moveTo(cx,cy);pg.lineTo(cx+Math.sin(half)*S.maxRange*scale,cy-Math.cos(half)*S.maxRange*scale);pg.moveTo(cx,cy);pg.lineTo(cx-Math.sin(half)*S.maxRange*scale,cy-Math.cos(half)*S.maxRange*scale);pg.stroke();
  pg.beginPath();pg.arc(cx,cy,S.maxRange*scale,-Math.PI/2-half,-Math.PI/2+half);pg.stroke();
  pg.strokeStyle='rgba(120,180,210,0.18)';pg.setLineDash([4,6]);
  for(let f=0.25;f<=1.0;f+=0.25){const rr=S.maxRange*f*scale;pg.beginPath();pg.arc(cx,cy,rr,-Math.PI/2-half,-Math.PI/2+half);pg.stroke();pg.setLineDash([]);pg.fillStyle='rgba(150,190,215,0.5)';pg.font='10px system-ui';pg.textAlign='left';pg.fillText((S.maxRange*f).toFixed(0)+' m',cx+3,cy-rr+11);pg.setLineDash([4,6]);}
  pg.setLineDash([]);pg.strokeStyle='rgba(120,180,210,0.12)';
  for(let b=Math.ceil(-S.sector/2/15)*15;b<=S.sector/2;b+=15){const a=(-Math.PI/2)+b*RAD;pg.beginPath();pg.moveTo(cx,cy);pg.lineTo(cx+Math.sin(a+Math.PI/2)*S.maxRange*scale,cy-Math.cos(a+Math.PI/2)*S.maxRange*scale);pg.stroke();}
  pg.strokeStyle='rgba(200,230,255,0.4)';pg.beginPath();pg.moveTo(cx,cy);pg.lineTo(cx,cy-S.maxRange*scale);pg.stroke();
  pg.fillStyle='#7fd0ff';pg.beginPath();pg.moveTo(cx,cy);pg.lineTo(cx-7,cy+12);pg.lineTo(cx+7,cy+12);pg.closePath();pg.fill();
  if(gridR>0&&gridR<S.maxRange){pg.strokeStyle='rgba(180,255,220,0.55)';pg.lineWidth=1.5;pg.beginPath();pg.arc(cx,cy,gridR*scale,-Math.PI/2-half,-Math.PI/2+half);pg.stroke();}
  if(S.hoverR!=null){const a=-Math.PI/2+S.hoverB*RAD,hx=cx+Math.sin(a)*S.hoverR*scale,hy=cy-Math.cos(a)*S.hoverR*scale;pg.strokeStyle='rgba(255,255,255,0.8)';pg.lineWidth=1;pg.beginPath();pg.arc(cx,cy,S.hoverR*scale,-Math.PI/2-half,-Math.PI/2+half);pg.stroke();pg.beginPath();pg.moveTo(cx,cy);pg.lineTo(hx,hy);pg.stroke();pg.fillStyle='#fff';pg.beginPath();pg.arc(hx,hy,3,0,Math.PI*2);pg.fill();}
}
function sceneGeom(){const cx=SW/2,cy=SH*0.86,scale=(cy-30)/S.maxRange;return{cx,cy,scale};}
function worldToScreen(wx,wy){const {cx,cy,scale}=sceneGeom();const dx=wx-S.vx,dy=wy-S.vy,ca=Math.cos(-S.heading),sa=Math.sin(-S.heading);return[cx+(dx*ca-dy*sa)*scale,cy-(dx*sa+dy*ca)*scale];}
function screenToWorldRel(sx,sy){const {cx,cy,scale}=sceneGeom();const rx=(sx-cx)/scale,ry=(cy-sy)/scale,ca=Math.cos(S.heading),sa=Math.sin(S.heading);return[rx*ca-ry*sa,rx*sa+ry*ca];}
function drawObstacle(o){
  const [x,y]=worldToScreen(o.wx,o.wy);if(x<-30||x>SW+30||y<-30||y>SH+30)return;
  sg.save();sg.translate(x,y);
  if(o.type==='rock'){sg.fillStyle='#6b7a88';sg.strokeStyle='#3a4754';sg.lineWidth=1.5;sg.beginPath();const sides=6+Math.floor(o.seed||0)%3;for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,r=o.size*1.6*(0.7+0.3*Math.sin(i*1.7));i?sg.lineTo(Math.cos(a)*r,Math.sin(a)*r):sg.moveTo(Math.cos(a)*r,Math.sin(a)*r);}sg.closePath();sg.fill();sg.stroke();}
  else if(o.type==='wreck'){sg.fillStyle='#5a4a3a';sg.strokeStyle='#2e2620';sg.lineWidth=1.5;sg.save();sg.rotate((o.seed||0)*0.3);sg.fillRect(-o.size,-o.size*0.5,o.size*2,o.size);sg.strokeRect(-o.size,-o.size*0.5,o.size*2,o.size);sg.beginPath();sg.moveTo(-o.size,-o.size*0.5);sg.lineTo(0,-o.size*1.4);sg.lineTo(o.size,-o.size*0.5);sg.stroke();sg.restore();}
  else if(o.type==='fish'){sg.fillStyle='rgba(120,200,210,0.45)';for(let i=0;i<10;i++){const fx=Math.sin(i*1.3)*o.size*1.2,fy=Math.cos(i*0.7)*o.size*0.8;sg.beginPath();sg.ellipse(fx,fy,3,1.5,i*0.5,0,Math.PI*2);sg.fill();}sg.strokeStyle='rgba(120,200,210,0.3)';sg.beginPath();sg.arc(0,0,o.size*1.6,0,Math.PI*2);sg.stroke();}
  else if(o.type==='mine'){sg.fillStyle='#2a3038';sg.strokeStyle='#000';sg.lineWidth=1;sg.beginPath();sg.arc(0,0,o.size*1.5,0,Math.PI*2);sg.fill();sg.stroke();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;sg.beginPath();sg.moveTo(Math.cos(a)*o.size*1.5,Math.sin(a)*o.size*1.5);sg.lineTo(Math.cos(a)*o.size*2.4,Math.sin(a)*o.size*2.4);sg.stroke();}}
  sg.restore();
}
function drawScene(){
  sg.clearRect(0,0,SW,SH);const {cx,cy,scale}=sceneGeom(),half=S.sector/2*RAD;
  const grad=sg.createLinearGradient(0,0,0,SH);grad.addColorStop(0,'#0a1a26');grad.addColorStop(1,'#06121c');sg.fillStyle=grad;sg.fillRect(0,0,SW,SH);
  sg.strokeStyle='rgba(90,140,170,0.07)';sg.lineWidth=1;for(let x=0;x<=SW;x+=40){sg.beginPath();sg.moveTo(x,0);sg.lineTo(x,SH);sg.stroke();}for(let y=0;y<=SH;y+=40){sg.beginPath();sg.moveTo(0,y);sg.lineTo(SW,y);sg.stroke();}
  // seabed texture dots (world-anchored)
  sg.fillStyle='rgba(60,110,140,0.18)';
  for(let i=0;i<60;i++){const wx=(i*73%400)-100+S.vx*0.0,wy=((i*131)%500)-200+S.vy;const [x,y]=worldToScreen(wx*1,wy*1);if(x>0&&x<SW&&y>0&&y<SH){sg.fillRect(x,y,1.5,1.5);}}
  // fan
  sg.fillStyle='rgba(70,150,200,0.07)';sg.beginPath();sg.moveTo(cx,cy);sg.arc(cx,cy,S.maxRange*scale,-Math.PI/2-half,-Math.PI/2+half);sg.closePath();sg.fill();
  sg.strokeStyle='rgba(120,180,210,0.18)';sg.setLineDash([4,6]);
  for(let f=0.25;f<=1.0;f+=0.25){sg.beginPath();sg.arc(cx,cy,S.maxRange*f*scale,-Math.PI/2-half,-Math.PI/2+half);sg.stroke();}
  sg.setLineDash([]);
  sg.strokeStyle='rgba(120,200,230,0.5)';sg.lineWidth=1.5;
  sg.beginPath();sg.moveTo(cx,cy);sg.lineTo(cx+Math.sin(half)*S.maxRange*scale,cy-Math.cos(half)*S.maxRange*scale);sg.moveTo(cx,cy);sg.lineTo(cx-Math.sin(half)*S.maxRange*scale,cy-Math.cos(half)*S.maxRange*scale);sg.stroke();
  sg.beginPath();sg.arc(cx,cy,S.maxRange*scale,-Math.PI/2-half,-Math.PI/2+half);sg.stroke();
  // bearing ticks
  sg.strokeStyle='rgba(120,180,210,0.1)';
  for(let b=Math.ceil(-S.sector/2/15)*15;b<=S.sector/2;b+=15){const a=(-Math.PI/2)+b*RAD;sg.beginPath();sg.moveTo(cx,cy);sg.lineTo(cx+Math.sin(a+Math.PI/2)*S.maxRange*scale,cy-Math.cos(a+Math.PI/2)*S.maxRange*scale);sg.stroke();}
  // paint sweep
  if(gridR>0&&gridR<S.maxRange){sg.strokeStyle='rgba(180,255,220,0.4)';sg.lineWidth=1.5;sg.beginPath();sg.arc(cx,cy,gridR*scale,-Math.PI/2-half,-Math.PI/2+half);sg.stroke();}
  // obstacles
  for(const o of S.obstacles)drawObstacle(o);
  // vessel
  sg.save();sg.translate(cx,cy);
  sg.shadowColor='#7fd0ff';sg.shadowBlur=12;sg.fillStyle='#1e4a6b';sg.beginPath();sg.moveTo(0,-18);sg.lineTo(11,10);sg.lineTo(0,5);sg.lineTo(-11,10);sg.closePath();sg.fill();sg.shadowBlur=0;
  sg.strokeStyle='#9fd8ff';sg.lineWidth=1.5;sg.stroke();
  // heading line
  sg.strokeStyle='rgba(200,230,255,0.5)';sg.setLineDash([3,5]);sg.beginPath();sg.moveTo(0,-18);sg.lineTo(0,-18-S.maxRange*scale*0.4);sg.stroke();sg.setLineDash([]);
  sg.restore();
  // labels
  sg.fillStyle='rgba(150,190,215,0.6)';sg.font='10px system-ui';sg.textAlign='left';
  for(let f=0.25;f<=1.0;f+=0.25){sg.fillText((S.maxRange*f).toFixed(0)+' m',cx+5,cy-S.maxRange*f*scale-3);}
  sg.fillStyle='#8edfff';sg.font='11px system-ui';sg.fillText('船',cx-7,cy+24);
  $('#fls-scene-info').textContent='船速 '+(S.speed).toFixed(1)+' kn · 目标 '+S.obstacles.length;
}
// ---- ping / scan loop ----
function firePing(){computeGrid();gridR=0;S.paintRange=0;}
function clearTrail(){ppiImg=null;gridR=0;if(grid){gridR=0;}pg.clearRect(0,0,PW,PH);}
let last=0;
function frame(now){
  if(!last)last=now;
  const dt=Math.min((now-last)/1000,0.05);last=now;
  if(!S.paused){
    // vessel motion: speed in kn -> m/s (1 kn ~ 0.514 m/s), world forward = (sin h, -cos h)
    const vms=S.speed*0.514;
    S.vx+=Math.sin(S.heading)*vms*dt;
    S.vy-=Math.cos(S.heading)*vms*dt;
    if(S.scanning){
      S.pingTimer-=dt;
      if(S.pingTimer<=0){firePing();S.pingTimer=1/S.rate;}
    }
    // paint returns progressively: full range takes 2*R/c seconds; visualized over a fraction
    if(grid&&gridR<S.maxRange){
      const paintSpeed=S.maxRange/(Math.max(0.05,2*S.maxRange/C))*0.6; // m/s, slowed for visibility
      gridR=Math.min(S.maxRange,gridR+paintSpeed*dt);
    }
  }
  renderPPI();drawScene();updateReadouts();
  requestAnimationFrame(frame);
}
function updateReadouts(){
  const dr=S.pulse;
  $('#fls-dr').textContent=dr.toFixed(2)+' m';
  $('#fls-da').textContent=(S.sector/S.beams).toFixed(2)+'°';
  $('#fls-tt').textContent=(2*S.maxRange/C).toFixed(2)+' s';
  const alpha=0.00045*Math.pow(S.freq/100,2);
  $('#fls-abs').textContent=(2*alpha*S.maxRange).toFixed(1)+' dB';
  if(S.hoverR!=null){
    $('#fls-cursor-r').textContent=S.hoverR.toFixed(1)+' m';
    $('#fls-cursor-b').textContent=(S.hoverB>=0?'+':'')+S.hoverB.toFixed(1)+'°';
    const v=grid?sampleGrid(S.hoverR,S.hoverB*RAD):0;
    const db=v>1e-6?(20*Math.log10(v)):null;
    $('#fls-echo').textContent=db!=null?db.toFixed(1)+' dB':'— dB';
    $('#fls-ppi-cursor').textContent='光标 '+S.hoverR.toFixed(0)+' m · '+(S.hoverB>=0?'+':'')+S.hoverB.toFixed(0)+'°';
  }else{
    $('#fls-cursor-r').textContent='— m';$('#fls-cursor-b').textContent='— °';$('#fls-echo').textContent='— dB';$('#fls-ppi-cursor').textContent='悬停：—';
  }
  $('#fls-ppi-status').textContent=S.paused?'Ⅱ 已暂停':(S.scanning?'● 连续扫描':'● 待机');
}
// ---- interaction ----
function ppiPos(e){const r=ppiCv.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,2);const x=(e.clientX-r.left)/r.width*PW,y=(e.clientY-r.top)/r.height*PH;const {cx,cy,scale}=ppiGeom();const dx=x-cx,dy=cy-y;const range=Math.sqrt(dx*dx+dy*dy)/scale,bearing=Math.atan2(dx,dy)/RAD;if(range>S.maxRange||Math.abs(bearing)>S.sector/2)return null;return{range,bearing};}
ppiCv.addEventListener('mousemove',e=>{const p=ppiPos(e);if(p){S.hoverR=p.range;S.hoverB=p.bearing;}else{S.hoverR=null;S.hoverB=null;}});
ppiCv.addEventListener('mouseleave',()=>{S.hoverR=null;S.hoverB=null;});
function scenePos(e){const r=sceneCv.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*SW,y=(e.clientY-r.top)/r.height*SH;const [wx,wy]=screenToWorldRel(x,y);return{sx:x,sy:y,wx:S.vx+wx,wy:S.vy+wy};}
function hitObstacle(wx,wy){for(let i=S.obstacles.length-1;i>=0;i--){const o=S.obstacles[i],dx=o.wx-wx,dy=o.wy-wy;if(dx*dx+dy*dy<o.size*o.size*2.5)return o;}return null;}
sceneCv.addEventListener('pointerdown',e=>{sceneCv.setPointerCapture(e.pointerId);const p=scenePos(e);const hit=hitObstacle(p.wx,p.wy);if(hit){S.dragging=hit;hit._off={wx:hit.wx-p.wx,wy:hit.wy-p.wy};}else{addObstacle(S.placeType,p.wx,p.wy);invalidatePPI();}});
sceneCv.addEventListener('pointermove',e=>{if(S.dragging){const p=scenePos(e);S.dragging.wx=p.wx+S.dragging._off.wx;S.dragging.wy=p.wy+S.dragging._off.wy;invalidatePPI();}});
sceneCv.addEventListener('pointerup',e=>{S.dragging=null;});
sceneCv.addEventListener('dblclick',e=>{const p=scenePos(e);const hit=hitObstacle(p.wx,p.wy);if(hit){S.obstacles.splice(S.obstacles.indexOf(hit),1);invalidatePresetActive();invalidatePPI();}});
function invalidatePresetActive(){$$('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===S.preset));}
// ---- wiring controls ----
function bindRange(id,key,fmt,cb){const el=$('#'+id),txt=$('#'+id+'-text');el.addEventListener('input',()=>{S[key]=+el.value;txt.textContent=fmt(S[key]);if(cb)cb();});}
bindRange('fls-range','maxRange',v=>v+' m',()=>{if(grid)firePing();});
bindRange('fls-pulse','pulse',v=>v.toFixed(2)+' m',()=>invalidatePPI());
bindRange('fls-sector','sector',v=>v+'°',()=>invalidatePPI());
bindRange('fls-beams','beams',v=>v+'',()=>invalidatePPI());
bindRange('fls-freq','freq',v=>v+' kHz',()=>invalidatePPI());
bindRange('fls-gain','gain',v=>v+' dB',()=>invalidatePPI());
bindRange('fls-tvg','tvg',v=>v.toFixed(2),()=>invalidatePPI());
bindRange('fls-noise','noise',v=>v+' dB',()=>invalidatePPI());
bindRange('fls-rate','rate',v=>v.toFixed(1)+' Hz');
bindRange('fls-speed','speed',v=>v.toFixed(1)+' kn');
bindRange('fls-persistence','persistence',v=>v.toFixed(2));
$$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{$$('[data-preset]').forEach(x=>x.classList.remove('active'));b.classList.add('active');loadPreset(b.dataset.preset);}));
$$('[data-type]').forEach(b=>b.addEventListener('click',()=>{$$('[data-type]').forEach(x=>x.classList.remove('active'));b.classList.add('active');S.placeType=b.dataset.type;}));
$$('[data-cmap]').forEach(b=>b.addEventListener('click',()=>{$$('[data-cmap]').forEach(x=>x.classList.remove('active'));b.classList.add('active');S.cmap=b.dataset.cmap;}));
$('#fls-ping').addEventListener('click',()=>{S.scanning=false;firePing();});
$('#fls-scan').addEventListener('click',()=>{S.scanning=!S.scanning;$('#fls-scan').classList.toggle('active',S.scanning);$('#fls-scan').textContent=S.scanning?'⏵ 连续扫描':'⏸ 已停止';});
$('#fls-pause').addEventListener('click',()=>{S.paused=!S.paused;$('#fls-pause').textContent=S.paused?'▶ 继续':'Ⅱ 暂停';$('#fls-pause').classList.toggle('active',S.paused);});
$('#fls-clear-trail').addEventListener('click',clearTrail);
$('#fls-reset-scene').addEventListener('click',()=>{loadPreset(S.preset);clearTrail();});
// init
loadPreset('reef');
requestAnimationFrame(frame);
})();