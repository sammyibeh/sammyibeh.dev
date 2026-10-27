/* sammyibeh.dev · "Shell": the whole site is a terminal session. Pages work without this script. */
import {XP} from '../../data/experience';
import {KEY,greeter} from './hello.js';

/* =================== content =================== */
const nextHello=greeter(); // English first, then weighted random, see hello.js
/* page key → [href, prompt path, logo route] */
const PAGES={home:['/','~',''],about:['/about/','~/about','/about'],experience:['/experience/','~/experience','/experience'],contact:['/contact/','~/contact','/contact']};
const BYPATH=Object.fromEntries(Object.entries(PAGES).map(([k,v])=>[v[0],k]));
/* the page key an in-site link points at, or undefined */
const keyOf=href=>{const u=new URL(href,location.href);if(u.origin!==location.origin)return;return BYPATH[u.pathname.replace(/\/?$/,'/')]};
let np=null; // latest from /api/now-playing (Apple Music, via the poller), or null

/* =================== helpers =================== */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const H=document.documentElement,S=window.__store;
const PAGE=H.dataset.page;
const mq=matchMedia('(prefers-reduced-motion: reduce)');
let motion=H.classList.contains('motion');
mq.addEventListener('change',()=>{motion=!mq.matches;H.classList.toggle('motion',motion)});
const B=()=>window.Buddy;
const here=()=>(PAGES[PAGE]||['','~'])[1];
function toast(msg){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),4200)}
const lev=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]};
console.assert(lev('help','hlep')===2&&lev('cat','cat')===0,'lev self-check');

async function typeTo(el,target,ms=30){
  const tok=el._tok=(el._tok||0)+1;
  if(!motion){el.textContent=target;return true}
  let cur=el.textContent;
  while(!target.startsWith(cur)){cur=cur.slice(0,-1);el.textContent=cur;await sleep(ms*.6);if(el._tok!==tok)return false}
  while(cur!==target){cur=target.slice(0,cur.length+1);el.textContent=cur;await sleep(ms);if(el._tok!==tok)return false}
  return true; // false above: a newer call took over
}
/* block cursors: solid while text is typed, then two blinks and gone (restarted on each call) */
function caret(c,on){if(!c)return;c.classList.toggle('on',on);c.classList.remove('done');if(!on){void c.offsetWidth;c.classList.add('done')}}
const GLYPHS='!<>-_\\/[]{}=+*^?#01';
function decode(el,dur=700){
  const txt=el.dataset.text||(el.dataset.text=el.textContent);
  if(!motion){el.textContent=txt;return Promise.resolve()}
  return new Promise(res=>{const t0=performance.now();const f=t=>{const k=(t-t0)/dur;
    el.textContent=[...txt].map((c,i)=>c===' '||k>i/txt.length*0.85+0.15?c:GLYPHS[(Math.random()*GLYPHS.length)|0]).join('');
    k<1?requestAnimationFrame(f):(el.textContent=txt,res())};requestAnimationFrame(f)});
}

