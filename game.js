"use strict";
const $ = id => document.getElementById(id), canvas = $("game"), ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
const field = { left:60,right:W-60,top:35,bottom:H-35,goalTop:215,goalBottom:385,depth:42 }, localKeys = new Set(), remoteKeys = new Set();
let matchTimeLimit = 0, matchStartTime = 0, matchEnded = false, currentBallStyle = 0;
let mode, peer, connection, localChannel, scores={green:0,blue:0}, kickoffUntil=0, lastTime=performance.now(), lastStateSent=0, lastInputSent=0, botDifficulty="beginner", botThinkAt=0, botTarget={x:730,y:H/2};
const ball={x:W/2,y:H/2,vx:0,vy:0,r:13,mass:.75};
const players=[
  {team:"green",x:270,y:H/2,vx:0,vy:0,r:25,mass:2.6,color:"#45df6a",dark:"#229443",controls:["w","s","a","d"],kick:"x",kickReady:true},
  {team:"blue",x:730,y:H/2,vx:0,vy:0,r:25,mass:2.6,color:"#329cf0",dark:"#176ab7",controls:["arrowup","arrowdown","arrowleft","arrowright"],kick:"m",kickReady:true}
];
const botProfiles={beginner:{speed:190,reaction:540,offset:58,dribble:10},pro:{speed:300,reaction:230,offset:46,dribble:24},goat:{speed:410,reaction:70,offset:35,dribble:42}};
function show(id){["menu","lobby","practice","match"].forEach(x=>$(x).classList.toggle("hidden",x!==id));}
function message(text){$("message").textContent=text;} function updateScore(){$("green-score").textContent=scores.green;$("blue-score").textContent=scores.blue;}
function resetPositions(){Object.assign(ball,{x:W/2,y:H/2,vx:0,vy:0});Object.assign(players[0],{x:270,y:H/2,vx:0,vy:0});Object.assign(players[1],{x:730,y:H/2,vx:0,vy:0});}
function setControls(){const c=$("controls");c.innerHTML=mode==="local"?'<p><span class="dot green-dot"></span><b>Verde:</b> WASD · X para patear</p><p><span class="dot blue-dot"></span><b>Azul:</b> Flechas · M para patear</p>':mode==="practice"?`<p><span class="dot green-dot"></span><b>Vos (Verde):</b> WASD · X para patear</p><p><span class="dot blue-dot"></span><b>Bot Azul:</b> ${botDifficulty==="beginner"?"Debutante":botDifficulty==="pro"?"Professional":"GOAT"}</p>`:mode==="host"?'<p><span class="dot green-dot"></span><b>Vos (Verde):</b> WASD · X para patear</p><p><span class="dot blue-dot"></span>Tu rival también usa WASD · X</p>':'<p><span class="dot blue-dot"></span><b>Vos (Azul):</b> WASD · X para patear</p><p><span class="dot green-dot"></span>Tu rival controla Verde</p>';}
function startGame(next){
  mode=next;scores={green:0,blue:0};kickoffUntil=0;botThinkAt=0;
  matchTimeLimit = parseInt($("time-input").value) || 0;
  matchStartTime = performance.now();
  matchEnded = false;
  currentBallStyle = parseInt($("ball-style").value) || 0;
  const myColor = $("my-color").value;
// Seguros para variables de conexión
window.lastInputSent = window.lastInputSent || 0;
window.lastStateSent = window.lastStateSent || 0;

function startGame(next){
  try {
    mode=next;
    if(typeof scores !== 'undefined') scores={green:0,blue:0};
    if(typeof kickoffUntil !== 'undefined') kickoffUntil=0;
    if(typeof botThinkAt !== 'undefined') botThinkAt=0;
    
    const timeInput = document.getElementById("time-input");
    matchTimeLimit = timeInput ? parseInt(timeInput.value) || 0 : 0;
    matchStartTime = performance.now();
    matchEnded = false;
    
    const ballInput = document.getElementById("ball-style");
    currentBallStyle = ballInput ? parseInt(ballInput.value) || 0 : 0;
    
    const colorInput = document.getElementById("my-color");
    const myColor = colorInput ? colorInput.value : "#45df6a";

    const localBlue = next === "local";
    let limitSpeed = 410;
    
    if (next === "practice" && typeof botProfiles !== 'undefined' && typeof botDifficulty !== 'undefined') {
        limitSpeed = botProfiles[botDifficulty].speed;
    }

    if(typeof players !== 'undefined' && players[1]) {
      Object.assign(players[1],{
        controls: localBlue ? ["arrowup","arrowdown","arrowleft","arrowright"] : ["w","s","a","d"],
        kick: localBlue ? "m" : "x",
        kickReady: true,
        maxSpeed: limitSpeed
      });
    }
    
    if(typeof players !== 'undefined') {
        if(mode === "guest" && players[1]) {
          players[1].color = myColor; players[1].dark = myColor;
        } else if(players[0]) {
          players[0].color = myColor; players[0].dark = myColor;
        }
    }
    
    if(typeof resetPositions === 'function') resetPositions();
    if(typeof updateScore === 'function') updateScore();
    if(typeof setControls === 'function') setControls();
    if(typeof message === 'function') message("¡A jugar!");
    if(typeof show === 'function') show("match");
  } catch(e) { console.error("Error en startGame:", e); }
}
function closeNetwork(){if(connection)connection.close();if(peer)peer.destroy();if(localChannel)localChannel.close();connection=peer=localChannel=null;}
function returnMenu(){closeNetwork();mode=null;localKeys.clear();remoteKeys.clear();history.replaceState({},"",location.pathname);show("menu");}
$("local-button").onclick=()=>startGame("local");
$("online-button").onclick=()=>{show("lobby");$("lobby-status").textContent="Creá una partida para obtener tu enlace.";$("create-button").disabled=false;$("create-button").classList.remove("hidden");$("invite-box").classList.add("hidden");};
$("practice-button").onclick=()=>show("practice");
document.querySelectorAll(".difficulty-button").forEach(button=>button.onclick=()=>{botDifficulty=button.dataset.difficulty;startGame("practice");});
document.querySelectorAll(".back-button").forEach(b=>b.onclick=returnMenu);
$("create-button").onclick=createMatch;
$("copy-button").onclick=async()=>{try{await navigator.clipboard.writeText($("invite-link").value);$("copy-button").textContent="¡ENLACE COPIADO!";setTimeout(()=>$("copy-button").textContent="COPIAR ENLACE",1400);}catch{$("invite-link").select();document.execCommand("copy");}};
function createMatch(){if(location.protocol==="file:"){const id=`local-${crypto.randomUUID()}`,url=new URL(location.href);url.search="";url.searchParams.set("join",id);$("invite-link").value=url.toString();$("invite-box").classList.remove("hidden");$("lobby-status").textContent="Sala local creada. Abrí este enlace en otra pestaña.";connection=createLocalConnection(id,true);configureConnection(true);return;}if(!window.Peer){$("lobby-status").textContent="No se pudo cargar la conexión. Revisá tu internet.";return;}$("create-button").disabled=true;$("lobby-status").textContent="Creando tu sala…";peer=new Peer();peer.on("open",id=>{const url=new URL(location.href);url.search="";url.searchParams.set("join",id);$("invite-link").value=url.toString();$("invite-box").classList.remove("hidden");$("lobby-status").textContent="Sala creada. Compartí el enlace.";});peer.on("connection",conn=>{if(connection)return conn.close();connection=conn;configureConnection(true);});peer.on("error",()=>{$("lobby-status").textContent="No se pudo crear la sala. Intentá nuevamente.";$("create-button").disabled=false;});}
function joinMatch(id){if(!window.Peer){show("lobby");$("lobby-status").textContent="No se pudo cargar la conexión. Revisá tu internet.";return;}show("lobby");$("create-button").classList.add("hidden");$("lobby-status").textContent="Conectando a la partida…";peer=new Peer();peer.on("open",()=>{connection=peer.connect(id,{reliable:true});configureConnection(false);});peer.on("error",()=>$("lobby-status").textContent="No fue posible conectar. Puede que la sala haya cerrado.");}
function createLocalConnection(id,host){localChannel=new BroadcastChannel(`mini-haxball-${id}`);return{open:true,isLocalHost:host,send:data=>localChannel.postMessage(data),on:(event,callback)=>{if(event==="data")localChannel.addEventListener("message",e=>callback(e.data));if(event==="open"&&!host)queueMicrotask(callback);},close:()=>localChannel.close()};}
function joinLocalMatch(id){show("lobby");$("create-button").classList.add("hidden");$("lobby-status").textContent="Entrando a la partida local…";connection=createLocalConnection(id,false);configureConnection(false);connection.send({type:"hello"});}
function configureConnection(host){
  connection.on("open",()=>{if(host)startGame("host");else{mode="guest";setControls();show("match");message("Conectado. Esperando al anfitrión…");}});
  connection.on("data",data=>{
    if(data.type==="hello"&&connection?.isLocalHost&&mode!=="host")startGame("host");
    if(data.type==="input"&&mode==="host")data.down?remoteKeys.add(data.key):remoteKeys.delete(data.key);
    if(data.type==="inputState"&&mode==="host"){
      remoteKeys.clear();
      data.keys.forEach(key=>remoteKeys.add(key));
      if(data.color) { players[1].color = data.color; players[1].dark = data.color; }
    }
    if(data.type==="state"&&mode==="guest")applyState(data);
  });
  connection.on("close",()=>{if(mode==="host"||mode==="guest")message("Tu rival se desconectó.");});
  connection.on("error",()=>message("Se perdió la conexión."));
}
const relevant=new Set(["w","a","s","d","x","arrowup","arrowdown","arrowleft","arrowright","m","r"]);
window.addEventListener("keydown",e=>handleKey(e,true));window.addEventListener("keyup",e=>handleKey(e,false));window.addEventListener("blur",()=>localKeys.clear());
function handleKey(e,down){const key=e.key.toLowerCase();if(!relevant.has(key))return;e.preventDefault();localKeys[down?"add":"delete"](key);if(mode==="guest"&&connection?.open&&["w","a","s","d","x"].includes(key))connection.send({type:"input",key,down});if(mode==="local"&&key==="r"&&down&&!e.repeat){scores={green:0,blue:0};updateScore();resetPositions();message("¡Marcador reiniciado!");}}
/* LÓGICA DEL JOYSTICK Y BOTÓN PATEAR */
const joystickZone = $("joystick-zone"), joystickStick = $("joystick-stick"), kickBtn = $("kick-button");
let joystickActive = false, touchId = null, joystickCenter = { x: 0, y: 0 };

if (joystickZone) {
  joystickZone.addEventListener("touchstart", e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    joystickActive = true;
    const rect = joystickZone.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystick(touch);
  }, { passive: false });

  window.addEventListener("touchmove", e => {
    if (!joystickActive) return;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === touchId) {
        updateJoystick(e.touches[i]);
        break;
      }
    }
  }, { passive: false });

  const endJoystick = e => {
    if (!joystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        joystickActive = false;
        touchId = null;
        joystickStick.style.transform = `translate(0px, 0px)`;
        ["w", "a", "s", "d"].forEach(k => localKeys.delete(k));
        break;
      }
    }
  };

  window.addEventListener("touchend", endJoystick);
  window.addEventListener("touchcancel", endJoystick);
}

