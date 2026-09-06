window.rlEngine = (() => {
  const canvas  = document.getElementById('rlCanvas');
  const ctx     = canvas.getContext('2d');
  const scoreSpan = document.getElementById('rlScore');
  const hintUI  = document.getElementById('rlHint');

  const G = 26, LOGICAL = 480, GAMMA = 0.94;
  const dpr = window.devicePixelRatio || 1;

  function setupCanvas() {
    canvas.width  = LOGICAL * dpr;
    canvas.height = LOGICAL * dpr;
    ctx.scale(dpr, dpr);
  }
  setupCanvas();

  const resizeObs = new ResizeObserver(() => { ctx.resetTransform(); setupCanvas(); draw(); });
  resizeObs.observe(canvas);

  const CELL = LOGICAL / G;
  const SHAPE = {
    BODY_HALF: CELL/2.5, TRACK_W: CELL/1.5, TRACK_H: CELL/5,
    CORE_R: CELL/4, EYE_R: CELL/8,
    GOAL_INNER: CELL/3.5, GOAL_OUTER: CELL/2, RADAR_R: CELL*2.5, RADAR_ANGLE: Math.PI/5,
  };

  let V   = Array.from({length:G}, ()=>new Float32Array(G));
  let obs = Array.from({length:G}, ()=>new Uint8Array(G));
  let goal  = {x:22, y:22};
  let robot = {x:3.5, y:3.5, angle:0};
  let score = 0;
  let isMouseDown = false;
  let hasInteracted = false;
  let animId = null;
  let isVisible = false;
  let wallsDirty = true;
  let cvsTheme = {};

  function updateCanvasTheme() {
    const s = getComputedStyle(document.documentElement);
    const inkRgb = s.getPropertyValue('--ink-rgb').trim() || '17, 17, 15';
    const amberRgb = s.getPropertyValue('--amber-rgb').trim() || '184, 146, 74';
    
    cvsTheme.bg = s.getPropertyValue('--cream-2').trim() || '#EFEBE4';
    cvsTheme.grid = `rgba(${inkRgb}, 0.055)`;
    cvsTheme.obsFill = s.getPropertyValue('--cream-4').trim() || '#DDD7CC';
    cvsTheme.obsStroke = `rgba(${amberRgb}, 0.35)`;
    cvsTheme.valFill = `rgba(${amberRgb}, `;
    cvsTheme.goal = s.getPropertyValue('--amber').trim() || '#B8924A';
    cvsTheme.goalOuter = `rgba(${amberRgb}, 0.45)`;
    cvsTheme.botFill = cvsTheme.obsFill;
    cvsTheme.botStroke = `rgba(${inkRgb}, 0.15)`;
    cvsTheme.track = s.getPropertyValue('--ink-4').trim() || '#8A877E';
    cvsTheme.eye = s.getPropertyValue('--cream').trim() || '#F7F5F0';
    cvsTheme.radar = `rgba(${amberRgb}, 0.12)`;
    wallsDirty = true;
  }
  
  updateCanvasTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    updateCanvasTheme();
    if(!animId && isVisible) draw();
  });

  [[6,4],[6,5],[6,6],[6,7],[6,8],[14,14],[14,15],[15,14],[19,8],[19,9],[19,10]].forEach(([x,y])=>{ obs[x][y]=1; });

  function solveBellman() {
    const DIRS=[[0,1],[0,-1],[1,0],[-1,0]];
    for(let x=0;x<G;x++) for(let y=0;y<G;y++) {
      if(x===goal.x&&y===goal.y){V[x][y]=100;continue;}
      if(obs[x][y]){V[x][y]=-100;continue;}
      let best=-999;
      for(const[dx,dy] of DIRS){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&nx<G&&ny>=0&&ny<G&&!obs[nx][ny]){
          if(V[nx][ny]>best) best=V[nx][ny];
        }
      }
      if(best>-999) V[x][y]=-1+GAMMA*best;
    }
  }

  function maybeResolveBellman() {
    if (!wallsDirty) return;
    for(let i=0;i<40;i++) solveBellman();
    wallsDirty = false;
  }

  function stepRobot() {
    const cx=Math.floor(robot.x),cy=Math.floor(robot.y);
    if(cx===goal.x&&cy===goal.y){
      score++; 
      scoreSpan.textContent=score;
      scoreSpan.classList.remove('pop');
      void scoreSpan.offsetWidth;
      scoreSpan.classList.add('pop');
      respawn(); return;
    }
    const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
    let bestVal=-9999,targetX=robot.x,targetY=robot.y;
    for(const[dx,dy] of DIRS){
      const nx=cx+dx,ny=cy+dy;
      if(nx>=0&&nx<G&&ny>=0&&ny<G&&!obs[nx][ny]){
        if(V[nx][ny]>bestVal){bestVal=V[nx][ny];targetX=nx+0.5;targetY=ny+0.5;}
      }
    }
    if(bestVal<=-50) return;
    const dx=targetX-robot.x,dy=targetY-robot.y,dist=Math.hypot(dx,dy);
    if(dist>0.02){
      robot.x+=(dx/dist)*0.035; robot.y+=(dy/dist)*0.035;
      const ta=Math.atan2(dy,dx);
      let diff=ta-robot.angle;
      while(diff<-Math.PI)diff+=Math.PI*2;
      while(diff>Math.PI)diff-=Math.PI*2;
      robot.angle+=diff*0.15;
    }
  }

  function draw() {
    ctx.fillStyle = cvsTheme.bg; ctx.fillRect(0,0,LOGICAL,LOGICAL);
    ctx.strokeStyle = cvsTheme.grid; ctx.lineWidth=1;
    for(let x=0;x<G;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,LOGICAL);ctx.stroke();}
    for(let y=0;y<G;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(LOGICAL,y*CELL);ctx.stroke();}
    for(let x=0;x<G;x++) for(let y=0;y<G;y++) {
      const px=x*CELL,py=y*CELL;
      if(obs[x][y]) {
        ctx.fillStyle = cvsTheme.obsFill;
        ctx.fillRect(px+1,py+1,CELL-2,CELL-2);
        ctx.strokeStyle = cvsTheme.obsStroke; ctx.lineWidth=1;
        ctx.strokeRect(px+3,py+3,CELL-6,CELL-6);
      } else {
        const alpha=Math.max(0,V[x][y])/100*0.30;
        ctx.fillStyle=`${cvsTheme.valFill}${alpha})`;
        ctx.fillRect(px,py,CELL,CELL);
      }
    }
    const gx=goal.x*CELL+CELL/2,gy=goal.y*CELL+CELL/2;
    const pulse=Math.sin(Date.now()*0.006)*2.5;
    ctx.fillStyle = cvsTheme.goal;
    ctx.beginPath();ctx.arc(gx,gy,SHAPE.GOAL_INNER+pulse/2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = cvsTheme.goalOuter; ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(gx,gy,SHAPE.GOAL_OUTER+pulse,0,Math.PI*2);ctx.stroke();
    
    ctx.save();
    ctx.translate(robot.x*CELL,robot.y*CELL);ctx.rotate(robot.angle);
    ctx.fillStyle = cvsTheme.botFill;
    ctx.beginPath();ctx.roundRect(-SHAPE.BODY_HALF,-SHAPE.BODY_HALF,SHAPE.BODY_HALF*2,SHAPE.BODY_HALF*2,3);ctx.fill();
    ctx.strokeStyle = cvsTheme.botStroke; ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(-SHAPE.BODY_HALF,-SHAPE.BODY_HALF,SHAPE.BODY_HALF*2,SHAPE.BODY_HALF*2,3);ctx.stroke();
    
    ctx.fillStyle = cvsTheme.track;
    ctx.fillRect(-CELL/3,-SHAPE.BODY_HALF*1.15,SHAPE.TRACK_W,SHAPE.TRACK_H);
    ctx.fillRect(-CELL/3, SHAPE.BODY_HALF*0.9, SHAPE.TRACK_W,SHAPE.TRACK_H);
    
    ctx.fillStyle = cvsTheme.goal;
    ctx.beginPath();ctx.arc(0,0,SHAPE.CORE_R,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = cvsTheme.eye;
    ctx.beginPath();ctx.arc(SHAPE.EYE_R,0,SHAPE.EYE_R,0,Math.PI*2);ctx.fill();
    
    const sp=Math.sin(Date.now()*0.01)*0.1;
    ctx.fillStyle = cvsTheme.radar;
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,SHAPE.RADAR_R,-SHAPE.RADAR_ANGLE+sp,SHAPE.RADAR_ANGLE-sp);ctx.fill();
    ctx.restore();
  }

  function markInteracted() {
    if(!hasInteracted){ hasInteracted=true; hintUI.classList.add('hidden'); }
  }

  function handlePointer(clientX,clientY) {
    markInteracted();
    const rect=canvas.getBoundingClientRect();
    const x=Math.floor((clientX-rect.left)*(LOGICAL/rect.width)/CELL);
    const y=Math.floor((clientY-rect.top)*(LOGICAL/rect.height)/CELL);
    if(x>=0&&x<G&&y>=0&&y<G
      &&!(x===goal.x&&y===goal.y)
      &&!(x===Math.floor(robot.x)&&y===Math.floor(robot.y))
      &&!obs[x][y]) {
      obs[x][y]=1; wallsDirty=true;
    }
  }

  canvas.addEventListener('mousedown', e=>{isMouseDown=true;handlePointer(e.clientX,e.clientY);});
  canvas.addEventListener('mousemove', e=>{if(isMouseDown)handlePointer(e.clientX,e.clientY);});
  window.addEventListener('mouseup', ()=>{isMouseDown=false;});
  canvas.addEventListener('touchstart', e=>{isMouseDown=true;handlePointer(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();},{passive:false});
  canvas.addEventListener('touchmove',  e=>{if(isMouseDown)handlePointer(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();},{passive:false});
  window.addEventListener('touchend',   ()=>{isMouseDown=false;});
  canvas.addEventListener('keydown', e=>{if(e.key==='c'||e.key==='C'){clearWalls();}});

  function respawn() {
    do {
      goal.x=Math.floor(Math.random()*(G-2))+1;
      goal.y=Math.floor(Math.random()*(G-2))+1;
    } while(obs[goal.x][goal.y]||(goal.x===Math.floor(robot.x)&&goal.y===Math.floor(robot.y)));
    V=Array.from({length:G},()=>new Float32Array(G));
    wallsDirty=true;
  }

  function clearWalls() {
    obs=Array.from({length:G},()=>new Uint8Array(G));
    wallsDirty=true; markInteracted();
  }

  function loop() {
    maybeResolveBellman(); stepRobot(); draw();
    if(isVisible) animId=requestAnimationFrame(loop);
    else animId=null;
  }

  const visObs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      isVisible=e.isIntersecting;
      if(isVisible&&animId===null) animId=requestAnimationFrame(loop);
    });
  },{threshold:0.1});
  visObs.observe(canvas);

  if(canvas.getBoundingClientRect().top<window.innerHeight){
    isVisible=true; animId=requestAnimationFrame(loop);
  }

  return { clearWalls };
})();