/* London clock with an honest status line (gym hours included) */
function london(){
  const d=new Date(),p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'}).formatToParts(d).map(x=>[x.type,x.value]));
  const h=+p.hour,day=p.weekday,hm=`${p.hour}:${p.minute}`;
  const m=h*60+ +p.minute,gym=day==='Sat'?(m>=480&&m<600):day!=='Sun'&&m>=330&&m<480; // weekdays 05:30–08:00, lighter Saturday morning
  const s=gym?'at the gym, probably':h>=18&&h<20?'cooking, probably':h<6?'probably asleep (or debugging)':h<9?'coffee first, opinions later':h<12?'deep work, headphones on':h<14?'lunch, allegedly':h<18?'shipping things':h<21?'music up, laptop not quite closed':'one more commit, then bed';
  return {hm,s};
}
const ago=iso=>{const m=Math.max(1,Math.round((Date.now()-Date.parse(iso))/60000));return m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`};
/* home "on repeat" pill: Apple Music via /api/now-playing. Hidden on null or any error; refreshed while the tab is visible. */
function nowPlaying(){
  const pill=$('[data-np]');
  const load=async()=>{
    try{const r=await fetch('/api/now-playing');np=r.ok?await r.json():null}catch{np=null}
    if(!pill)return;
    if(!np?.track){pill.hidden=true;return}
    $('.np-l',pill).textContent=np.nowPlaying?'on repeat:':'last played:';
    const label=`${np.track} — ${np.artist}`; // a link only when Apple gave us one, so there's never an href-less anchor
    $('.np-t',pill).replaceChildren(np.url?Object.assign(document.createElement('a'),{href:np.url,target:'_blank',rel:'noopener noreferrer',innerHTML:`${esc(label)}<span class="sr"> (opens in new tab)</span>`}):label);
    $('.np-ago',pill).textContent=!np.nowPlaying&&np.playedAt?` · ${ago(np.playedAt)}`:'';
    pill.hidden=false;
  };
  setTimeout(load,300);
  setInterval(()=>{if(!document.hidden)load()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
}
function clocks(){const u=()=>{const {hm,s}=london();$$('[data-london]').forEach(el=>el.textContent=`London ${hm} · ${s}`)};u();setInterval(u,30000)}

/* =================== theme =================== */
function setTheme(t,from){
  const apply=()=>{H.dataset.theme=t;S.set('theme',t);$$('.tt').forEach(b=>{b.setAttribute('aria-checked',t==='dark');$('.lbl',b).textContent=t});railUpdate()};
  if(motion&&document.startViewTransition&&from){const r=from.getBoundingClientRect();H.style.setProperty('--vx',r.left+r.width/2+'px');H.style.setProperty('--vy',r.top+r.height/2+'px');document.startViewTransition(apply)}else apply();
}
function themeToggle(){$$('.tt').forEach(b=>{b.setAttribute('aria-checked',H.dataset.theme==='dark');$('.lbl',b).textContent=H.dataset.theme;b.addEventListener('click',()=>setTheme(H.dataset.theme==='dark'?'light':'dark',b))})}

/* =================== logo: {sammyibeh.dev} with a live caret =================== */
function logo(){
  const a=$('.logo');if(!a)return;
  const r=$('.r',a),c=$('.cur',a),route=(PAGES[PAGE]||[,,''])[2];
  const type=(to,ms)=>{caret(c,true);typeTo(r,to,ms).then(ok=>ok&&caret(c,false))};
  if(motion&&!H.classList.contains('arrive')){r.textContent='';caret(c,true);sleep(350).then(()=>type(route,45))}else caret(c,false);
  $$('a[href^="/"]').forEach(l=>{const k=keyOf(l.href);if(!k||l===a)return;const to=PAGES[k][2];
    l.addEventListener('pointerenter',()=>type(to,22));l.addEventListener('focus',()=>type(to,22));
    l.addEventListener('pointerleave',()=>type(route,22));l.addEventListener('blur',()=>type(route,22))});
}

/* =================== email rail: per-segment adaptive text =================== */
/* Any element with data-surface and a --surface tone different from the page's --tone flips the rail text
   wherever it sits behind it. Geometry is exact: the surface's polygon (data-poly, in %) is clipped to the
   rail with Sutherland–Hodgman and becomes a clip-path on the alternate text layer. */
function clipPoly(pts,r){
  const E=[[p=>p[0]>=r.l,(a,b)=>[r.l,a[1]+(r.l-a[0])/(b[0]-a[0])*(b[1]-a[1])]],[p=>p[0]<=r.r,(a,b)=>[r.r,a[1]+(r.r-a[0])/(b[0]-a[0])*(b[1]-a[1])]],
           [p=>p[1]>=r.t,(a,b)=>[a[0]+(r.t-a[1])/(b[1]-a[1])*(b[0]-a[0]),r.t]],[p=>p[1]<=r.b,(a,b)=>[a[0]+(r.b-a[1])/(b[1]-a[1])*(b[0]-a[0]),r.b]]];
  for(const[ins,x]of E){const out=[];for(let i=0;i<pts.length;i++){const c=pts[i],p=pts[(i+pts.length-1)%pts.length];
    if(ins(c)){if(!ins(p))out.push(x(p,c));out.push(c)}else if(ins(p))out.push(x(p,c))}pts=out;if(!pts.length)break}
  return pts;
}
{const t=clipPoly([[0,10],[10,10],[10,0]],{l:5,r:20,t:0,b:20});console.assert(t.length===4&&t.some(p=>p[0]===5&&p[1]===10)&&t.some(p=>p[0]===5&&p[1]===5),'clipPoly self-check')}
let railRaf=0;
function railCompute(){
  railRaf=0;const alt=$('.rail .alt');if(!alt||!alt.offsetParent)return;
  const rr=alt.getBoundingClientRect(),R={l:rr.left,r:rr.right,t:rr.top,b:rr.bottom},page=getComputedStyle(H).getPropertyValue('--tone').trim();
  let d='';
  for(const s of $$('[data-surface]')){const tone=getComputedStyle(s).getPropertyValue('--surface').trim();if(!tone||tone===page)continue;
    const b=s.getBoundingClientRect();if(b.bottom<R.t||b.top>R.b||b.right<R.l||b.left>R.r)continue;
    const pts=(s.dataset.poly||'0,0 100,0 100,100 0,100').split(' ').map(q=>q.split(',').map(Number)).map(([x,y])=>[b.left+x/100*b.width,b.top+y/100*b.height]);
    const c=clipPoly(pts,R);if(c.length>2)d+='M'+c.map(([x,y])=>`${(x-R.l).toFixed(1)} ${(y-R.t).toFixed(1)}`).join(' L')+' Z ';}
  alt.style.clipPath=`path('${d||'M0 0Z'}')`;
}
function railUpdate(){railRaf||(railRaf=requestAnimationFrame(railCompute))}
function rail(){
  if(!$('.rail'))return;
  addEventListener('scroll',railUpdate,{passive:true});addEventListener('resize',railUpdate);
  const t0=performance.now();(function loop(){railCompute();if(performance.now()-t0<3500)requestAnimationFrame(loop)})(); // follow the band's entrance
}

/* =================== shell engine =================== */
const BLAME=[['^a1f3c9e','2014-01','started "playing" with code. never stopped.'],['7c8e39c','2019-05','{braces} added to the logo. non-negotiable.'],['3e1b0aa','2019-05','navy + mint. amber came later.'],['55d15fb','2026-10','cursor glow: follows you, respectfully.'],['b20c7de','2026-10','prefers-reduced-motion honoured. calm is a feature.'],['c47f00d','2026-10','Sully was granted admin. nobody voted.'],['d7334a3','2026-10','you ran git blame on a portfolio. noted.']];
const COOK=['mise en place: done. the smoke alarm and I are on speaking terms.','tonight\u2019s special: whatever\u2019s in the fridge, plated with confidence.','seasoning to taste. tasting to season. repeat.','Sully has requested a tasting menu. request denied.'];
const LIFTS=['1 rep. the other 11 are implied.','rest day. muscles are compiling.','today’s split: push, pull, git push.','form check: questionable. effort: excellent.'];
function Shell(scr,inp,{cwd='~',files=[],onExit}={}){
  const hist=[];let hi=0,vim=false;
  const print=h=>{scr.insertAdjacentHTML('beforeend',h);scr.scrollTop=scr.scrollHeight};
  const echo=c=>print(`<p><span class="dim">sammy@ibeh:${cwd}$</span> ${esc(c)}</p>`);
  const pagesLs=()=>`<ul class="files">${Object.values(PAGES).map(([,p])=>`<li><button type="button" class="f" data-cmd="cd ${p}">${p==='~'?'~/':p+'/'}</button></li>`).join('')}</ul>`;
  const filesLs=()=>`<ul class="files">${files.map(f=>`<li><button type="button" class="f" data-cmd="cat ${f}">${f}</button></li>`).join('')}</ul>`;
  const catf=x=>`<h4># ${x.role} @ ${x.co}</h4><p class="dim">${x.when} · ${x.place}</p>${x.pts.map(p=>`<p>- ${esc(p)}</p>`).join('')}<p>&nbsp;</p>`;
  const CMDS={
    help:()=>`<p>try: <span class="hi">ls</span> · <span class="hi">cd &lt;page&gt;</span> · ${files.length?'<span class="hi">cat &lt;file&gt;</span> · ':''}<span class="hi">whoami</span> · <span class="hi">time</span> · <span class="hi">music</span> · <span class="hi">cook</span> · <span class="hi">lift</span> · <span class="hi">theme</span> · <span class="hi">blame</span> · <span class="hi">hire</span> · <span class="hi">clear</span> · <span class="hi">exit</span></p><p class="dim">some commands aren’t listed. one of them is called Sully.</p>`,
    ls:()=>files.length?filesLs():pagesLs(),
    pwd:()=>`<p>/home/sammy${cwd.slice(1)}</p>`,
    whoami:()=>'<p>sammy: senior developer at the Government Digital Service. ex-CTO, programmer by vocation. lifts, jokes, music always on. employed by Sully.</p>',
    time:()=>{const {hm,s}=london();return `<p>London ${hm} · ${s}</p>`},date:()=>CMDS.time(),
    music:()=>{B()?.react('music',8000);return `<p>♫ ${np?`${np.nowPlaying?'on repeat':'last played'}: ${esc(np.track)} — ${esc(np.artist)}`:'something with the volume at a tasteful level.'}</p><p class="dim">taste is personal. volume is tasteful.</p>`},
    cook:()=>{B()?.react('cook',9000);return `<p>${COOK[(Math.random()*COOK.length)|0]}</p>`},
    lift:()=>{B()?.react(Math.random()<.5?'curl':'press',7000);return `<p>${LIFTS[(Math.random()*LIFTS.length)|0]}</p>`},gym:()=>CMDS.lift(),
    theme:a=>{if(!a)return `<p>themes: dark · light. currently ${H.dataset.theme}.</p>`;if(a!=='dark'&&a!=='light')return `<p>theme: try dark or light</p>`;setTheme(a);return `<p>theme → ${a}. bold choice.</p>`},
    blame:()=>`<div class="blame">${BLAME.map(([h,d,m])=>`<span class="h">${h}</span><span class="a">(Sammy ${d})</span><span>${m}</span>`).join('')}</div>`,
    hire:()=>{setTimeout(()=>go(PAGES.contact[0]),400);return '<p>opening ~/contact …</p>'},contact:()=>CMDS.hire(),
    cd:a=>{const k=(a||'~').replace(/^~\/?/,'').replace(/\/$/,'')||'home';if(k==='..')return '<p>you’re already at the top. it’s nice up here.</p>';if(!PAGES[k])return `<p>cd: no such directory: ${esc(a)}</p>`;if(k===PAGE)return '<p>you’re already here. mindfulness achieved.</p>';go(PAGES[k][0]);return ''},
    sudo:()=>'<p>sammy is not in the sudoers file. Sully is. this incident will be reported (to Sully).</p>',
    rm:()=>'<p>rm: refusing. this site is version-controlled, and so am I.</p>',
    coffee:()=>'<p>☕ brewing … done. productivity +12%, patience +3%.</p>',
    vim:()=>{vim=true;return '<p>you are now in vim. don’t panic. type <span class="hi">:q</span></p>'},
    ':q':()=>vim?(vim=false,'<p>you made it out. most don’t.</p>'):'<p>you weren’t in vim, but I respect the reflex.</p>',
    cheat:()=>'<p>↑ ↑ ↓ ↓ ← → ← → b a. you didn’t hear it from me.</p>',
    pet:()=>{B()?.catShow();return '<p>Sully purrs. +1 serotonin. (he allowed it. this time.)</p>'},
    buddy:a=>{const st=B()?.STATES||[];if(!st.includes(a)&&a!=='auto')return `<p>usage: buddy &lt;${st.join('|')}|auto&gt;</p>`;B().pin(a);return `<p>buddy → ${a}</p>`},
    history:()=>hist.map((c,i)=>`<p><span class="dim">${String(i+1).padStart(3)}</span>  ${esc(c)}</p>`).join(''),
    clear:()=>{scr.innerHTML='';return ''},
    exit:()=>{if(onExit){onExit();return ''}return '<p>there is no exit. only other pages. (try <span class="hi">cd ~</span>)</p>'},
    rownd:()=>'<p>Rownd: save together, take your turn.</p><p>Digital savings circles that help you build credit.</p><p class="dim">founder · in development · <a href="https://getrownd.com" target="_blank" rel="noopener noreferrer">getrownd.com<span class="sr"> (opens in new tab)</span></a></p>', // easter egg: kept out of help
    hello:()=>'<p>hello. type <span class="hi">hire</span> if there’s something to build.</p>',
    cat:a=>{if(!a){B()?.catShow();return '<p>=^.^= Sully has entered the chat. (admin privileges, as usual.)</p>'}
      if(!files.length)return `<p>cat: ${esc(a)}: try this in ~/experience</p>`;if(a==='*')return XP.map(catf).join('');const x=XP.find(x=>x.id+'.md'===a||x.id===a);return x?catf(x):`<p>cat: ${esc(a)}: No such file. Try <span class="hi">ls</span></p>`},
    git:a=>a==='blame'?CMDS.blame():a==='log'&&$('#tab-log')?($('#tab-log').click(),'<p>switched to the git log view.</p>'):'<p>git: try <span class="hi">git blame</span></p>'
  };
  CMDS.hi=CMDS.hello;
  function run(raw){const c=raw.trim();echo(c);if(!c)return;hist.push(c);hi=hist.length;
    const [cmd,...rest]=c.split(/\s+/),arg=rest.join(' ').replace(/^(\.\/)?(experience\/)?/,'');
    const f=CMDS[cmd.toLowerCase()];
    if(f){const o=f(arg);if(o)print(o);return}
    const near=Object.keys(CMDS).filter(k=>k.length>2).map(k=>[k,lev(k,cmd.toLowerCase())]).sort((a,b)=>a[1]-b[1]).find(([,d])=>d<=2)?.[0];
    print(`<p>zsh: command not found: ${esc(cmd)}.${near?` did you mean <span class="hi">${near}</span>?`:' try <span class="hi">help</span>.'}</p>`)}
  async function typeRun(c){if(!motion){run(c);return}print(`<p class="typing"><span class="dim">sammy@ibeh:${cwd}$</span> <span></span></p>`);const sp=$('.typing span:last-child',scr);
    for(let k=1;k<=c.length;k++){sp.textContent=c.slice(0,k);await sleep(45)}await sleep(180);$('.typing',scr).remove();run(c)}
  inp.form.addEventListener('submit',e=>{e.preventDefault();run(inp.value);inp.value=''});
  inp.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&inp.value){const sp=inp.value.includes(' '),[cmd,part='']=inp.value.split(/\s+/);
      const pool=cmd==='cat'?files:cmd==='cd'?Object.values(PAGES).map(p=>p[1]):cmd==='theme'?['dark','light']:cmd==='buddy'?(B()?.STATES||[]):Object.keys(CMDS);
      const m=sp?pool.filter(f=>f.startsWith(part)):pool.filter(f=>f.startsWith(cmd));
      if(m.length===1){e.preventDefault();inp.value=sp?`${cmd} ${m[0]}`:m[0]}
      else if(m.length>1){e.preventDefault();echo(inp.value);print(`<p class="dim">${m.map(esc).join('   ')}</p>`)}}
    else if(e.key==='ArrowUp'&&hi>0){e.preventDefault();inp.value=hist[--hi]}
    else if(e.key==='ArrowDown'){e.preventDefault();hi=Math.min(hist.length,hi+1);inp.value=hist[hi]||''}});
  scr.closest('[data-shell]').addEventListener('click',e=>{const b=e.target.closest('[data-cmd]');if(b)run(b.dataset.cmd)});
  return {run,typeRun,print};
}