function updateJoystick(touch) {
  const dx = touch.clientX - joystickCenter.x;
  const dy = touch.clientY - joystickCenter.y;
  const dist = Math.hypot(dx, dy);
  const maxRadius = 40;
  const angle = Math.atan2(dy, dx);
  
  const clampedDist = Math.min(dist, maxRadius);
  const stickX = Math.cos(angle) * clampedDist;
  const stickY = Math.sin(angle) * clampedDist;
  
  joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;

  const deadzone = 10;
  if (dist < deadzone) {
    ["w", "a", "s", "d"].forEach(k => localKeys.delete(k));
    return;
  }

  if (dx < -10) localKeys.add("a"); else localKeys.delete("a");
  if (dx > 10) localKeys.add("d"); else localKeys.delete("d");
  if (dy < -10) localKeys.add("w"); else localKeys.delete("w");
  if (dy > 10) localKeys.add("s"); else localKeys.delete("s");

  if (mode === "guest" && connection?.open) {
    ["w", "a", "s", "d"].forEach(key => {
      connection.send({ type: "input", key, down: localKeys.has(key) });
    });
  }
}

if (kickBtn) {
  kickBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    localKeys.add("x");
    if (mode === "guest" && connection?.open) {
      connection.send({ type: "input", key: "x", down: true });
    }
  }, { passive: false });

  const releaseKick = e => {
    e.preventDefault();
    localKeys.delete("x");
    if (mode === "guest" && connection?.open) {
      connection.send({ type: "input", key: "x", down: false });
    }
  };

  kickBtn.addEventListener("touchend", releaseKick);
  kickBtn.addEventListener("touchcancel", releaseKick);
}
function clamp(body,max){const s=Math.hypot(body.vx,body.vy);if(s>max){body.vx=body.vx/s*max;body.vy=body.vy/s*max;}}
function updatePlayer(p,dt,input){const [up,down,left,right]=p.controls;let ax=(input.has(right)?1:0)-(input.has(left)?1:0),ay=(input.has(down)?1:0)-(input.has(up)?1:0);if(ax||ay){const d=Math.hypot(ax,ay);ax/=d;ay/=d;}p.vx+=ax*1280*dt;p.vy+=ay*1280*dt;p.vx*=Math.pow(.0008,dt);p.vy*=Math.pow(.0008,dt);clamp(p,p.maxSpeed||410);p.x+=p.vx*dt;p.y+=p.vy*dt;p.x=Math.max(field.left+p.r,Math.min(field.right-p.r,p.x));p.y=Math.max(field.top+p.r,Math.min(field.bottom-p.r,p.y));if(input.has(p.kick)&&p.kickReady)kick(p);if(!input.has(p.kick))p.kickReady=true;}
function kick(p){p.kickReady=false;const dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy)||1;if(d<p.r+ball.r+43){ball.vx+=dx/d*510+p.vx*.28;ball.vy+=dy/d*510+p.vy*.28;clamp(ball,720);}}
function collide(a,b,restitution=.72){let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d>=min)return;if(!d){dx=1;d=1;}const nx=dx/d,ny=dy/d,ia=1/a.mass,ib=1/b.mass,overlap=min-d;a.x-=nx*overlap*ia/(ia+ib);a.y-=ny*overlap*ia/(ia+ib);b.x+=nx*overlap*ib/(ia+ib);b.y+=ny*overlap*ib/(ia+ib);const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const imp=-(1+restitution)*rel/(ia+ib);a.vx-=imp*ia*nx;a.vy-=imp*ia*ny;b.vx+=imp*ib*nx;b.vy+=imp*ib*ny;}}
function updateBall(dt){ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.vx*=Math.pow(.22,dt);ball.vy*=Math.pow(.22,dt);clamp(ball,780);const mouth=ball.y>field.goalTop&&ball.y<field.goalBottom;if(ball.y-ball.r<field.top){ball.y=field.top+ball.r;ball.vy=Math.abs(ball.vy)*.83;}if(ball.y+ball.r>field.bottom){ball.y=field.bottom-ball.r;ball.vy=-Math.abs(ball.vy)*.83;}if(!mouth&&ball.x-ball.r<field.left){ball.x=field.left+ball.r;ball.vx=Math.abs(ball.vx)*.83;}if(!mouth&&ball.x+ball.r>field.right){ball.x=field.right-ball.r;ball.vx=-Math.abs(ball.vx)*.83;}if(mouth&&ball.x+ball.r<field.left)score("blue");if(mouth&&ball.x-ball.r>field.right)score("green");}
function score(team){if(kickoffUntil)return;scores[team]++;updateScore();message(`¡GOL DE ${team==="green"?"VERDE":"AZUL"}!`);kickoffUntil=performance.now()+1300;setTimeout(()=>{resetPositions();message("¡A jugar!");kickoffUntil=0;},1300);}
function updateBot(now){const p=players[1],rival=players[0],profile=botProfiles[botDifficulty],goal={x:field.left-25,y:H/2};if(now>=botThinkAt){const gx=goal.x-ball.x,gy=goal.y-ball.y,gd=Math.hypot(gx,gy)||1,nearRival=Math.hypot(rival.x-ball.x,rival.y-ball.y)<120,side=nearRival?(rival.y<ball.y?1:-1):Math.sin(now/360)*.45;botTarget={x:ball.x-gx/gd*profile.offset,y:ball.y-gy/gd*profile.offset*.3+side*profile.dribble};botTarget.x=Math.max(field.left+p.r,Math.min(field.right-p.r,botTarget.x));botTarget.y=Math.max(field.top+p.r,Math.min(field.bottom-p.r,botTarget.y));botThinkAt=now+profile.reaction;}remoteKeys.clear();if(botTarget.x<p.x-9)remoteKeys.add("a");if(botTarget.x>p.x+9)remoteKeys.add("d");if(botTarget.y<p.y-9)remoteKeys.add("w");if(botTarget.y>p.y+9)remoteKeys.add("s");const close=Math.hypot(ball.x-p.x,ball.y-p.y)<p.r+ball.r+42,behindBall=p.x>ball.x-8;if(close&&behindBall)remoteKeys.add("x");}
function updateTimerDisplay(ms) {
    if (ms < 0) { $("timer-display").textContent = "∞"; return; }
    let totalSec = Math.ceil(ms / 1000);
    let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    let s = (totalSec % 60).toString().padStart(2, '0');
    $("timer-display").textContent = `${m}:${s}`;
  function updateTimerDisplay(ms) {
  try {
    const reloj = document.getElementById("timer-display");
    if (!reloj) return;
    if (ms < 0) { reloj.textContent = "∞"; return; }
    let totalSec = Math.ceil(ms / 1000);
    let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    let s = (totalSec % 60).toString().padStart(2, '0');
    reloj.textContent = `${m}:${s}`;
  } catch(e) { console.error("Error timer:", e); }
}

function update(dt,now){
  try {
    if(mode==="guest"){
      if(connection?.open && now - (window.lastInputSent||0) > 33){
        const colorInput = document.getElementById("my-color");
        connection.send({
          type:"inputState",
          keys:[...localKeys].filter(key=>["w","a","s","d","x"].includes(key)),
          color: colorInput ? colorInput.value : "#329cf0"
        });
        window.lastInputSent=now;
      }
      return;
    }
    
    if(!mode || (typeof kickoffUntil !== 'undefined' && kickoffUntil) || matchEnded) return;

    let timeLeftMs = -1;
    if (matchTimeLimit > 0) {
       timeLeftMs = matchTimeLimit * 60000 - (now - matchStartTime);
       updateTimerDisplay(timeLeftMs);
       if (timeLeftMs <= 0) {
           matchEnded = true;
           if(typeof message === 'function') message("¡TIEMPO AGOTADO!");
           updateTimerDisplay(0);
           setTimeout(() => { if(typeof returnMenu === 'function') returnMenu(); }, 4000);
           return;
       }
    } else {
       updateTimerDisplay(-1);
    }

    if(mode==="practice" && typeof updateBot === 'function') updateBot(now);
    if(typeof updatePlayer === 'function' && typeof players !== 'undefined') {
        if(players[0]) updatePlayer(players[0],dt,localKeys);
        if(players[1]) updatePlayer(players[1],dt,mode==="local"?localKeys:(typeof remoteKeys !== 'undefined' ? remoteKeys : localKeys));
    }
    if(typeof collide === 'function' && typeof players !== 'undefined' && players[0] && players[1]) {
        collide(players[0],players[1],.5);
        if(typeof ball !== 'undefined') players.forEach(p=>collide(p,ball));
    }
    if(typeof updateBall === 'function') updateBall(dt);
    
    if(mode==="host" && connection?.open && now - (window.lastStateSent||0) > 33){
      const msgEl = document.getElementById("message");
      connection.send({
        type:"state",
        ball: typeof ball !== 'undefined' ? {...ball} : {},
        players: typeof players !== 'undefined' ? players.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,color:p.color})) : [],
        scores: typeof scores !== 'undefined' ? scores : {green:0, blue:0}, 
        message: msgEl ? msgEl.textContent : "¡A jugar!", 
        timeLeft: timeLeftMs, 
        ballStyle: typeof currentBallStyle !== 'undefined' ? currentBallStyle : 0
      });
      window.lastStateSent=now;
    }
  } catch(e) { console.error("Error en update:", e); }
}

