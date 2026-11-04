// High-fidelity extraction of the original ChatGPT Intelligent UI AM chain experiment.
(function(){
'use strict';
const root=document.getElementById('am-chain-02');if(!root||root.dataset.ready)return;root.dataset.ready='1';
const el=id=>root.querySelector('#'+id);
let f=3,amp=.7,tune=800,phase=0,paused=false;
const names=['original','carrier','modulated','filtered','recovered','compare'];
const canvas=Object.fromEntries(names.map(n=>[n,el('ac-'+n)]));
function reception(fc){return Math.exp(-.5*Math.pow((tune-fc)/27,2))}
function m(t,station=0){return amp*Math.sin(2*Math.PI*f*t+phase*.07+station*.4)}
function other(t){return .65*Math.sin(2*Math.PI*4*t+.3+phase*.04)}
function env(t,station=0){return 1+.8*(station===0?m(t):other(t))}
function c(t,station=0){return Math.sin(2*Math.PI*(station===0?52:76)*t+phase*(station===0?1:1.2))}
function mod(t,station=0){return env(t,station)*c(t,station)/1.8}
function recovered(t,station=0){return station===0?m(t):other(t)}
function draw(name,fn,color,overlay){
const cv=canvas[name],r=cv.getBoundingClientRect(),w=Math.max(100,r.width),h=name==='compare'?100:76,dpr=Math.min(window.devicePixelRatio||1,2);
if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
ctx.lineWidth=1;ctx.strokeStyle='rgba(130,140,150,.16)';
for(let i=1;i<4;i++){let y=i*h/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
function line(func,stroke,width,dash){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.beginPath();for(let x=0;x<=w;x++){let t=x/w,y=h/2-func(t)*(h*.42);if(!x)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.setLineDash([])}
line(fn,color,1.6);if(overlay)line(overlay,'#a78bfa',1.8);
}
function sync(){
el('ac-freq-value').textContent=f+' Hz';el('ac-amp-value').textContent=Math.round(amp*100)+'%';el('ac-tune-value').textContent=tune+' kHz';
let a=reception(800),b=reception(1200),best=Math.max(a,b),station=b>a?'B':'A';
el('ac-status').textContent=best>.8?'已选中电台 '+station:best>.06?'频率偏离 · 信号较弱':'未选中有效电台';
el('ac-strength').textContent='信号 '+Math.round(best*100)+'%';el('ac-meter').style.width=(best*100)+'%';
el('ac-st-a').classList.toggle('active',tune===800);el('ac-st-b').classList.toggle('active',tune===1200);
el('ac-result').textContent=best<.06?'没有选中电台，无法还原声音。':b>a?'接收到电台 B：它播放的是另一种声音，和上面的原始声音不同。':best>.8?'接收正常：原始声音与还原声音基本重合。':'电台 A 信号较弱，恢复出来的声音振幅下降。';
}
function frame(){
const a=reception(800),b=reception(1200);
draw('original',t=>m(t),'#10b981');
draw('carrier',t=>c(t)*.62,'#94a3b8');
draw('modulated',t=>mod(t),'#f59e0b');
draw('filtered',t=>(a*mod(t,0)+b*mod(t,1)),'#60a5fa');
draw('recovered',t=>a*m(t)+b*other(t),'#a78bfa');
draw('compare',t=>m(t),'#10b981',t=>a*m(t)+b*other(t));
if(!paused)phase+=.09;
requestAnimationFrame(frame);
}
el('ac-freq').addEventListener('input',e=>{f=Number(e.target.value);sync()});
el('ac-amp').addEventListener('input',e=>{amp=Number(e.target.value)/100;sync()});
el('ac-tune').addEventListener('input',e=>{tune=Number(e.target.value);sync()});
el('ac-st-a').addEventListener('click',()=>{tune=800;el('ac-tune').value=tune;sync()});
el('ac-st-b').addEventListener('click',()=>{tune=1200;el('ac-tune').value=tune;sync()});
el('ac-pause').addEventListener('click',()=>{paused=!paused;el('ac-pause').textContent=paused?'继续':'暂停'});
el('ac-reset').addEventListener('click',()=>{f=3;amp=.7;tune=800;phase=0;el('ac-freq').value=f;el('ac-amp').value=70;el('ac-tune').value=tune;sync()});
sync();frame();
})();