/* global terminal: press / or ~ anywhere */
function quake(){
  const el=document.createElement('div');el.className='qt';el.dataset.shell='';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Site terminal');
  el.innerHTML=`<div class="inner"><div class="head" aria-hidden="true"><span>sammy@ibeh: ${here()} — zsh</span><span>esc closes · tab completes · ↑ history</span></div>
   <div class="scr" role="log" aria-live="polite"></div>
   <form autocomplete="off"><span aria-hidden="true">sammy@ibeh:${here()}$</span><label class="sr" for="qt-in">Site terminal command. Type help</label><input id="qt-in" spellcheck="false" autocapitalize="off"></form></div>`;
  el.hidden=true;document.body.append(el);
  let back=null;
  const isOpen=()=>el.classList.contains('open');
  const close=()=>{el.classList.remove('open');B()?.context('typing',false);setTimeout(()=>{if(!isOpen())el.hidden=true},motion?320:0);if(back)back.focus()};
  const sh=Shell($('.scr',el),$('input',el),{cwd:here(),onExit:close});
  sh.print('<p class="dim">welcome to the shell behind the site. type <span class="hi">help</span>, or <span class="hi">exit</span> to leave.</p>');
  const open=()=>{back=document.activeElement;el.hidden=false;B()?.context('typing',true);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('open')));setTimeout(()=>$('input',el).focus(),motion?60:0)};
  addEventListener('keydown',e=>{
    if(!isOpen()&&!e.target.closest('input,textarea,[contenteditable]')&&(e.key==='/'||e.key==='~'||e.key==='`')){e.preventDefault();open()}
    else if(isOpen()&&e.key==='Escape'){e.preventDefault();close()}
    else if(isOpen()&&e.key==='Tab'&&!$('input',el).value){e.preventDefault();$('input',el).focus()}
  });
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-terminal]'))open()});
  document.addEventListener('buddy:catwalk',()=>{if(isOpen())sh.print('<p>jjjjjjjjjjkkkkkkkk;;;;;;;;;;\'\'\'\'\'ffffff</p><p class="dim">(Sully walked across the keyboard. no commands were harmed.)</p>')});
}