function applyState(s){
  try {
    if(s.ball && typeof ball !== 'undefined') Object.assign(ball,s.ball);
    if(s.players && typeof players !== 'undefined') {
        s.players.forEach((p,i)=>{
          if(players[i]) {
              players[i].x = p.x; players[i].y = p.y; 
              players[i].vx = p.vx; players[i].vy = p.vy;
              if(p.color) { players[i].color = p.color; players[i].dark = p.color; }
          }
        });
    }
    if(s.scores && typeof scores !== 'undefined') scores=s.scores; 
    if(typeof updateScore === 'function') updateScore(); 
    if(s.message && typeof message === 'function') message(s.message);
    if(typeof s.ballStyle !== 'undefined') currentBallStyle = s.ballStyle;
    if(typeof s.timeLeft !== 'undefined') updateTimerDisplay(s.timeLeft);
  } catch(e) { console.error("Error en applyState:", e); }
}
function line(x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawField(){ctx.clearRect(0,0,W,H);ctx.fillStyle="#2e9a55";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(255,255,255,.035)";for(let x=field.left;x<field.right;x+=100)ctx.fillRect(x,field.top,50,field.bottom-field.top);ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=4;ctx.strokeRect(field.left,field.top,field.right-field.left,field.bottom-field.top);line(W/2,field.top,W/2,field.bottom);ctx.beginPath();ctx.arc(W/2,H/2,84,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,5,0,Math.PI*2);ctx.fillStyle="white";ctx.fill();ctx.strokeStyle="rgba(245,250,255,.9)";ctx.lineWidth=4;ctx.strokeRect(field.left-field.depth,field.goalTop,field.depth,field.goalBottom-field.goalTop);ctx.strokeRect(field.right,field.goalTop,field.depth,field.goalBottom-field.goalTop);}
function drawPlayer(p){ctx.save();ctx.translate(p.x,p.y);ctx.beginPath();ctx.arc(2,4,p.r,0,Math.PI*2);ctx.fillStyle="rgba(0,0,0,.18)";ctx.fill();ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.strokeStyle=p.dark;ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(-7,-8,7,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,.32)";ctx.fill();ctx.restore();}
function drawBall() {
  try {
    if(typeof ball === 'undefined' || typeof ctx === 'undefined') return;
    
    ctx.save();
    ctx.translate(ball.x, ball.y);
    
    ctx.beginPath();
    ctx.arc(2, 3, ball.r, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,.22)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI*2);
    
    const style = typeof currentBallStyle !== 'undefined' ? currentBallStyle : 0;
    switch(style) {
      case 1: 
        ctx.fillStyle = "#e31010"; ctx.fill();
        ctx.fillStyle = "#111"; ctx.fillRect(-ball.r, 0, ball.r*2, ball.r); 
        ctx.strokeStyle = "#fff";
        break;
      case 2: 
        ctx.fillStyle = "#75aadb"; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(-ball.r, -ball.r/3, ball.r*2, ball.r/1.5); 
        ctx.strokeStyle = "#e8b031"; 
        break;
      case 3: 
        ctx.fillStyle = "#ff4500"; ctx.fill();
        ctx.fillStyle = "#ffd700"; ctx.beginPath(); ctx.arc(0,0,ball.r/1.8,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#8b0000";
        break;
      case 4: 
        ctx.fillStyle = "#0ff"; ctx.fill();
        ctx.strokeStyle = "#f0f"; ctx.lineWidth = 3;
        break;
      case 5: 
        ctx.fillStyle = "#ffd700"; ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 3;
        break;
      case 6: 
        ctx.fillStyle = "#ccff00"; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-7, -7, 10, 0, Math.PI/2); ctx.stroke(); 
        break;
      case 7: 
        ctx.fillStyle = "#ff6600"; ctx.fill();
        ctx.strokeStyle = "#111"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -ball.r); ctx.lineTo(0, ball.r); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(-ball.r, 0); ctx.lineTo(ball.r, 0); ctx.stroke();
        break;
      case 8: 
        ctx.fillStyle = "#ff3333"; ctx.fill();
        ctx.strokeStyle = "#33cc33"; ctx.lineWidth = 4;
        ctx.fillStyle = "#111"; ctx.fillRect(-2, -2, 4, 4); 
        break;
      case 9: 
        ctx.fillStyle = "#222"; ctx.fill();
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
        break;
      default: 
        ctx.fillStyle = "#f8f8f3"; ctx.fill();
        ctx.strokeStyle = "#37444a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,4.5,0,Math.PI*2); ctx.fillStyle="#334047"; ctx.fill();
        break;
    }
    
    if(style !== 4 && style !== 7) {
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();
  } catch(e) { console.error("Error en drawBall:", e); }
}
/* BUCLE PRINCIPAL DEL JUEGO (GAME LOOP) */
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.1);
  lastTime = now;

  try {
    if (typeof update === 'function') update(dt, now);
    
    // Dibuja la cancha, jugadores y pelota
    if (typeof draw === 'function') {
      draw();
    } else {
      if (typeof drawPitch === 'function') drawPitch();
      if (typeof drawPlayers === 'function') drawPlayers();
      if (typeof drawBall === 'function') drawBall();
    }
  } catch (e) {
    console.error("Error en loop:", e);
  }

  requestAnimationFrame(loop);
}

// Arranca el bucle
requestAnimationFrame(loop);
