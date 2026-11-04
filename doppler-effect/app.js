(function(){
const root=document.getElementById('doppler-exp');if(!root||root.dataset.ready)return;root.dataset.ready='1';
const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
const cv=$('#d-world'),g=cv.getContext('2d'),W=800,H=500;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let speed=85,freq=440,playing=true,t=0,last=0,sourceX=275,waves=[],nextEmission=0,tone=false,audioCtx=null,osc=null,gain=null;
const C=340,scale=170/C,observerX=660,sourceY=245,observerY=245,period=.32;
function fmt(v){return(v>=0?'+':'')+v.toFixed(1)}
function drawTrace(el,ratio,col){
  const rect=el.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(60,rect.width),h=Math.max(40,rect.height);
  el.width=Math.round(w*d);el.height=Math.round(h*d);
  const cx=el.getContext('2d');cx.setTransform(d,0,0,d,0,0);cx.clearRect(0,0,w,h);
  cx.strokeStyle='#54667855';cx.lineWidth=1;cx.beginPath();cx.moveTo(0,h/2);cx.lineTo(w,h/2);cx.stroke();
  cx.strokeStyle=col;cx.lineWidth=2;cx.beginPath();
  for(let x=0;x<=w;x+=2){const y=h/2-Math.sin(x/w*2*Math.PI*6*ratio)*h*.36;x===0?cx.moveTo(x,y):cx.lineTo(x,y)}
  cx.stroke();
}
function updateStaticState(){
  const radial=speed*Math.sign(observerX-sourceX||1);
  const fobs=freq*C/(C-radial);
  const change=(fobs/freq-1)*100;
  $('#d-f0').textContent=freq;
  $('#d-fo').textContent=Math.round(fobs);
  $('#d-delta').textContent=fmt(change)+'%';
  $('#d-delta').style.color=change>0?'#5bd9b2':change<0?'#f0a47f':'var(--viz-text)';
  $('#d-speed-text').textContent=(speed>0?'+':'')+speed+' m/s';
  $('#d-freq-label').textContent=freq+' Hz';
  $('#d-mach').textContent=(Math.abs(speed)/C).toFixed(2)+' Ma';
  $('#d-front').textContent=((C-speed)/freq).toFixed(3)+' m';
  $('#d-back').textContent=((C+speed)/freq).toFixed(3)+' m';
  const description=radial>0?'声源正在接近观察者':radial<0?'声源正在远离观察者':'声源相对观察者没有径向运动';
  $('#d-state').textContent=description;
  $('#d-explain').textContent=radial>0?'声源与观察者之间的波阵面间距减小，观察者接收波峰的频率升高。':radial<0?'声源与观察者之间的波阵面间距增大，观察者接收波峰的频率降低。':'声源相对观察者没有径向运动，观察频率与声源发射频率相同。';
  if(osc&&audioCtx){osc.frequency.setTargetAtTime(tone?fobs:freq,audioCtx.currentTime,.04)}
  drawTrace($('#d-wave0'),1,'#55cffa');
  drawTrace($('#d-wave1'),fobs/freq,'#f2bb70');
}
function updateSpeed(v){speed=+v;$('#d-speed').value=speed;$$('[data-v]').forEach(b=>b.classList.toggle('active',+b.dataset.v===speed));updateStaticState()}
function reset(){t=0;sourceX=275;waves=[];nextEmission=0;last=0;updateStaticState()}
function circle(x,y,r,stroke,width){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}
function draw(){
  g.clearRect(0,0,W,H);
  g.strokeStyle='#92b4d013';g.lineWidth=1;
  for(let x=0;x<=W;x+=40){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
  for(let y=0;y<=H;y+=40){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  g.beginPath();g.moveTo(30,sourceY);g.lineTo(765,sourceY);g.strokeStyle='#79a8be66';g.setLineDash([5,8]);g.lineWidth=1;g.stroke();g.setLineDash([]);
  g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
  for(const w of waves){const radius=(t-w.t)*C*scale;if(radius<0)continue;const alpha=clamp(1-radius/700,.08,.75);circle(w.x,sourceY,radius,'rgba(80,201,249,'+alpha+')',2.1)}
  g.restore();
  g.save();g.translate(sourceX,sourceY);g.shadowColor='#42b9ff';g.shadowBlur=25;g.fillStyle='#1e86bb';g.beginPath();g.arc(0,0,25,0,Math.PI*2);g.fill();g.shadowBlur=0;g.fillStyle='#c9f4ff';g.beginPath();g.moveTo(-10,-11);g.lineTo(2,-11);g.lineTo(14,-21);g.lineTo(14,21);g.lineTo(2,11);g.lineTo(-10,11);g.closePath();g.fill();g.restore();
  g.save();g.translate(observerX,observerY);g.shadowColor='#f3b966';g.shadowBlur=15;g.fillStyle='#f3b966';g.beginPath();g.arc(0,-18,11,0,Math.PI*2);g.fill();g.beginPath();if(g.roundRect){g.roundRect(-10,-4,20,36,8)}else{g.rect(-10,-4,20,36)}g.fill();g.shadowBlur=0;g.restore();
  g.textAlign='center';g.font='bold 16px system-ui';g.fillStyle='#8edfff';g.fillText('移动声源',sourceX,sourceY+65);g.fillStyle='#ffd393';g.fillText('观察者',observerX,observerY+65);
  g.font='13px system-ui';g.fillStyle='#a5c2d9';g.fillText('声源速度 '+(speed>0?'+':'')+speed+' m/s',sourceX,sourceY-62);
  const ax=sourceX+Math.sign(speed||1)*34,ay=sourceY-45;
  if(Math.abs(speed)>0){g.strokeStyle='#80d6ff';g.lineWidth=2;g.beginPath();g.moveTo(sourceX,ay);g.lineTo(ax,ay);g.stroke();g.beginPath();g.moveTo(ax,ay);g.lineTo(ax-Math.sign(speed||1)*9,ay-5);g.lineTo(ax-Math.sign(speed||1)*9,ay+5);g.closePath();g.fillStyle='#80d6ff';g.fill()}
  $('#d-clock').textContent='t = '+t.toFixed(1)+' s';
}
function updateDynamicState(){
  const radial=speed*Math.sign(observerX-sourceX||1);
  const fobs=freq*C/(C-radial);
  const change=(fobs/freq-1)*100;
  $('#d-fo').textContent=Math.round(fobs);
  $('#d-delta').textContent=fmt(change)+'%';
  $('#d-delta').style.color=change>0?'#5bd9b2':change<0?'#f0a47f':'var(--viz-text)';
  if(osc&&audioCtx&&tone)osc.frequency.setTargetAtTime(fobs,audioCtx.currentTime,.04);
  const side=String(Math.sign(observerX-sourceX));
  if(root.dataset.side!==side){root.dataset.side=side;updateStaticState()}
}
function frame(now){
  if(!last)last=now;
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(playing){
    t+=dt;sourceX+=speed*scale*dt;
    if(sourceX<85||sourceX>735){sourceX=speed>=0?85:735;waves=[];nextEmission=t}
    while(t>=nextEmission){waves.push({x:sourceX-speed*scale*(t-nextEmission),t:nextEmission});nextEmission+=period}
    waves=waves.filter(w=>(t-w.t)*C*scale<1100);
    updateDynamicState();
  }
  draw();
  requestAnimationFrame(frame);
}
$('#d-speed').addEventListener('input',e=>updateSpeed(e.target.value));
$('#d-freq').addEventListener('input',e=>{freq=+e.target.value;updateStaticState()});
$$('[data-v]').forEach(b=>b.addEventListener('click',()=>updateSpeed(b.dataset.v)));
$('#d-play').addEventListener('click',()=>{playing=!playing;$('#d-play').textContent=playing?'Ⅱ 暂停':'▶ 继续';$('#d-play').classList.toggle('active',playing);last=0});
$('#d-reset').addEventListener('click',reset);
$('#d-tone').addEventListener('click',async()=>{
  try{
    if(tone){tone=false;gain.gain.setTargetAtTime(0,audioCtx.currentTime,.025);$('#d-tone').textContent='♪ 播放纯音';$('#d-tone').classList.remove('active');return}
    if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();osc=audioCtx.createOscillator();gain=audioCtx.createGain();osc.type='sine';gain.gain.value=0;osc.connect(gain);gain.connect(audioCtx.destination);osc.start()}
    await audioCtx.resume();tone=true;
    osc.frequency.setTargetAtTime(freq*C/(C-speed*Math.sign(observerX-sourceX||1)),audioCtx.currentTime,.03);
    gain.gain.setTargetAtTime(.06,audioCtx.currentTime,.03);
    $('#d-tone').textContent='■ 关闭声音';$('#d-tone').classList.add('active');
  }catch(e){$('#d-tone').textContent='声音不可用'}
});
window.addEventListener('resize',updateStaticState);
reset();requestAnimationFrame(frame);
})();