/* konami: phosphor CRT moment (toggle) */
function konami(){
  const seq=['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];let i=0;
  addEventListener('keydown',e=>{if(e.target.closest('input,textarea'))return;const k=e.key.toLowerCase();i=k===seq[i]?i+1:(k===seq[0]?1:0);
    if(i===seq.length){i=0;B()?.react('flex',3000,'cheat code accepted. +30 lives.');toast('cheat code accepted · +30 lives, −0 bugs')}});
}

/* =================== shared page behaviour =================== */
function glow(){$$('.glow-zone').forEach(z=>z.addEventListener('pointermove',e=>{if(!motion)return;const r=z.getBoundingClientRect();z.style.setProperty('--mx',e.clientX-r.left+'px');z.style.setProperty('--my',e.clientY-r.top+'px')}))}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('in');io.unobserve(e.target);if(e.target.matches('h2.h'))decode(e.target,500)}),{threshold:.12});
const watch=()=>$$('.rv:not(.in), h2.h').forEach(el=>{if(el.matches('h2.h'))el.setAttribute('aria-label',el.textContent);io.observe(el)});
function progress(){const nav=$('.nav');let raf=0;const u=()=>{raf=0;const m=H.scrollHeight-innerHeight;nav.style.setProperty('--sp',m>0?(scrollY/m).toFixed(4):0)};addEventListener('scroll',()=>{raf||(raf=requestAnimationFrame(u))},{passive:true});u()}

