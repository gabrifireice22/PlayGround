(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const introPanel = $('introPanel'), resultPanel = $('resultPanel');
  const raceHud = $('raceHud'), jumpButton = $('jumpButton'), jumpHint = $('jumpHint');
  const TOTAL = 1000;
  const obstacles = [
    { at: 78, type: 'snow', lane: -.5 }, { at: 157, type: 'cone', lane: .55 },
    { at: 239, type: 'crack', lane: -.25 }, { at: 322, type: 'snow', lane: .65 },
    { at: 402, type: 'cone', lane: -.6 }, { at: 482, type: 'crack', lane: .25 },
    { at: 562, type: 'snow', lane: -.55 }, { at: 641, type: 'cone', lane: .55 },
    { at: 720, type: 'crack', lane: -.15 }, { at: 798, type: 'snow', lane: .55 },
    { at: 876, type: 'cone', lane: -.5 }, { at: 948, type: 'snow', lane: .2 }
  ];
  let W = 0, H = 0, dpr = 1, state = 'intro', distance = 0, lives = 3;
  let lastTime = 0, jumpTime = 0, hurtTime = 0, soundOn = true, audioCtx = null;
  let best = Number(localStorage.getItem('frostboundBest') || 0);
  let particles = [];
  $('bestReadout').textContent = best ? `${best} m` : '—';

  function resize() {
    const rect = canvas.getBoundingClientRect(); W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize); resize();
  const lerp = (a,b,t) => a+(b-a)*t;
  function polygon(points, fill, stroke, lineWidth=1) {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
    if (fill) { ctx.fillStyle=fill; ctx.fill(); } if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=lineWidth; ctx.stroke(); }
  }
  function rr(x,y,w,h,r,fill,stroke) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function background(t) {
    const sky = ctx.createLinearGradient(0,0,0,H*.68); sky.addColorStop(0,'#a8e3ee'); sky.addColorStop(.7,'#d7f4ed'); sky.addColorStop(1,'#e8f7ed');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    // soft winter sun and distant cloud wisps
    ctx.fillStyle='rgba(255,255,255,.42)'; ctx.beginPath(); ctx.arc(W*.76,H*.19,Math.min(W,H)*.07,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.52)';
    for(let i=0;i<4;i++){const x=((i*.31*W+t*(i%2?.006:-.004))%(W+180))-90,y=H*(.15+i*.042);ctx.beginPath();ctx.ellipse(x,y,42+i*6,5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+25,y-3,24,5,0,0,Math.PI*2);ctx.fill();}
    // layered alpine silhouettes
    polygon([[0,H*.48],[0,H*.35],[W*.12,H*.22],[W*.2,H*.34],[W*.34,H*.14],[W*.48,H*.37],[W*.64,H*.2],[W*.78,H*.38],[W*.89,H*.18],[W,H*.33],[W,H*.51]],'#a4d5d9');
    polygon([[0,H*.48],[W*.13,H*.31],[W*.26,H*.43],[W*.4,H*.25],[W*.52,H*.43],[W*.68,H*.27],[W*.81,H*.42],[W*.92,H*.28],[W,H*.4],[W,H*.55]],'#c4e6df');
    // snowy peaks
    polygon([[W*.34,H*.14],[W*.29,H*.27],[W*.33,H*.24],[W*.36,H*.29],[W*.4,H*.25]],'rgba(250,255,251,.9)');
    polygon([[W*.64,H*.2],[W*.6,H*.31],[W*.64,H*.28],[W*.67,H*.33],[W*.7,H*.29]],'rgba(250,255,251,.85)');
    polygon([[W*.89,H*.18],[W*.85,H*.29],[W*.89,H*.25],[W*.92,H*.31],[W*.94,H*.27]],'rgba(250,255,251,.9)');
    // distant tree line
    for(let i=0;i<25;i++) { const x=i*W/24, y=H*(.435+Math.sin(i*3.2)*.012), s=H*(.045+(i%4)*.005); tree(x,y,s,'#6da9a0',.7); }
    // far lake and shore
    const horizon=H*.46;
    const ice=ctx.createLinearGradient(0,horizon,0,H); ice.addColorStop(0,'#def4ee'); ice.addColorStop(.35,'#c7eceb'); ice.addColorStop(1,'#a4dce6');
    ctx.fillStyle=ice; ctx.fillRect(0,horizon,W,H-horizon);
    // course side banks as perspective triangles
    polygon([[0,horizon],[W*.29,horizon],[W*.02,H],[0,H]],'#a7d2c8');
    polygon([[W,horizon],[W*.71,horizon],[W*.98,H],[W,H]],'#9bcac3');
    // banks snowy cap
    polygon([[0,horizon],[W*.29,horizon],[W*.24,H*.55],[0,H*.58]],'#f3fbef');
    polygon([[W,horizon],[W*.71,horizon],[W*.76,H*.55],[W,H*.58]],'#f3fbef');
    // far tree banks
    for(let i=0;i<12;i++){const q=i/11, s=H*(.035+q*.105), y=H*(.46+q*.27);tree(W*(.27-q*.26),y,s,i%2?'#659d8d':'#548b7f',1);tree(W*(.73+q*.26),y,s,i%2?'#659d8d':'#548b7f',1);}
    // long ice reflections / skate grooves
    ctx.save(); ctx.globalAlpha=.27; ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    for(let i=0;i<9;i++){let q=((i*.13 + t*.000025)%1); let y=lerp(horizon+8,H*1.04,q*q); let span=lerp(2,W*.34,q); let x=W/2 + Math.sin(i*9+t*.0003)*W*.35*q; ctx.beginPath();ctx.moveTo(x-span*.5,y);ctx.lineTo(x+span*.5,y+Math.max(1,q*2));ctx.stroke();}
    ctx.restore();
    // course guide dashed edges
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,.54)';ctx.lineWidth=1.5;ctx.setLineDash([8,12]);ctx.beginPath();ctx.moveTo(W*.42,horizon);ctx.lineTo(W*.08,H*1.03);ctx.moveTo(W*.58,horizon);ctx.lineTo(W*.92,H*1.03);ctx.stroke();ctx.restore();
    // snow sprinkles
    if(particles.length<52) for(let i=0;i<52-particles.length;i++) particles.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.7+.3,v:.3+Math.random()*.8});
    ctx.fillStyle='rgba(255,255,255,.66)'; particles.forEach(p=>{p.y+=p.v; p.x+=Math.sin(t*.0004+p.y)*.18;if(p.y>H){p.y=-4;p.x=Math.random()*W;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});
  }
  function tree(x,y,s,color,alpha=1) {
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#775f50';ctx.fillRect(x-s*.06,y-s*.12,s*.12,s*.36);
    for(let j=0;j<3;j++){const yy=y-s*(.18+j*.23), half=s*(.38-j*.065);polygon([[x,yy-s*.45],[x-half,yy+s*.1],[x+half,yy+s*.1]],j===1?'#77b69f':color);polygon([[x,yy-s*.43],[x-half*.72,yy],[x+half*.7,yy]],'rgba(241,251,238,.48)');}
    ctx.restore();
  }
  function project(diff) {
    const q=Math.max(0,Math.min(1,1-diff/145));
    return {q, y:lerp(H*.47,H*.78,q*q), scale:.23+q*.95};
  }
  function drawObstacle(o) {
    const diff=o.at-distance; if(diff < -18 || diff>150)return;
    const p=project(diff), center=W/2 + o.lane*W*.27*p.q;
    const s=p.scale;
    ctx.save();ctx.translate(center,p.y);ctx.scale(s,s);
    if(o.type==='cone') {
      ctx.fillStyle='rgba(42,83,99,.17)';ctx.beginPath();ctx.ellipse(0,5,22,6,0,0,Math.PI*2);ctx.fill();
      polygon([[-13,0],[0,-30],[13,0]],'#ff826d','#ed705f',1.5);polygon([[-8,-12],[8,-12],[5,-7],[-5,-7]],'#fff3dc');
      rr(-15,-2,30,6,3,'#ec6f5f');
    } else if(o.type==='snow') {
      ctx.fillStyle='rgba(50,91,104,.14)';ctx.beginPath();ctx.ellipse(0,8,33,8,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f9fff3';ctx.beginPath();ctx.ellipse(0,-2,27,17,0,Math.PI,0);ctx.lineTo(27,0);ctx.ellipse(0,0,27,10,0,0,Math.PI);ctx.fill();
      ctx.strokeStyle='#badbd7';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-1,22,10,0,Math.PI,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#d2ede6';ctx.beginPath();ctx.arc(-11,-8,3,0,Math.PI*2);ctx.arc(7,-12,2,0,Math.PI*2);ctx.fill();
    } else {
      ctx.strokeStyle='rgba(77,139,153,.8)';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-26,-6);ctx.lineTo(-8,1);ctx.lineTo(3,-9);ctx.lineTo(21,-2);ctx.stroke();
      ctx.strokeStyle='rgba(242,255,249,.95)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-23,-8);ctx.lineTo(-7,-1);ctx.lineTo(4,-11);ctx.lineTo(20,-4);ctx.stroke();
      ctx.fillStyle='rgba(81,137,147,.22)';ctx.beginPath();ctx.ellipse(0,4,30,6,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawSkater(t) {
    const baseY=H*.785, x=W*.5;
    const jumping=jumpTime>0, jumpProgress=jumping?1-jumpTime/.82:0;
    const lift=jumping?Math.sin(jumpProgress*Math.PI)*Math.min(H*.19,125):0;
    const wobble=state==='playing'?Math.sin(t*.012)*2:0;
    ctx.save();ctx.translate(x+wobble,baseY-lift);
    // soft shadow
    ctx.fillStyle=`rgba(32,83,102,${jumping?.11:.18})`;ctx.beginPath();ctx.ellipse(0,8+lift*.1,27+lift*.08,6,0,0,Math.PI*2);ctx.fill();
    const legSwing=state==='playing'&&!jumping?Math.sin(t*.018)*8:0;
    // skates behind legs
    ctx.strokeStyle='#d8f6f2';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,5);ctx.lineTo(-17+legSwing,-14);ctx.moveTo(9,5);ctx.lineTo(17-legSwing,-14);ctx.stroke();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20+legSwing,-12);ctx.lineTo(-8+legSwing,-12);ctx.moveTo(9-legSwing,-12);ctx.lineTo(21-legSwing,-12);ctx.stroke();
    // legs + trousers
    ctx.strokeStyle='#315f78';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,-27);ctx.lineTo(-10+legSwing,-7);ctx.moveTo(5,-27);ctx.lineTo(11-legSwing,-7);ctx.stroke();
    // jacket body, slight lean
    ctx.fillStyle='#f47b68';ctx.beginPath();ctx.moveTo(-14,-63);ctx.quadraticCurveTo(-18,-47,-11,-30);ctx.lineTo(11,-30);ctx.quadraticCurveTo(18,-48,13,-63);ctx.quadraticCurveTo(0,-72,-14,-63);ctx.fill();
    ctx.fillStyle='#fca18a';ctx.beginPath();ctx.moveTo(-11,-60);ctx.quadraticCurveTo(0,-54,12,-60);ctx.lineTo(10,-48);ctx.quadraticCurveTo(0,-44,-10,-49);ctx.fill();
    // arms
    ctx.strokeStyle='#f47b68';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-12,-58);ctx.lineTo(-23,-44+Math.sin(t*.013)*2);ctx.lineTo(-28,-37);ctx.moveTo(12,-58);ctx.lineTo(23,-47);ctx.lineTo(28,-43+Math.cos(t*.012)*2);ctx.stroke();
    ctx.fillStyle='#efb493';ctx.beginPath();ctx.arc(-28,-36,4,0,Math.PI*2);ctx.arc(28,-42,4,0,Math.PI*2);ctx.fill();
    // scarf flying in the wind
    ctx.fillStyle='#f9c66e';polygon([[-7,-61],[9,-61],[15,-57],[7,-54],[-5,-57]]);polygon([[9,-57],[21,-52],[16,-50],[9,-52]]);
    // head and hat
    ctx.fillStyle='#eab18f';ctx.beginPath();ctx.arc(0,-75,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#315b73';ctx.beginPath();ctx.arc(0,-80,12,Math.PI,Math.PI*2);ctx.lineTo(12,-77);ctx.quadraticCurveTo(0,-72,-12,-77);ctx.fill();
    ctx.fillStyle='#f5fbef';ctx.beginPath();ctx.arc(0,-91,3,0,Math.PI*2);ctx.fill();
    // cheeks and face profile
    ctx.fillStyle='#ce806d';ctx.beginPath();ctx.arc(8,-74,2,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // snow sparkle trail
    if(state==='playing' && Math.random()<.45) particles.push({x:x+(Math.random()-.5)*36,y:baseY+Math.random()*3,r:Math.random()*1.8+.6,v:-1.6});
  }
  function drawFinish() {
    const remaining=TOTAL-distance;if(remaining>155)return;
    const p=project(remaining), y=p.y, x=W/2, s=p.scale;
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ctx.strokeStyle='#f8ffff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-95,-3);ctx.lineTo(-95,-80);ctx.moveTo(95,-3);ctx.lineTo(95,-80);ctx.stroke();
    ctx.fillStyle='#f27866';ctx.fillRect(-95,-80,190,17);
    ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('FINISH',0,-68);
    for(let i=0;i<7;i++){const bx=-85+i*27;ctx.fillStyle=i%2?'#fff':'#254a62';ctx.fillRect(bx,-12,13,9);ctx.fillStyle=i%2?'#254a62':'#fff';ctx.fillRect(bx,-3,13,9);}
    ctx.restore();
  }
  function draw(t) {
    ctx.clearRect(0,0,W,H); background(t);
    drawFinish(); obstacles.forEach(drawObstacle);
    drawSkater(t);
    if(state==='playing') {
      const pct=Math.min(1,distance/TOTAL);
      $('distanceReadout').textContent=(distance/1000).toFixed(2);
      $('progressFill').style.width=`${pct*100}%`;document.querySelector('.progress-pin').style.left=`${pct*100}%`;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  function updateLives(){const hearts=$('lives').children;for(let i=0;i<3;i++)hearts[i].classList.toggle('lost',i>=lives);$('lives').setAttribute('aria-label',`${lives} chances remaining`);}
  function showCallout(text){$('calloutText').textContent=text;$('courseCallout').classList.add('show');clearTimeout(showCallout.timer);showCallout.timer=setTimeout(()=>$('courseCallout').classList.remove('show'),1050);}
  function beep(freq,duration=0.1,type='sine') {if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(.055,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}catch(e){}}
  function startGame(){distance=0;lives=3;jumpTime=0;hurtTime=0;obstacles.forEach(o=>o.hit=false);lastTime=performance.now();state='playing';updateLives();introPanel.classList.add('hidden');resultPanel.classList.add('hidden');raceHud.classList.add('active');jumpButton.classList.add('active');jumpHint.classList.add('visible');showCallout('CLEAR ICE AHEAD');}
  function finish(win){state=win?'won':'lost';jumpButton.classList.remove('active');jumpHint.classList.remove('visible');raceHud.classList.remove('active');resultPanel.classList.remove('hidden');
    $('resultEyebrow').innerHTML=win?'<span></span> RACE COMPLETE <span></span>':'<span></span> BACK ON YOUR FEET <span></span>';
    $('resultTitle').textContent=win?'You made it!':'A slippery finish.';
    $('resultMessage').textContent=win?'The whole frozen lake is yours. Beautifully skated.':'The ice won this round. Take a breath and try again.';
    $('againButton').innerHTML=win?'SKATE AGAIN <span>↻</span>':'GIVE IT ANOTHER GO <span>↻</span>';
    if(win){const score=Math.round(distance);if(!best||score<best){best=score;localStorage.setItem('frostboundBest',String(best));$('bestReadout').textContent=`${best} m`;}beep(740,.2);setTimeout(()=>beep(980,.25),140);}
  }
  function jump(){if(state!=='playing'||jumpTime>0)return;jumpTime=.82;beep(460,.11,'triangle');}
  $('startButton').addEventListener('click',startGame);$('againButton').addEventListener('click',startGame);jumpButton.addEventListener('pointerdown',e=>{e.preventDefault();jump();});
  window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(state==='intro'||state==='won'||state==='lost')startGame();else jump();}if(e.code==='Escape'&&state==='playing')finish(false);});
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundIcon').textContent=soundOn?'♫':'♪̸';$('soundButton').setAttribute('aria-label',soundOn?'Toggle sound':'Turn sound on');if(soundOn)beep(620,.08);});
  let previous=performance.now();
  function tick(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;
    if(state==='playing'){
      distance+=dt*25.5;
      if(jumpTime>0)jumpTime=Math.max(0,jumpTime-dt);
      if(hurtTime>0)hurtTime=Math.max(0,hurtTime-dt);
      for(const o of obstacles){if(!o.hit&&Math.abs(o.at-distance)<8.7){o.hit=true;if(jumpTime<=0&&hurtTime<=0){lives--;hurtTime=1.3;updateLives();showCallout('OOPS! KEEP SKATING');beep(155,.25,'sawtooth');if(lives<=0){finish(false);break;}}else if(jumpTime>0){showCallout('NICE JUMP!');beep(620,.08,'triangle');}}}
      if(distance>=TOTAL)finish(true);
    } else if(state==='intro') { // reset obstacle flags on a fresh page / idle scene
      obstacles.forEach(o=>o.hit=false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