/* page transitions: a terminal `cd` */
function go(href){
  const k=keyOf(href),to=k?PAGES[k][1]:'~';
  if(!motion){location.href=href;return}
  B()?.context('typing',true);
  const ov=document.createElement('div');ov.className='cd';ov.setAttribute('aria-hidden','true');
  ov.innerHTML=`<p>sammy@ibeh:${here()}$ <b></b><span class="cur"></span></p>`;document.body.append(ov);
  const b=$('b',ov),cmd=`cd ${to}`;let i=0;
  const t=setInterval(()=>{b.textContent=cmd.slice(0,++i);if(i>=cmd.length){clearInterval(t);setTimeout(()=>{S.set('cd','1',true);location.href=href},110)}},20);
}
function transitions(){
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target)return;
    const k=keyOf(a.href);if(!k||k===PAGE)return; // same-page links and anchors behave natively
    e.preventDefault();go(a.getAttribute('href'));
  });
  addEventListener('pageshow',e=>{if(e.persisted){$$('.cd').forEach(x=>x.remove());B()?.context('typing',false)}});
  $$('main>*').forEach((el,i)=>el.style.setProperty('--i',i));
}

/* =================== contact: guided CLI session over a real form =================== */
function contactFlow(){
  const form=$('#contact-form');if(!form)return;
  const log=$('#session-log'),act=$('.actions',form),rows=$$('.row[data-key]',form);
  const steps=rows.map(row=>({row,el:$('input,textarea',row),key:row.dataset.key,req:row.dataset.req==='1'}));
  let stage='idle',busy=false;
  form.classList.add('flow');
  const sc=log.parentElement,bottom=()=>{sc.scrollTop=sc.scrollHeight}; // the session scrolls inside its panel
  const line=(html,cls='')=>{log.insertAdjacentHTML('beforeend',`<p class="${cls}">${html}</p>`);bottom()};
  async function typeLine(text,cls=''){if(!motion){line(esc(text),cls);return}const p=document.createElement('p');p.className=cls;log.append(p);for(let k=1;k<=text.length;k++){p.textContent=text.slice(0,k);bottom();await sleep(14)}}
  const HELP=['usage: ./contact [--help]','  enter          confirm the answer','  shift+enter    new line (message only)','  ↑ on empty     go back and edit the previous answer','  ^C             cancel. nothing is sent','  click any ✔    edit that answer'];
  const help=()=>HELP.forEach(h=>line(esc(h),'dim'));
  const errEl=s=>$('.err',s.row);
  function validate(s){const v=s.el.value.trim();
    const msg=s.req&&!v?{name:'I’d love to know who I’m talking to',email:'I’ll need somewhere to reply',message:'an empty message is very zen, but say a little more?'}[s.key]
      :s.key==='email'&&s.el.validity.typeMismatch?'that email is missing an @ or a dot (I’ve been fooled before)':'';
    errEl(s).textContent=msg?`✗ ${msg}`:'';s.el.toggleAttribute('aria-invalid',!!msg);return !msg}
  function reach(i){const s=steps[i];s.row.classList.add('reached');s.row.classList.remove('done');s.el.readOnly=false;stage=i;s.el.focus()}
  const confirmText=s=>{const v=s.el.value.trim(),first=esc((steps[0].el.value.trim().split(/\s+/)[0])||'friend');
    if(s.key==='name')return `✔ nice to meet you, ${first}.`;
    if(s.key==='email')return `✔ replies will go to ${esc(v)}.`;
    if(s.key==='phone')return v?'✔ noted. WhatsApp works too.':'↷ skipped. email it is.';
    const w=v.split(/\s+/).filter(Boolean).length;return `✔ ${w} word${w===1?'':'s'}. ${w<8?'short and sweet.':w<80?'just right.':'a proper letter. I’ll make tea.'}`};
  async function answer(i){
    const s=steps[i];if(busy)return;
    if(s.el.value.trim()==='--help'){s.el.value='';help();return}
    if(!validate(s)){line(esc(errEl(s).textContent),'bad');return}
    busy=true;s.row.classList.add('done');s.el.readOnly=true;
    await typeLine(confirmText(s),'ok');busy=false;
    const next=steps.findIndex(x=>!x.row.classList.contains('done'));
    if(next>=0)reach(next);else ask();
  }
  async function ask(){stage='confirm';act.classList.add('reached');await typeLine('? send it? (Y/n)','hi');$('button[type=submit]',form).focus()}
  async function start(){
    log.innerHTML='';form.reset();steps.forEach(s=>{s.row.classList.remove('reached','done');s.el.readOnly=false;errEl(s).textContent='';s.el.removeAttribute('aria-invalid')});act.classList.remove('reached');
    $$('.restart',form.parentElement).forEach(b=>b.hidden=true);
    await typeLine('sammy@ibeh:~/contact$ ./contact','dim');
    line('<span class="hi">--help</span> for options · <span class="hi">^C</span> cancels','dim');
    reach(0);
  }
  function cancel(){if(stage==='done')return;line('^C','bad');line('cancelled. nothing was sent. no hard feelings.','dim');
    steps.forEach(s=>{s.row.classList.remove('reached','done')});act.classList.remove('reached');stage='idle';$$('.restart',form.parentElement).forEach(b=>{b.hidden=false});$('.restart',form.parentElement).focus()}
  steps.forEach((s,i)=>{
    s.el.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!(s.el.tagName==='TEXTAREA'&&e.shiftKey)){e.preventDefault();if(!s.el.readOnly)answer(i)}
      else if(e.key==='ArrowUp'&&!s.el.value&&i>0){e.preventDefault();reach(i-1)}
    });
    s.el.addEventListener('focus',()=>{if(s.row.classList.contains('done')&&stage!=='done'){s.row.classList.remove('done');s.el.readOnly=false;stage=i}});
  });
  form.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.key.toLowerCase()==='c'){const t=e.target;if(t.selectionStart!==undefined&&t.selectionStart!==t.selectionEnd)return;e.preventDefault();cancel()}
    if(stage==='confirm'&&!e.target.matches('input,textarea')){if(e.key.toLowerCase()==='n'){e.preventDefault();line('no problem. select any ✔ answer to edit it.','dim');steps[steps.length-1].el.focus()}if(e.key.toLowerCase()==='y'){e.preventDefault();form.requestSubmit()}}
  });
  form.addEventListener('focusin',()=>B()?.context('typing',true));form.addEventListener('focusout',e=>{if(!form.contains(e.relatedTarget))B()?.context('typing',false)});
  $('[data-act=help]').addEventListener('click',()=>{help();(steps[stage]?.el||form).focus?.()});
  $('[data-act=cancel]').addEventListener('click',cancel);
  $('[data-act=back]').addEventListener('click',()=>{const i=typeof stage==='number'?stage:steps.length;if(i>0)reach(i-1)});
  $$('.restart',form.parentElement).forEach(b=>b.addEventListener('click',start));
  form.addEventListener('submit',async e=>{
    e.preventDefault(); // without JS the browser posts the same form natively
    if(stage==='sending'||stage==='done')return;
    for(const s of steps)if(!validate(s)){reach(steps.indexOf(s));line(esc(errEl(s).textContent),'bad');return}
    stage='sending';act.classList.remove('reached');steps.forEach(s=>s.el.readOnly=true);
    const nm=esc(steps[0].el.value.trim().split(/\s+/)[0]);
    await typeLine('→ compressing pleasantries … ok');
    try{
      // trailing slash: Netlify 301s /contact, and a 301 turns the POST into a GET
      const res=await fetch('/contact/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()});
      if(!res.ok)throw new Error(`${res.status}`);
      stage='done';
      await typeLine(`→ POST /contact/ … ${res.status} OK`);
      await typeLine(`✓ sent. thanks, ${nm}. I’ll reply faster than a cold webpack build.`,'ok');
      B()?.react('flex',2600);
      $$('.restart',form.parentElement).forEach(b=>{b.hidden=false;b.textContent='↻ send another'});
    }catch(err){
      line(`✗ POST /contact/ failed (${esc(err.message||'network')}). nothing was lost: press send to retry, or email hello@sammyibeh.com`,'bad');
      steps.forEach(s=>s.el.readOnly=false);ask();
    }
  });
  start();
}

/* =================== pages =================== */
const pages={
home(){
  nowPlaying();
  const name=$('#name'),nc=name.nextElementSibling,typeName=()=>{caret(nc,true);decode(name,900).then(()=>caret(nc,false))};
  if(H.classList.contains('booting')){
    const ov=document.createElement('div');ov.className='boot';ov.setAttribute('aria-hidden','true');
    ov.innerHTML='<pre></pre><button type="button" tabindex="-1">skip ⏎</button>';document.body.append(ov);
    const lines=['[ 0.000] sammy-os 26.10 · tty1','[ 0.091] mounting /home/sammy … <span class="ok">ok</span>','[ 0.164] loading coffee.service … <span class="ok">ok</span> (2 shots)','[ 0.301] starting music.daemon … <span class="ok">ok</span> (volume: tasteful)','[ 0.377] feeding Sully … <span class="ok">ok</span> (under protest)','[ 0.452] welcome, visitor. mind the cursor.'];
    let skip=false;const end=()=>{skip=true};
    addEventListener('keydown',end,{once:true});ov.addEventListener('pointerdown',end);
    (async()=>{const pre=$('pre',ov);for(const l of lines){if(skip)break;pre.innerHTML+=l+'\n';await sleep(125)}
      pre.innerHTML=lines.join('\n');await sleep(skip?0:260);ov.classList.add('out');H.classList.remove('booting');typeName();railUpdate();await sleep(520);ov.remove()})();
  } else typeName();
  /* greeting: caret shows while typing or deleting, blinks twice while a phrase holds */
  (async()=>{const el=$('#greet'),gc=el.nextElementSibling;for(;;){if(!motion){el.textContent=KEY[0];await sleep(600);continue}
    const w=nextHello();caret(gc,true);for(let k=1;k<=w.length;k++){el.textContent=w.slice(0,k);await sleep(55)}caret(gc,false);await sleep(1800);
    caret(gc,true);for(let k=w.length;k>=0;k--){el.textContent=w.slice(0,k);await sleep(22)}await sleep(240)}})();
},
about(){
  decode($('h1 .t'));
},
experience(){
  decode($('h1 .t'));
  const t=location.hash.slice(1),d=t&&document.getElementById(t);if(d&&d.tagName==='DETAILS'){d.open=true;d.scrollIntoView()}
  const tabs=$$('[role=tab]');let ready=false;
  const sel=t=>{tabs.forEach(b=>{const on=b===t;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;$('#'+b.getAttribute('aria-controls')).hidden=!on});
    if(t.id==='tab-shell'&&!ready){ready=true;const sh=Shell($('#scr'),$('#cmd'),{cwd:'~/experience',files:XP.map(x=>x.id+'.md')});
      sh.print('<p class="dim">interactive shell. type a command or pick a file. <span class="hi">help</span> lists the polite ones.</p>');
      (async()=>{await sh.typeRun('ls');await sh.typeRun('cat gds.md')})()}};
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>sel(b));b.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowLeft:-1}[e.key];if(d){const n=tabs[(i+d+tabs.length)%tabs.length];n.focus();sel(n)}})});
},
now(){decode($('h1 .t'))},
contact(){decode($('h1 .t'));contactFlow()},
notfound(){decode($('.e404 .big'),900);const p=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');$('#missing').textContent=p&&!/^(404(\.html)?)?$/.test(p)?p.replace(/\.html$/,''):'that-page'}
};

/* =================== start =================== */
themeToggle();logo();glow();transitions();progress();quake();konami();rail();
(pages[PAGE]||(()=>{}))();
clocks();railUpdate();
watch();
