/* Buddy (Sammy) + Sully, round 6. Original art and code.
   Art: 2D cel style. Flat colour, one confident ink weight, simple silhouettes, no gradients.
   Rig: torso and head are 2D transforms. Arms are solved every frame with 3D two-bone IK toward real
   target points (mouth, ear cups, keys, pan handle, a curl arc around a fixed elbow, the bar) and
   projected orthographically, so hands land where they should and forearms foreshorten when they
   point at the viewer. Pose changes are inertialised: the hand eases from where it was onto the new
   target path, so once settled the target is hit exactly. Gaze is solved per eye toward a focus point.
   Reduced motion: no rig motion; each loop shows its key frame as a still. */
(()=>{
const H=document.documentElement,S=window.__store;
const motion=()=>H.classList.contains('motion');
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const TAU=Math.PI*2,pulse=p=>(1-Math.cos(TAU*p))/2; // 0 → 1 → 0, eased at both ends
const ease=p=>p<=0?0:p>=1?1:p*p*(3-2*p);

const SKINS={deep:'#5a3825',brown:'#8d5524',tan:'#c68642',light:'#e8b98a'};
const LIKENESS={skin:'brown',hair:'fade',beard:'stubble',glasses:'off'}; // shortcut: placeholder choices; owner confirms (see report)
const STATES=['idle','wave','typing','music','cook','curl','press','flex','sleep'];
const CATS=['none','sit','swat','nap','walk'];

/* ---------- 3D vectors and two-bone IK ---------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>mul(a,1/(len(a)||1)),mix=(a,b,t)=>add(a,mul(sub(b,a),t));
/* shoulder S, target T, bone lengths a and b, pole point P picks the bend plane. Out of reach: the chain points at T, fully extended. */
function ik(S,T,a,b,P){
  const d=sub(T,S),dl=len(d),u=unit(d),dc=Math.min(Math.max(dl,Math.abs(a-b)+1e-3),a+b-1e-3);
  let v=sub(sub(P,S),mul(u,dot(sub(P,S),u)));v=len(v)<1e-6?[0,1,0]:unit(v);
  const ang=Math.acos(clamp((a*a+dc*dc-b*b)/(2*a*dc)));
  const E=add(S,add(mul(u,a*Math.cos(ang)),mul(v,a*Math.sin(ang))));
  return {E,End:add(E,mul(unit(sub(T,E)),b))};
}
{const S=[0,0,0],T=[30,60,20],P=[-40,20,-30],{E,End}=ik(S,T,50,48,P),far=ik(S,[0,200,0],50,48,P);
 console.assert(len(sub(End,T))<1e-6&&Math.abs(len(sub(E,S))-50)<1e-6&&Math.abs(len(sub(End,E))-48)<1e-6&&Math.abs(far.End[1]-98)<.01,'IK self-check: reaches, keeps bone lengths, extends toward an unreachable target')}

/* ---------- skeleton (SVG user units, viewBox 200×210) ---------- */
const SH={L:[61,131],R:[139,131]},UA=50,FA=48,SPOON=24,NECK=[100,111];
const EYE={L:[88,81],R:[112,81]},MOUTH=[100,101.5],CUP_HEAD={L:[62,84],R:[138,84]},CUP_NECK={L:[81,127],R:[119,127]};
const OUT={L:-1,R:1};

/* ================= art: Sammy ================= */
const MIRROR='matrix(-1 0 0 1 200 0)';
const HEAD='M100 46 C121 46 135.5 59 135.5 78.5 C135.5 99.5 121 113.5 100 113.5 C79 113.5 64.5 99.5 64.5 78.5 C64.5 59 79 46 100 46 Z';
const EAR='<path class="ol" d="M66.5 73 C58.5 70.5 55.5 80 58.5 86.5 C60.2 90 63.8 91 67 88.5 Z" fill="var(--skin)"/><path d="M63.6 77.4 C61.2 79.6 61.2 84 63.8 86" stroke="var(--skin-sh)" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
const CAP='M64.5 79 C62 58 78 42.5 100 42.5 C122 42.5 138 58 135.5 79 C134.6 72 133 67 130 63.5 C128.5 61.6 126 60.6 123 60 C112 58 88 58 77 60 C74 60.6 71.5 61.6 70 63.5 C67 67 65.4 72 64.5 79 Z';
const FADE_SIDE='M64.5 79 C64.4 83 64.8 86 65.4 88.4 L67.6 88.4 C66.8 82 67.4 72 70 63.5 C67 67 65.4 72 64.5 79 Z';
const eye=s=>`<g class="eye" transform="translate(${EYE[s][0]} ${EYE[s][1]})">
  <clipPath id="bd-ec${s}"><ellipse rx="5.4" ry="6.6"/></clipPath>
  <g class="eye-open"><g clip-path="url(#bd-ec${s})"><ellipse rx="5.4" ry="6.6" fill="#fffaf0"/>
    <g class="pup"><ellipse rx="3.1" ry="3.8" fill="var(--ink)"/><circle cx="-1.1" cy="-1.5" r="1.05" fill="#fff"/></g>
    <g class="lid"><rect x="-8" y="-21" width="16" height="14.6" fill="var(--skin)"/><path d="M-6.5 -6.6 Q0 -4.6 6.5 -6.6" stroke="var(--ink)" stroke-width="1.8" fill="none" stroke-linecap="round"/></g></g>
    <ellipse rx="5.4" ry="6.6" fill="none" stroke="var(--ink)" stroke-width="1.5"/></g>
  <path class="eye-happy" d="M-5.6 1.8 Q0 -5.2 5.6 1.8" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path class="eye-shut" d="M-5.8 .6 Q0 4.6 5.8 .6" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`;
const SVG=`<svg class="b" viewBox="0 0 200 210" aria-hidden="true" focusable="false">
<g class="b-root">
  <path class="ol" d="M91.5 102 L91.5 121 Q100 126 108.5 121 L108.5 102 Z" fill="var(--skin)"/>
  <path d="M91.5 102 L108.5 102 L108.5 109 Q100 116 91.5 109 Z" fill="var(--skin-sh)"/>
  <path class="ol" d="M88.5 118.5 C80 122 70 125 63 127.5 C55 130.5 52 139 53 152 L55.5 214 L144.5 214 L147 152 C148 139 145 130.5 137 127.5 C130 125 120 122 111.5 118.5 C107 125 93 125 88.5 118.5 Z" fill="var(--shirt)"/>
  <path d="M131 126 C141 130 145.6 137 145.6 150 L143.6 213 L133 213 C136.6 185 138 152 131 126 Z" fill="var(--shirt-sh)"/>
  <path d="M74 150 C76 160 76.5 170 75.5 180 M84 137 Q100 142 116 137" stroke="var(--shirt-sh)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M90 119.6 C94 125 106 125 110 119.6" stroke="var(--shirt-sh)" stroke-width="2.6" fill="none"/>
  <path d="M88.5 118.5 C93 127 107 127 111.5 118.5" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text class="tee-logo" x="100" y="176" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="800" fill="var(--tee-ink)">{ }</text>
  <g class="apron"><path class="ol" d="M80 141 C88 139 112 139 120 141 L124 214 L76 214 Z" fill="var(--apron)"/>
    <path d="M81.5 141 C83 132 87.5 125 90.5 120.5 M118.5 141 C117 132 112.5 125 109.5 120.5" stroke="var(--apron-sh)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M87 174 H113 V189 Q100 192 87 189 Z" fill="none" stroke="var(--apron-sh)" stroke-width="1.6" stroke-linejoin="round"/></g>
  <g class="b-head">
    <g class="b-ears">${EAR}<g transform="${MIRROR}">${EAR}</g></g>
    <path class="ol hd" d="${HEAD}" fill="var(--skin)"/>
    <path d="M122 54 C131 62 134 72 134 82 C133.6 98 125 108.4 113 112.4 C123 103 127 92 127 80 C127 69 125.4 61 122 54 Z" fill="var(--skin-sh)" opacity=".55"/>
    <g class="hair-fade"><path d="${FADE_SIDE}" fill="var(--hair)" opacity=".45"/><path d="${FADE_SIDE}" transform="${MIRROR}" fill="var(--hair)" opacity=".45"/><path class="ol" d="${CAP}" fill="var(--hair)"/><path d="M82 48.5 Q93 45 104 46" stroke="var(--hair-hi)" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <path class="hair-buzz" d="${CAP}" fill="var(--hair)" opacity=".55"/>
    <g class="hair-curls"><path class="ol" d="${CAP}" fill="var(--hair)"/><g class="ol" fill="var(--hair)"><circle cx="70" cy="60" r="7"/><circle cx="77" cy="49" r="8"/><circle cx="89" cy="42.5" r="8.5"/><circle cx="102" cy="40.5" r="8.5"/><circle cx="115" cy="43.5" r="8.5"/><circle cx="125" cy="51" r="8"/><circle cx="131" cy="61" r="7"/></g></g>
    <g class="hair-locs"><path d="M67 66 C63 84 64 100 67 114 M74 60 C71 80 71 96 73 110 M133 66 C137 84 136 100 133 114 M126 60 C129 80 129 96 127 110" stroke="var(--ink)" stroke-width="8.4" fill="none" stroke-linecap="round"/><path d="M67 66 C63 84 64 100 67 114 M74 60 C71 80 71 96 73 110 M133 66 C137 84 136 100 133 114 M126 60 C129 80 129 96 127 110" stroke="var(--hair)" stroke-width="5" fill="none" stroke-linecap="round"/><path class="ol" d="${CAP}" fill="var(--hair)"/></g>
    <path class="beard-stubble" d="M65.5 86 C67 104 82 113.5 100 113.5 C118 113.5 133 104 134.5 86 C132 98 124 105 114 106 C108 103 92 103 86 106 C76 105 68 98 65.5 86 Z" fill="var(--hair)" opacity=".2"/>
    <g class="beard-full"><path class="ol" d="M65 83 C65 106 81 118 100 118 C119 118 135 106 135 83 C132 97 124 104.5 115 105 C109 101 91 101 85 105 C76 104.5 68 97 65 83 Z" fill="var(--hair)"/><path d="M90 99 Q100 95 110 99 Q100 101.5 90 99 Z" fill="var(--hair)"/></g>
    <g class="b-face">
      <g class="brows" stroke="var(--hair)" stroke-width="3.2" fill="none" stroke-linecap="round"><path class="brow-l" d="M82 71.5 Q88 67.5 94.5 70"/><path class="brow-r" d="M105.5 70 Q112 67.5 118 71.5"/></g>
      ${eye('L')}${eye('R')}
      <path d="M101.5 85 C99.6 89.6 97.6 91.8 99 93.4 C100 94.4 101.8 94 102.8 93.2" stroke="var(--ink)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse class="cheek" cx="80" cy="95" rx="5" ry="2.8" fill="#ff7a6b"/><ellipse class="cheek" cx="120" cy="95" rx="5" ry="2.8" fill="#ff7a6b"/>
      <g class="mouth" stroke-linecap="round" stroke-linejoin="round">
        <path class="m m-smile" d="M93 99.5 Q100 104.6 107 99.5" stroke="var(--ink)" stroke-width="2" fill="none"/>
        <g class="m m-grin"><path d="M91.5 98.4 Q100 100 108.5 98.4 Q107.4 108.2 100 108.2 Q92.6 108.2 91.5 98.4 Z" fill="#3a1712" stroke="var(--ink)" stroke-width="1.8"/><path d="M95.4 105.2 Q100 102.6 104.6 105.2 Q100 107.6 95.4 105.2 Z" fill="#c4584a"/></g>
        <ellipse class="m m-o" cx="100" cy="101.5" rx="3" ry="3.6" fill="#3a1712" stroke="var(--ink)" stroke-width="1.6"/>
        <g class="m m-strain"><rect x="91.5" y="98" width="17" height="7" rx="3" fill="#fffaf0" stroke="var(--ink)" stroke-width="1.6"/><path d="M91.5 101.5 H108.5" stroke="var(--ink)" stroke-width="1.1"/></g>
        <path class="m m-flat" d="M95 101 Q100 102.2 105 101" stroke="var(--ink)" stroke-width="2" fill="none"/>
        <path class="m m-hum" d="M96 100 Q100 103.4 104 100" stroke="var(--ink)" stroke-width="2" fill="none"/>
      </g>
      <g class="glasses" fill="rgba(255,255,255,.08)" stroke="var(--ink)" stroke-width="1.8"><rect x="79" y="73.5" width="18" height="15" rx="5.5"/><rect x="103" y="73.5" width="18" height="15" rx="5.5"/><path d="M97 79 Q100 77 103 79 M79 78 L66 76 M121 78 L134 76" fill="none"/></g>
    </g>
    <g class="headband"><path class="ol" d="M64.8 66 C80 55 120 55 135.2 66 L135 72.5 C120 62 80 62 65 72.5 Z" fill="var(--ac2)"/><path class="ol" d="M134 66 l9 1 l-4 6 Z" fill="var(--ac2)"/></g>
    <path class="sweat" d="M129 70 q3 5 0 7 q-3 -2 0 -7 Z" fill="#9fd3ff" stroke="var(--ink)" stroke-width=".8"/>
  </g>
  <g class="pan"><g class="pan-bob"><path class="ol" d="M68 197 L32 201.5 Q28.5 202 29 204.5 Q29.5 206.5 33 206 L69 202 Z" fill="#4a3f3a"/><path class="ol" d="M64 194 H144 Q144 209 104 209 Q64 209 64 194 Z" fill="#2e2a2b"/><ellipse class="ol" cx="104" cy="194" rx="40" ry="5.5" fill="#4a4240"/><ellipse cx="104" cy="194.4" rx="33" ry="3.6" fill="#e0a14a"/></g></g>
</g>
<g class="hp"><path class="hp-band" fill="none" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/><path class="hp-band2" fill="none" stroke="#3b3442" stroke-width="3.6" stroke-linecap="round"/>
  <g class="cupL"><rect class="ol" x="-6" y="-11" width="12" height="22" rx="5.6" fill="var(--ac)"/><rect x="-3" y="-7" width="3" height="12" rx="1.5" fill="#fff" opacity=".35"/></g>
  <g class="cupR"><rect class="ol" x="-6" y="-11" width="12" height="22" rx="5.6" fill="var(--ac)"/></g></g>
<g class="arms" stroke-linecap="round" stroke-linejoin="round">
  <g class="bar"><path class="bar-rod" stroke="var(--ink)" stroke-width="5" fill="none"/><path class="bar-rod2" stroke="#9aa3b5" stroke-width="2.4" fill="none"/><rect class="plateL ol" x="-4" y="-14" width="8" height="28" rx="2.5" fill="#2b2f3a"/><rect class="plateR ol" x="-4" y="-14" width="8" height="28" rx="2.5" fill="#2b2f3a"/></g>
  ${['L','R'].map(s=>`<g class="arm arm${s}">
    <path class="limb-ink" stroke="var(--ink)" stroke-width="14.6" fill="none"/><path class="limb" stroke="var(--skin)" stroke-width="11" fill="none"/>
    <path class="sleeve-ink" stroke="var(--ink)" stroke-width="18.6" fill="none"/><path class="sleeve" stroke="var(--shirt)" stroke-width="15" fill="none"/>
    <circle class="bicep ol" r="7.5" fill="var(--skin)"/>
    ${s==='R'?'<g class="spoon"><path class="spoon-h" stroke="var(--ink)" stroke-width="4.4" fill="none"/><path class="spoon-h2" stroke="#c9b08a" stroke-width="2" fill="none"/><ellipse class="spoon-b ol" rx="4.2" ry="3.2" fill="#e6d4b4"/></g>':''}
    <g class="hand"><g class="db"><rect class="ol" x="-13" y="-1.8" width="26" height="3.6" rx="1.8" fill="#9aa3b5"/><rect class="ol" x="-17" y="-8" width="7" height="16" rx="2" fill="#2b2f3a"/><rect class="ol" x="10" y="-8" width="7" height="16" rx="2" fill="#2b2f3a"/></g>
      <circle class="ol" cx="${s==='L'?3.5:-3.5}" cy="-4.5" r="3.2" fill="var(--skin)"/><circle class="ol" r="7" fill="var(--skin)"/></g>
  </g>`).join('')}
</g>
<g class="b-front">
  <g class="laptop"><path class="ol" d="M40 202 L160 202 L163 207.5 Q163 210 160 210 L40 210 Q37 210 37 207.5 Z" fill="#2b2f3a"/>
    <g class="lap-lid"><path class="ol" d="M54 172 Q54 170 56.5 170 L143.5 170 Q146 170 146 172 L150 202 L50 202 Z" fill="#3a4256"/><path d="M57 173 H143" stroke="#8d98b4" stroke-width="1.2" opacity=".6"/>
    <text x="100" y="192" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" font-weight="800" fill="var(--ac)">{ }</text></g></g>
  <g class="steam" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M90 186 C86 180 94 176 90 169"/><path d="M104 185 C100 178 108 174 104 166"/><path d="M117 186 C113 180 121 176 117 170"/></g>
  <g class="glyphs" font-family="JetBrains Mono,monospace" font-size="12" font-weight="700" fill="var(--ac)"><text x="62" y="162">{</text><text x="132" y="159">;</text><text x="84" y="154">&lt;/&gt;</text><text x="116" y="164">}</text></g>
  <g class="notes" font-size="15" fill="var(--ac)"><text x="40" y="66">♪</text><text x="150" y="56">♫</text></g>
  <g class="zzz" font-family="JetBrains Mono,monospace" fill="var(--mu)"><text x="134" y="62" font-size="10">z</text><text x="143" y="50" font-size="12">z</text><text x="153" y="36" font-size="15">Z</text></g>
</g></svg>`;

/* ================= art: Sully, a chunky black British Shorthair. Flat fur, copper eyes, rim-coloured outline ================= */
const FUR='#1b1a21',FUR2='#26252e',FURD='#111016';
const OL=(d,w=1.4,f=FUR)=>`<path d="${d}" fill="${f}" stroke="var(--cat-rim)" stroke-width="${w}" stroke-linejoin="round"/>`;
const TAILW=(d,w)=>`<path d="${d}" stroke="var(--cat-rim)" stroke-width="${w+2.8}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${FUR}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const EYEC=(cx,cy,r=4.6)=>`<g class="ceye" data-cx="${cx}" data-cy="${cy}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e3872e" stroke="#7a3a10" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${r*.62}" fill="#f2a64a"/><g class="cpup"><ellipse cx="${cx}" cy="${cy}" rx="${r*.32}" ry="${r*.7}" fill="#0a0a0c"/><circle cx="${cx-r*.32}" cy="${cy-r*.4}" r="${r*.22}" fill="#fff"/></g></g>`;
const LEGF='M-3.2 -2 C-3.4 5 -3 10 -2.6 14.2 L2.8 14.2 C3.2 10 3.4 5 3.2 -2 Z',LEGH='M-5.2 -4 C-6.2 3 -3.8 8 -2.9 14.2 L2.7 14.2 C3.5 8.6 5.6 3.6 4.8 -4 Z';
const PAW='M-3.6 14 C-3.6 12.4 -1.6 11.8 .2 11.8 C2.4 11.8 4.6 12.6 4.6 14.3 C4.6 15.7 2.6 16.3 .4 16.3 C-1.8 16.3 -3.6 15.7 -3.6 14 Z';
const leg=(x,y,d,far,i)=>`<g transform="translate(${x} ${y})"><g class="cleg" data-i="${i}"><path d="${d}" fill="${far?FURD:FUR}" stroke="var(--cat-rim)" stroke-width="1"/><path d="${PAW}" fill="${far?FURD:FUR2}" stroke="var(--cat-rim)" stroke-width=".9"/></g></g>`;
const EAR_C=(x,y,s)=>`<g transform="translate(${x} ${y})"><g class="cear"><path d="M${-3.6*s} 2.6 C${-4.6*s} -2.6 ${-3*s} -6.4 ${1.6*s} -4 C${3.4*s} -2.8 ${4*s} -.8 ${3.6*s} 1.4 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width="1.3" stroke-linejoin="round"/><path d="M${-2*s} .6 C${-2.6*s} -2.4 ${-1.6*s} -4 ${.6*s} -2.6 Z" fill="#4a3540"/></g></g>`;
const CAT=`<svg viewBox="0 0 80 62" aria-hidden="true" focusable="false">
<g class="c-sit">
  <g transform="translate(55 56)"><g class="ctail">${TAILW('M0 0 C7 1 10.5 -3.6 8.4 -10.4',6.6)}</g></g>
  ${OL('M21.5 60 C17.5 51 19 40 26 34.4 C29.8 31.4 34.6 30.2 40 30.2 C45.4 30.2 50.2 31.4 54 34.4 C61 40 62.5 51 58.5 60 Z')}
  <path d="M27 43 C25 49 25.6 55 28.6 59.4 L22.6 59.4 C20.2 53 21.6 46 27 43 Z M53 43 C55 49 54.4 55 51.4 59.4 L57.4 59.4 C59.8 53 58.4 46 53 43 Z" fill="${FURD}"/>
  <path d="M33 40.6 C32.6 48.5 32.8 54 33.4 58.6 L38.6 58.6 C39 54 39 48.5 38.6 40.6 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width=".9"/>${OL('M32.2 58.4 C32.2 56.6 34 55.6 35.9 55.6 C37.8 55.6 39.6 56.6 39.6 58.4 C39.6 59.9 38 60.6 35.9 60.6 C33.8 60.6 32.2 59.9 32.2 58.4 Z',.9,FUR2)}
  <g transform="translate(44 41)"><g class="cpaw"><path d="M-2.8 0 C-3.1 7.5 -3.1 13 -2.7 17.6 L2.5 17.6 C3.1 13 3.1 7.5 2.8 0 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width=".9"/>${OL('M-3.6 17.4 C-3.6 15.6 -1.7 14.6 .1 14.6 C1.9 14.6 3.8 15.6 3.8 17.4 C3.8 18.9 2.1 19.6 .1 19.6 C-1.9 19.6 -3.6 18.9 -3.6 17.4 Z',.9,FUR2)}</g></g>
  <path d="M34 35.4 C36 40 38 43 40 45 C42 43 44 40 46 35.4 C43 37.2 37 37.2 34 35.4 Z" fill="${FUR2}"/>
  <g class="chead">
    ${EAR_C(27.6,16.4,1)}${EAR_C(52.4,16.4,-1)}
    ${OL('M40 11.4 C51.4 11.4 59.4 17.8 59.4 26.4 C59.4 31.6 56.6 35.4 51.2 37.6 C47.8 39 44 39.6 40 39.6 C36 39.6 32.2 39 28.8 37.6 C23.4 35.4 20.6 31.6 20.6 26.4 C20.6 17.8 28.6 11.4 40 11.4 Z',1.5)}
    <path d="M30 15.6 C35 13.2 45 13.2 50 15.6 C45 14.8 35 14.8 30 15.6 Z" fill="${FUR2}"/>
    ${EYEC(33.4,25.2)}${EYEC(46.6,25.2)}
    <path d="M38.4 29.6 h3.2 l-1.6 1.8 Z" fill="#4a3540"/><path d="M40 31.4 q-1.9 2.4 -4 1.2 M40 31.4 q1.9 2.4 4 1.2" stroke="var(--cat-rim)" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <path d="M27 31 h-9 M27.4 33 l-8 2.6 M53 31 h9 M52.6 33 l8 2.6" stroke="#b9b9c8" stroke-width=".6" opacity=".7" stroke-linecap="round"/>
  </g>
</g>
<g class="c-loaf">
  <g transform="translate(60 55)"><g class="ctail">${TAILW('M0 0 C6 5 -8 7.2 -20 6',6.4)}</g></g>
  ${OL('M13.5 52.4 C12.4 44.6 18.6 38.2 30 37.4 L53 37 C63.2 37 68.6 43.4 66.8 51.6 C65.8 56.6 60.6 59.4 50.4 59.4 L27.6 59.4 C19.4 59.4 14.4 57.2 13.5 52.4 Z')}
  <path d="M30 39.4 C40 38 52 38.2 60 40.6 C52 40 40 40 30 41.4 Z" fill="${FUR2}"/>
  <g class="chead">
    ${EAR_C(16.4,37,1)}${EAR_C(30,37,-1)}
    ${OL('M12.4 45 C12.4 38.4 17.2 34.2 23.2 34.2 C29.4 34.2 34 38.6 34 44.8 C34 50.2 29.6 53.6 23.2 53.6 C17 53.6 12.4 50.4 12.4 45 Z')}
    <path d="M17.4 44.6 q2.3 2.2 4.6 0 M24.4 44.6 q2.3 2.2 4.6 0" stroke="var(--cat-rim)" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M22 47.8 h2.4 l-1.2 1.3 Z" fill="#4a3540"/>
  </g>
  <text x="36" y="31" font-family="JetBrains Mono,monospace" font-size="8" fill="var(--mu)">z</text>
</g>
<g class="c-walk"><g class="cbody">
  ${leg(26,38,LEGH,1,2)}${leg(54,38,LEGF,1,3)}
  <g transform="translate(18.5 27.5)"><g class="ctail">${TAILW('M0 0 C-7 -1.6 -11.4 -8 -10.6 -16',6.4)}</g></g>
  ${OL('M17 29.5 C17 21.4 25.4 18 37.5 18 C49 18 57.6 19.6 60.6 25.4 C62.8 30 61.6 37.4 56.4 40.6 C49.6 44.6 30 44.8 22.6 41.6 C18.6 39.8 17 35 17 29.5 Z')}
  <path d="M24 20.6 C32 18.6 46 18.6 54 20.6 C46 20.4 32 20.6 24 22.4 Z" fill="${FUR2}"/>
  ${leg(29,38,LEGH,0,0)}${leg(50,39,LEGF,0,1)}
  <g class="chead">
    <path d="M56.6 16.6 C56 11.4 58.8 9.6 61.6 13 Z M68.4 13.2 C70.4 9.2 73.8 10.4 73 15.4 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width="1.3" stroke-linejoin="round"/>
    ${OL('M53.2 24.6 C53.2 16.8 58.6 12.2 65 12.2 C71.6 12.2 76.8 16.6 76.8 23.6 C76.8 30.2 72.4 34.4 65.6 34.4 C59 34.4 53.2 30.8 53.2 24.6 Z',1.5)}
    ${EYEC(67,22.6,3.6)}
    <path d="M75.6 26.2 l1.4 .9 l-1.4 .8 Z" fill="#4a3540"/><path d="M72.6 29.6 q1.6 1.2 3.4 0" stroke="var(--cat-rim)" stroke-width=".8" fill="none" stroke-linecap="round"/>
    <path d="M70 29 h9 M70 30.6 l8 2" stroke="#b9b9c8" stroke-width=".55" opacity=".7" stroke-linecap="round"/>
  </g>
</g></g>
<g class="c-stretch">
  ${TAILW('M15 34 C7 22 13 12 20 10',6.2)}
  ${OL('M17 46 C15 38 22 32.6 34 31.6 C44 30.8 52 36 58 42 C61 45 60 50 56 51 C47 53 30 54 22 52 C19 51 17.6 49 17 46 Z')}
  <path d="M56 50 C62 51 72 52.6 77 53.6 L77 57.2 C70 57 61 56 55 55 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width="1"/>
  <path d="M19 50 C18.6 54 18.8 57 19.6 59.6 L25.6 59.6 C25.4 57 25.6 54 26.2 51 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width="1"/>
  ${OL('M53 47 C53 40.8 57.6 37.2 63 37.2 C68.6 37.2 72.6 40.8 72.6 46.4 C72.6 51.4 68.8 54.4 63.4 54.4 C57.8 54.4 53 51.8 53 47 Z')}
  <path d="M56 39.6 C55.6 35 58 33.6 60.4 36.6 Z M66.6 36.6 C68.4 33 71.4 34 70.8 38.6 Z" fill="${FUR}" stroke="var(--cat-rim)" stroke-width="1.2"/>
  <path d="M58.6 46.6 q2 1.6 4 0 M65 46.2 q2 1.6 4 0" stroke="var(--cat-rim)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</g></svg>`;

/* ================= mount ================= */
const el=document.createElement('div');el.className='buddy';el.dataset.state='idle';
el.innerHTML=`<button class="hit" type="button" aria-label="Sammy's avatar, busy with his own thing. Press to make him flex.">${SVG}</button>
  <div class="cat" aria-hidden="true">${CAT}</div>
  <div class="bubble" aria-hidden="true"></div>
  <button class="tuck" type="button" aria-label="Tuck the avatar away">×</button>`;
const peek=document.createElement('button');peek.className='peek';peek.type='button';peek.setAttribute('aria-label','Bring Sammy back. Sully is keeping his seat warm.');
peek.innerHTML=CAT.replace('<g class="c-sit">','<g class="c-sit" style="opacity:1">');
document.body.append(el,peek);
const $=s=>el.querySelector(s),$$=s=>[...el.querySelectorAll(s)];
const svg=$('svg.b'),rootG=$('.b-root'),headG=$('.b-head'),frontG=$('.b-front'),face=$('.b-face'),ears=$('.b-ears'),bubble=$('.bubble'),panBob=$('.pan-bob');
const pups={L:$('.eye .pup'),R:$$('.eye .pup')[1]};
const ARM={};for(const s of ['L','R']){const g=$('.arm'+s);ARM[s]={limbInk:g.querySelector('.limb-ink'),limb:g.querySelector('.limb'),slvInk:g.querySelector('.sleeve-ink'),slv:g.querySelector('.sleeve'),bicep:g.querySelector('.bicep'),hand:g.querySelector('.hand'),
  pose:'rest',reseat:false,off:[0,0,0],offV:[0,0,0],pole:null,poleV:[0,0,0],last:null,lastDir:[0,1,0]}}
const spoon={h:$('.spoon-h'),h2:$('.spoon-h2'),b:$('.spoon-b')};
const bar={r:$('.bar-rod'),r2:$('.bar-rod2'),L:$('.plateL'),R:$('.plateR')};
const hp={b:$('.hp-band'),b2:$('.hp-band2'),L:$('.cupL'),R:$('.cupR')};
const catEl=$('.cat');

/* ---------- likeness ---------- */
function setLikeness(o={}){Object.assign(LIKENESS,o);el.style.setProperty('--skin',SKINS[LIKENESS.skin]||LIKENESS.skin);el.dataset.hair=LIKENESS.hair;el.dataset.beard=LIKENESS.beard;el.dataset.glasses=LIKENESS.glasses;S.set('likeness',JSON.stringify(LIKENESS))}
try{setLikeness(JSON.parse(S.get('likeness')||'{}'))}catch(e){setLikeness()}

/* ================= rig ================= */
const J={};const joint=(n,k,d,x=0)=>J[n]={x,v:0,t:x,k,d};
joint('head',42,8);joint('fx',60,10);joint('fy',60,10);joint('nod',90,11);joint('droop',22,7);joint('rootRot',28,8);joint('rootX',24,8);joint('rootY',90,9);
joint('sq',160,11,1);joint('hs',150,9,1);joint('bicep',140,12);joint('hp',70,15);   // hp: 0 headphones on the neck, 1 on the head
const springStep=(j,tgt,dt)=>{j.v+=(j.k*(tgt-j.x)-j.d*j.v)*dt;j.x+=j.v*dt};
{const j={x:0,v:0,k:110,d:16};let peak=0;for(let i=0;i<120;i++){springStep(j,100,1/60);peak=Math.max(peak,j.x)}console.assert(Math.abs(j.x-100)<1&&peak>100&&peak<115,'spring self-check: settles with a small overshoot')}
const spring3=(p,v,tgt,k,d,dt)=>{for(let i=0;i<3;i++){v[i]+=(k*(tgt[i]-p[i])-d*v[i])*dt;p[i]+=v[i]*dt}};

function setArm(side,pose){const A=ARM[side];if(A.pose===pose)return;A.pose=pose;A.reseat=true}
let loopName='none',env=0,envT=0,tasted=false;
let Mroot=new DOMMatrix(),Mhead=new DOMMatrix();
const R2=(x,y,z=0)=>{const p=Mroot.transformPoint({x,y});return [p.x,p.y,z]};
const H2=(x,y,z=0)=>{const p=Mhead.transformPoint({x:x+J.fx.x,y:y+J.fy.x});return [p.x,p.y,z]};
/* loop drivers: each returns 0..1 for its key moment, so stills and checks share one definition */
const tasteW=t=>{const p=(t/7)%1;return p<.68?0:p<.8?ease((p-.68)/.12):p<.9?1:ease(1-(p-.9)/.08)};
const curlPhi=(t,side)=>{const q=((t/3.4)+(side==='L'?0:.5))%1*2;if(q>1)return 0;return q<.4?ease(q/.4):q<.6?1:ease(1-(q-.6)/.4)};
const pressPhi=t=>{const p=(t/2.2)%1;return p<.05?0:p<.4?ease((p-.05)/.35):p<.6?1:p<.92?ease(1-(p-.6)/.32):0};
const STILL_T={curl:.85,press:1.1}; // reduced motion: curl top, press lockout
function cupPos(side){return mix(R2(...CUP_NECK[side],12),H2(...CUP_HEAD[side],0),clamp(J.hp.x,0,1))}
/* pose → {T: target (hand, or spoon tip when tip>0), pole: offset from the shoulder, tip} in SVG space with depth */
function poseTarget(side,name,t,e,Sw){
  const o=OUT[side];
  switch(name){
    case 'wave':{const s=Math.sin(TAU*t/.9)*e;return {T:R2(100+o*70+9*s,60-2.5*Math.abs(s),6),pole:[o*40,40,-10]}}
    case 'type':{const tap=Math.max(0,Math.sin(TAU*(t/.32+(side==='L'?0:.5))))**2*e,kx=3*Math.sin(TAU*t/1.9+(side==='L'?0:2))*e;
      return {T:R2(100+o*17+kx,197-4*tap,28),pole:[o*40,30,-10],key:R2(100+o*17+kx,197,28)}}
    case 'hp':return {T:add(cupPos(side),[o*2,0,0]),pole:[o*30,40,5]};
    case 'pan':return {T:R2(40,202.5+panY,20),pole:[-40,30,-10]};
    case 'stir':{const a=TAU*t/1.15,c=R2(104+11*Math.cos(a)*e,193.5+2.2*Math.sin(a)*e,26),w=tasteW(t)*e;return {T:mix(c,H2(...MOUTH,30),w),pole:[40,40,-10],tip:SPOON,w}}
    case 'curl':{const phi=curlPhi(t,side)*e,th=(55+90*phi)*Math.PI/180,e0=SH[side],E0=R2(e0[0]+o*4.16,e0[1]+49.83,0);
      return {T:add(E0,mul(unit([-o*.45*Math.sin(th),Math.cos(th),Math.sin(th)]),FA)),pole:sub(E0,Sw),E0,phi}} // pole at the elbow itself: the elbow stays pinned at his side
    case 'press':{const phi=pressPhi(t)*e;return {T:R2(100+o*49,124+(34-124)*phi,20*(1-phi)),pole:[o*30,45,15],phi}}
    case 'flex':return {T:R2(100+o*87,86,0),pole:[o*60,10,-10]};
    default:return {T:R2(100+o*35,224,4),pole:[o*40,10,-30]};
  }
}
let panY=0;const pts={};

/* ---------- tracking + gaze ---------- */
let tx=innerWidth/2,ty=innerHeight/2,lastPointer=-1e9,glance=null,lastInput=performance.now(),last=performance.now(),weight=0,nextWeight=0,lastFocus=null;
const T0=performance.now();
const look=(x,y,ms=0)=>{if(ms)glance={x,y,until:performance.now()+ms};else{tx=x;ty=y;lastPointer=performance.now()}}; // same contract as before: ms=0 moves the tracked point
addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;lastPointer=performance.now();glance=null;wake()},{passive:true});
addEventListener('focusin',e=>{const r=e.target.getBoundingClientRect?.();if(r&&r.width&&!el.contains(e.target))look(r.left+r.width/2,r.top+r.height/2,2200)});
const toSvg=(x,y)=>{const m=svg.getScreenCTM();if(!m)return null;const p=DOMMatrix.fromMatrix(m).inverse().transformPoint({x,y});return {x:p.x,y:p.y,D:60}}; // the screen plane sits ~60 units in front of him
function focusPoint(now){
  if(glance&&now<glance.until)return toSvg(glance.x,glance.y);
  const L=loopName,st=el.dataset.state;
  if(L==='typing'||(st==='typing'&&el.dataset.laptop==='open')){const p=R2(100,186);return {x:p[0],y:p[1],D:14}}
  if(L==='cook'){const p=pts.tip&&pts.w>.3?pts.tip:R2(104,194);return {x:p[0],y:p[1],D:pts.w>.3?8:16}}
  if(L==='curl'&&pts.hand){const s=pts.phiL>=pts.phiR?'L':'R',p=pts.hand[s];return {x:p[0],y:p[1],D:18}}
  if(L==='press'||L==='music'||L==='sleep')return null;
  return now-lastPointer<2500?toSvg(tx,ty):null;  // track the pointer while it moves, then return to the viewer instead of staring
}

function frame(now){
  requestAnimationFrame(frame);   // scheduled first so one bad frame can't stop the rig
  const dt=Math.min(.05,(now-last)/1000),m=motion();last=now;
  const t=m?(now-T0)/1000:(STILL_T[loopName]||0);
  env+=(envT-env)*(m?Math.min(1,dt*6):1);
  if(m){if(now>nextWeight){weight=rnd(-.8,.8);nextWeight=now+rnd(9000,15000)}J.rootX.t=weight;J.rootRot.t=.35*Math.sin(TAU*t/9.5)+weight*.2} // nonchalant: a small, slow sway
  else{J.rootX.t=0;J.rootRot.t=0}
  const L=loopName,w=L==='cook'?tasteW(t)*env:0;
  J.droop.t=el.dataset.head==='droop'?9:0;
  J.nod.t=(L==='music'?2.2*pulse(t/1.2)*env:0)+3*w;
  J.hp.t=el.dataset.hp==='head'?1:0;
  J.bicep.t=el.dataset.al==='flex'?.18+.18*pulse(t/.9)*env:0;
  /* gaze: head turns part of the way, eyes do the rest. Focus is a point in SVG space at depth D in front of the face */
  const f=focusPoint(now);
  if(f&&lastFocus&&Math.hypot(f.x-lastFocus.x,f.y-lastFocus.y)>70&&m)blinkNow();  // big gaze shifts come with a blink
  lastFocus=f;
  const hc=Mhead.transformPoint({x:100,y:80});
  if(f){const dx=f.x-hc.x,dy=f.y-hc.y,den=Math.hypot(dx,dy,90);J.fx.t=4.5*dx/den;J.fy.t=3.4*dy/den;J.head.t=3.5*dx/den-J.rootRot.x*.8+(w?2.5*w:0)}
  else{J.fx.t=0;J.fy.t=L==='music'?1:0;J.head.t=-J.rootRot.x*.8}
  J.fy.t+=1.4*w;
  for(const n in J){const j=J[n];if(m)springStep(j,j.t,dt);else{j.x=j.t;j.v=0}}
  const br=m?1+(L==='sleep'?.018:.011)*Math.sin(TAU*t/(L==='sleep'?5.5:4.2)):1;
  Mroot=new DOMMatrix().translate(J.rootX.x,J.rootY.x).translate(100,210).rotate(J.rootRot.x).scale(1/J.sq.x,J.sq.x*br).translate(-100,-210);
  const Lh=new DOMMatrix().translate(...NECK).rotate(J.head.x+J.droop.x).translate(0,J.droop.x*.25+J.nod.x).scale(1/J.hs.x,J.hs.x).translate(-NECK[0],-NECK[1]);
  Mhead=Mroot.multiply(Lh);
  rootG.setAttribute('transform',Mroot.toString());frontG.setAttribute('transform',Mroot.toString());headG.setAttribute('transform',Lh.toString());
  face.setAttribute('transform',`translate(${J.fx.x.toFixed(2)} ${J.fy.x.toFixed(2)})`);ears.setAttribute('transform',`translate(${(-J.fx.x*.45).toFixed(2)} 0)`);
  panY=L==='cook'?1.2*Math.sin(TAU*t/1.15)*env:0;panBob.setAttribute('transform',`translate(0 ${panY.toFixed(2)})`);
  /* headphones: cups ride from the neck to the ears; the band arcs over the head as they go up */
  const cL=cupPos('L'),cR=cupPos('R'),hpk=clamp(J.hp.x,0,1),top=H2(100,10),neck=R2(100,146),ctl=mix(neck,top,hpk);
  const band=`M${cL[0].toFixed(2)} ${(cL[1]-8).toFixed(2)} Q${ctl[0].toFixed(2)} ${ctl[1].toFixed(2)} ${cR[0].toFixed(2)} ${(cR[1]-8).toFixed(2)}`;
  hp.b.setAttribute('d',band);hp.b2.setAttribute('d',band);  const cupRot=(J.head.x+J.droop.x)*hpk+J.rootRot.x;
  const splay=28*(1-hpk); // on the neck the cups rest splayed on the collarbones
  hp.L.setAttribute('transform',`translate(${cL[0].toFixed(2)} ${cL[1].toFixed(2)}) rotate(${(cupRot+splay).toFixed(2)})`);hp.R.setAttribute('transform',`translate(${cR[0].toFixed(2)} ${cR[1].toFixed(2)}) rotate(${(cupRot-splay).toFixed(2)})`);
  /* arms */
  pts.hand={};pts.elbow={};pts.shoulder={};pts.target={};pts.cups={L:cL,R:cR};pts.mouth=H2(...MOUTH,30);
  for(const side of ['L','R']){
    const A=ARM[side],Sw=R2(...SH[side],0),q=poseTarget(side,A.pose,t,env,Sw),tip=q.tip||0;
    if(!A.pole||!m)A.pole=q.pole.slice();
    if(m&&A.reseat&&A.last){const lastEff=tip?add(A.last,mul(A.lastDir,tip)):A.last;A.off=sub(lastEff,q.T);
      if(len(A.off)>25){A.offV=mul(A.off,2.2);J.rootY.v+=5}else A.offV=[0,0,0]}             // anticipation: a small counter-move first
    A.reseat=false;
    if(m){spring3(A.off,A.offV,[0,0,0],90,13,dt);spring3(A.pole,A.poleV,q.pole,60,12,dt)}else{A.off=[0,0,0];A.offV=[0,0,0]}
    const T=add(q.T,A.off),{E,End}=ik(Sw,T,UA,FA+tip,add(Sw,A.pole)),dir=unit(sub(End,E)),Hd=add(E,mul(dir,FA));
    A.last=Hd;A.lastDir=dir;
    const P=p=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`,cuff=mix(Sw,E,.36);
    const limb=`M${P(Sw)}L${P(E)}L${P(Hd)}`;A.limbInk.setAttribute('d',limb);A.limb.setAttribute('d',limb);
    const sl=`M${P(Sw)}L${P(cuff)}`;A.slvInk.setAttribute('d',sl);A.slv.setAttribute('d',sl);
    const mid=mix(Sw,E,.62),ue=unit(sub(E,Sw)),nx=-ue[1]*(side==='L'?1:-1),ny=ue[0]*(side==='L'?1:-1);   // bicep sits on the upper side of the upper arm
    A.bicep.setAttribute('transform',`translate(${(mid[0]+nx*4).toFixed(2)} ${(mid[1]+ny*4).toFixed(2)}) scale(${(J.bicep.x?.55+J.bicep.x*2.2:0).toFixed(3)})`);
    A.hand.setAttribute('transform',`translate(${P(Hd)})`);
    if(tip){spoon.h.setAttribute('d',`M${P(add(Hd,mul(dir,-5)))}L${P(End)}`);spoon.h2.setAttribute('d',`M${P(add(Hd,mul(dir,-4)))}L${P(End)}`);
      spoon.b.setAttribute('transform',`translate(${P(End)}) rotate(${(Math.atan2(dir[1],dir[0])*180/Math.PI).toFixed(1)})`);pts.tip=End}
    else if(side==='R'){const end=add(Hd,mul(dir,SPOON));spoon.h.setAttribute('d',`M${P(add(Hd,mul(dir,-5)))}L${P(end)}`);spoon.h2.setAttribute('d',`M${P(add(Hd,mul(dir,-4)))}L${P(end)}`);
      spoon.b.setAttribute('transform',`translate(${P(end)}) rotate(${(Math.atan2(dir[1],dir[0])*180/Math.PI).toFixed(1)})`);pts.tip=null}
    pts.hand[side]=Hd;pts.elbow[side]=E;pts.shoulder[side]=Sw;pts.target[side]=q;
    if(q.phi!=null)pts['phi'+side]=q.phi;
  }
  pts.w=w;pts.hp=J.hp.x;pts.pose={L:ARM.L.pose,R:ARM.R.pose};pts.earCup={L:H2(...CUP_HEAD.L),R:H2(...CUP_HEAD.R)};{const ht=Mhead.transformPoint({x:100,y:42.5});pts.headTop=[ht.x,ht.y]}
  { const a=pts.hand.L,b=pts.hand.R,u=unit(sub(b,a)),A0=add(a,mul(u,-30)),B0=add(b,mul(u,30)),ang=Math.atan2(u[1],u[0])*180/Math.PI;
    const P=p=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`;bar.r.setAttribute('d',`M${P(A0)}L${P(B0)}`);bar.r2.setAttribute('d',`M${P(A0)}L${P(B0)}`);
    bar.L.setAttribute('transform',`translate(${P(add(a,mul(u,-22)))}) rotate(${ang.toFixed(1)})`);bar.R.setAttribute('transform',`translate(${P(add(b,mul(u,22)))}) rotate(${ang.toFixed(1)})`)}
  /* taste beat: mouth opens as the spoon arrives, then the happy face */
  if(L==='cook'){if(w>.95&&!tasted){tasted=true;expr('taste',650);setTimeout(()=>{if(loopName==='cook')expr('happy',1100)},650)}else if(w===0)tasted=false}
  /* eyes: each pupil turns toward the focus from its own position: offset = r·v/√(|v|²+D²) */
  pts.eye={};pts.pupil={};
  for(const s of ['L','R']){
    const c=Mhead.transformPoint({x:EYE[s][0]+J.fx.x,y:EYE[s][1]+J.fy.x});let ox=0,oy=0;
    if(f){const vx=f.x-c.x,vy=f.y-c.y,k=2.3/Math.hypot(vx,vy,f.D),inv=Mhead.inverse(),p=inv.transformPoint({x:c.x+vx*k,y:c.y+vy*k}),c0=inv.transformPoint(c);ox=p.x-c0.x;oy=p.y-c0.y}
    const pu=pups[s],k=m?Math.min(1,dt*16):1;pu._x=(pu._x||0)+(ox-(pu._x||0))*k;pu._y=(pu._y||0)+(oy-(pu._y||0))*k;
    pu.setAttribute('transform',`translate(${pu._x.toFixed(2)} ${pu._y.toFixed(2)})`);pts.eye[s]=[c.x,c.y];
  }
  pts.focus=f;
  console.assert(cat.spot!=='laptop'||el.dataset.laptop!=='off','Sully self-check: never on (or headed for) the laptop without a laptop');
  catFrame(dt,t,now,m);catSwat(tx,ty);
}

/* ---------- blinks + idle glances ---------- */
function blinkNow(){if(el.dataset.eyes==='closed')return;el.classList.add('blink');setTimeout(()=>el.classList.remove('blink'),130)}
(function blink(){setTimeout(()=>{if(motion()&&el.dataset.state!=='sleep'){blinkNow();if(Math.random()<.18)setTimeout(blinkNow,260)}blink()},rnd(2400,6400))})();
setInterval(()=>{if(motion()&&performance.now()-lastInput>5000&&Math.random()<.5)look(rnd(0,innerWidth),rnd(0,innerHeight*.7),rnd(900,1600))},3200);

/* ---------- speech ---------- */
let bubbleT;function say(t,ms=2800){bubble.textContent=t;bubble.classList.add('on');clearTimeout(bubbleT);bubbleT=setTimeout(()=>bubble.classList.remove('on'),ms)}

/* ================= scenes: enter steps → loop → exit steps; interruptions queue ================= */
const london=()=>{const d=new Date(),p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'numeric',minute:'numeric',hour12:false,weekday:'short'}).formatToParts(d).map(x=>[x.type,x.value]));return {h:+p.hour,m:+p.hour*60+ +p.minute,day:p.weekday}};
const gymHours=()=>{const {m,day}=london();return day==='Sat'?(m>=480&&m<600):day!=='Sun'&&m>=330&&m<480}; // weekdays 05:30–08:00, lighter Saturday
const band=()=>gymHours()?'on':'off';
const SCENES={
  idle:{enter:[],exit:[]},
  wave:{enter:[{ar:'wave',ms:560}],loop:'wave',exit:[{ar:'rest',ms:520}]},
  typing:{enter:[{laptop:'up',eyes:'down',ms:480},{al:'type',ar:'type',laptop:'open',ms:600}],loop:'typing',exit:[{al:'rest',ar:'rest',ms:480},{laptop:'up',eyes:'open',ms:380},{laptop:'off',ms:420}]},
  music:{enter:[{al:'hp',ar:'hp',ms:650},{hp:'head',ms:900},{al:'rest',ar:'rest',eyes:'closed',ms:560}],loop:'music',exit:[{eyes:'open',al:'hp',ar:'hp',ms:650},{hp:'neck',ms:800},{al:'rest',ar:'rest',ms:560}]},
  cook:{enter:[{apron:'on',ms:560},{pan:'up',ms:460},{al:'pan',ar:'stir',spoon:'on',ms:640}],loop:'cook',exit:[{al:'rest',ar:'rest',ms:560},{pan:'off',spoon:'off',ms:420},{apron:'off',ms:520}]},
  curl:{enter:[{band:'on',db:'on',al:'curl',ar:'curl',ms:640}],loop:'curl',exit:[{al:'rest',ar:'rest',ms:560},{db:'off',band,ms:300}]},
  press:{enter:[{band:'on',bar:'on',al:'press',ar:'press',ms:760}],loop:'press',exit:[{al:'rest',ar:'rest',ms:760},{bar:'off',band,ms:300}]},
  flex:{enter:[{al:'flex',ar:'flex',ms:620}],loop:'flex',exit:[{al:'rest',ar:'rest',ms:560}]},
  sleep:{enter:[{eyes:'half',ms:1100},{eyes:'closed',head:'droop',ms:1000}],loop:'sleep',exit:[{eyes:'open',head:'normal',ms:500}]}
};
Object.assign(el.dataset,{al:'rest',ar:'rest',hp:'neck',laptop:'off',db:'off',bar:'off',apron:'off',pan:'off',spoon:'off',band:band(),eyes:'open',head:'normal',loop:'none',phase:'idle',cpose:'none'});
async function step(st){
  for(const[k,v]of Object.entries(st)){if(k==='ms')continue;const val=typeof v==='function'?v():v;el.dataset[k]=val;if(k==='al')setArm('L',val);if(k==='ar')setArm('R',val)}
  if(motion())await wait(st.ms||0);
}
let cur='idle',target='idle',running=false;
async function enterScene(s){const sc=SCENES[s];el.dataset.phase='enter';if(s==='cook'&&motion()&&!cat.busy&&!cat.pinned&&Math.random()<.6)setTimeout(()=>catSit(15000,false,'Sully is supervising. closely.'),900);for(const st of sc.enter)await step(st);loopName=sc.loop||'none';envT=1;el.dataset.loop=loopName;el.dataset.phase='loop'}
async function exitScene(s){const sc=SCENES[s];el.dataset.phase='exit';if(s==='typing'&&cat.spot==='laptop')await catLeave();
  envT=0;if(motion())await wait(380);loopName='none';el.dataset.loop='none';for(const st of sc.exit)await step(st)}
function request(s){if(s===target)return;target=s;if(!running)drive()}
async function drive(){
  running=true;
  try{while(cur!==target){
    if(cur!=='idle'){await exitScene(cur);cur='idle';el.dataset.state='idle'}
    const n=target;if(n!=='idle'){await enterScene(n);cur=n;el.dataset.state=n}
  }}finally{running=false;el.dataset.phase='idle'}
}

/* ---------- director ---------- */
let pinned=null,ctx=null,reaction=null,ambient={state:'idle',until:performance.now()+rnd(7000,10000)},exT;
function nextAmbient(){
  const now=performance.now();
  if(ambient.state!=='idle')return {state:'idle',until:now+rnd(8000,12000)};
  const {h}=london(),gym=gymHours();
  const w=gym?{curl:2,press:1.5,music:1.5,typing:.5}:(h>=9&&h<18)?{typing:3,music:2,curl:.25,cook:.2}:(h>=18&&h<22)?{cook:3,music:2.2,typing:1}:{typing:2,music:1.5}; // gym stays a light touch
  let r=Math.random()*Object.values(w).reduce((a,b)=>a+b),s='idle';for(const[k,v]of Object.entries(w)){if((r-=v)<=0){s=k;break}}
  return {state:s,until:now+rnd(10000,14000)};
}
function tick(){
  const now=performance.now();let s;
  if(pinned)s=pinned;
  else if(reaction&&now<reaction.until)s=reaction.state;
  else{reaction=null;
    if(ctx)s=ctx;
    else if(!motion())s='idle';
    else if(now-lastInput>45000)s='sleep';
    else{if(now>ambient.until)ambient=nextAmbient();s=ambient.state}}
  request(s);
  if(cur==='idle'&&!running)el.dataset.band=band();
  catDirector(now);
}
setInterval(tick,400);
function react(state,ms=2400,line){if(state==='wave')return; // he doesn't wave at visitors
  reaction={state,until:performance.now()+ms+1000};if(line)say(line,ms+900);tick()}
function expr(name,ms=900){el.dataset.ex=name;clearTimeout(exT);if(ms)exT=setTimeout(()=>el.dataset.ex='',ms)}
function wake(){lastInput=performance.now();if(target==='sleep')tick()}
addEventListener('keydown',()=>{lastInput=performance.now()});
addEventListener('pointerdown',e=>{if(!el.contains(e.target)){look(e.clientX,e.clientY,600);J.rootY.v-=1.5}}); // barely a startle: a glance toward the click
document.addEventListener('mouseover',e=>{
  const t=e.target.closest('a,button,.pill');if(!t||el.contains(t))return;
  const r=t.getBoundingClientRect();look(r.left+r.width/2,r.top+r.height/2,1200);
  if(t.matches('.pill.music'))context('music',true);
});
document.addEventListener('mouseout',e=>{if(e.target.closest?.('.pill.music'))context('music',false)});
function context(name,on){ctx=on?name:(ctx===name?null:ctx);tick()}
const QUIPS=["Sully has admin privileges. I'm just a contributor.","one more rep.","the real me has better hair. probably.","shipped on a Friday. it's fine."];let qi=0;
$('.hit').addEventListener('click',()=>{react('flex',2200,qi++%3===2?QUIPS[(qi/3|0)%QUIPS.length]:undefined)}); // a flex, and only now and then a dry line
$('.tuck').addEventListener('click',()=>tuck(true));peek.addEventListener('click',()=>tuck(false));
function tuck(on){el.classList.toggle('tucked',on);peek.classList.toggle('show',on);S.set('tucked',on?'1':'0');}
if(S.get('tucked')==='1'){el.classList.add('tucked');peek.classList.add('show')}

/* ================= Sully: walk cycle, hops, twitches. Always walks in and out. ================= */
const cat={busy:false,leave:false,spot:null,pinned:false,next:performance.now()+rnd(25000,45000),swatT:0};
const C={x:0,y:0,face:1,sx:{x:1,v:0,t:1,k:160,d:14},sy:{x:1,v:0,t:1,k:160,d:14},rot:0,tx:0,vel:0,moving:null,phase:0,amp:0,
         tail:{x:0,v:0,t:0,k:30,d:5},earNext:performance.now()+rnd(3000,7000),blinkNext:performance.now()+rnd(2500,6000)};
const mobile=()=>matchMedia('(max-width:760px)').matches;
const poseEl=p=>catEl.querySelector('.c-'+p);
function catFrame(dt,t,now,m){
  const pose=el.dataset.cpose;if(pose==='none')return;
  if(C.moving){                                                       // walk toward tx with ease-in/ease-out
    const dx=C.tx-C.x,dist=Math.abs(dx),vmax=C.speed,acc=vmax*2.6;
    C.vel=Math.min(vmax,C.vel+acc*dt,Math.sqrt(2*acc*dist)+4);
    const stepPx=Math.min(dist,C.vel*dt);C.x+=Math.sign(dx)*stepPx;C.phase+=stepPx/C.stride;
    if(dist<.6){C.x=C.tx;C.vel=0;const done=C.moving;C.moving=null;done()}
  }
  C.amp+=((C.moving?1:0)-C.amp)*Math.min(1,dt*6);
  springStep(C.sx,C.sx.t,dt);springStep(C.sy,C.sy.t,dt);
  const bob=C.amp*1.1*pulse(C.phase*2);                              // two bobs per stride, weight on each footfall
  catEl.style.transform=`translate(${C.x.toFixed(1)}px,${(C.y+bob).toFixed(1)}px) rotate(${C.rot.toFixed(1)}deg) scale(${(C.face*C.sx.x).toFixed(3)},${C.sy.x.toFixed(3)})`;
  if(pose==='walk'){
    const OFF=[0,.25,.5,.75];                                         // 4-beat gait: near hind, near fore, far hind, far fore
    catEl.querySelectorAll('.c-walk .cleg').forEach(l=>{const i=+l.dataset.i;l.setAttribute('transform',`rotate(${(C.amp*24*Math.sin(TAU*(C.phase+OFF[i]))).toFixed(1)})`)});
    poseEl('walk').querySelector('.chead').setAttribute('transform',`translate(0 ${(-C.amp*.8*pulse(C.phase*2+.15)).toFixed(2)})`);
  }
  if(pose==='sit'){                                                   // Sully watches the pointer too, from his own eyes
    const r=catEl.getBoundingClientRect(),sc=r.width/80;
    poseEl('sit').querySelectorAll('.ceye').forEach(e=>{const ex=r.left+(+e.dataset.cx)*sc,ey=r.top+(+e.dataset.cy)*sc,vx=(tx-ex)*C.face,vy=ty-ey,k=1.5/Math.hypot(vx,vy,60*sc);
      e.querySelector('.cpup').setAttribute('transform',`translate(${(vx*k).toFixed(2)} ${(vy*k).toFixed(2)})`)});
  }
  const tailT=pose==='walk'?-8+C.amp*7*Math.sin(TAU*(C.phase-.18)):pose==='sit'?5*Math.sin(t*1.3)+(Math.sin(t*.37)>.96?-16:0):pose==='loaf'?2*Math.sin(t*.9):0;
  springStep(C.tail,tailT,dt);                                       // the tail lags: overlapping action
  const tl=poseEl(pose)?.querySelector('.ctail');if(tl)tl.setAttribute('transform',`rotate(${C.tail.x.toFixed(1)})`);
  if(pose==='loaf')poseEl('loaf').setAttribute('transform',`translate(0 59) scale(1 ${(1+.03*Math.sin(TAU*t/3.6)).toFixed(4)}) translate(0 -59)`);
  if(m&&now>C.earNext&&(pose==='sit'||pose==='loaf')){C.earNext=now+rnd(3500,9000);const e=poseEl(pose).querySelectorAll('.cear')[Math.random()<.5?0:1];
    e.setAttribute('transform','rotate(-16)');setTimeout(()=>e.setAttribute('transform','rotate(4)'),90);setTimeout(()=>e.removeAttribute('transform'),190)}
  if(m&&now>C.blinkNext&&(pose==='sit'||pose==='walk')){C.blinkNext=now+rnd(2500,6500);poseEl(pose).querySelectorAll('.ceye').forEach(e=>{const cx=e.dataset.cx,cy=e.dataset.cy;
    e.setAttribute('transform',`translate(${cx} ${cy}) scale(1 .12) translate(${-cx} ${-cy})`);setTimeout(()=>e.removeAttribute('transform'),140)})}
}
function geo(){const b=el.getBoundingClientRect(),w=catEl.offsetWidth,anchor=b.left+catEl.offsetLeft,side=mobile()?1:-1;
  return {side,w,off:side<0?-(anchor+w+24):(innerWidth-anchor+24),napX:b.left+b.width/2-w/2-anchor,napY:-(b.height*40/210)+3}}
function place(x,y){C.x=C.tx=x;C.y=y;C.vel=0}
function walkTo(x){const w=catEl.offsetWidth;C.speed=110*w/60;C.stride=30*w/60;C.tx=x;
  if(!motion()){C.x=x;return Promise.resolve()}return new Promise(r=>{C.moving=r})}
function tween(ms,f){if(!motion()){f(1);return Promise.resolve()}return new Promise(r=>{const t0=performance.now();(function s(n){const p=Math.min(1,(n-t0)/ms);f(p);p<1?requestAnimationFrame(s):r()})(t0)})}
async function hop(x,y,h=26){                                       // crouch (anticipation) → arc → land (squash) → settle
  const x0=C.x,y0=C.y,dir=Math.sign(x-x0)||1;
  if(motion()){C.sy.t=.84;C.sx.t=1.08;await wait(150)}
  C.sy.t=1.08;C.sx.t=.95;
  await tween(380,p=>{const e=p<.5?2*p*p:1-2*(1-p)*(1-p);C.x=x0+(x-x0)*e;C.y=y0+(y-y0)*p-h*4*p*(1-p);C.rot=(p<.5?-7:7)*dir*C.face*Math.sin(Math.PI*p)});
  C.rot=0;C.tx=C.x;C.sy.t=.88;C.sx.t=1.07;C.sy.v=0;if(motion())await wait(110);C.sy.t=1;C.sx.t=1;
}
async function hold(ms){const t0=performance.now();while(performance.now()-t0<ms&&!cat.leave)await wait(120)}
async function walkIn(x){const g=geo();cat.busy=true;cat.leave=false;el.dataset.cpose='walk';C.face=g.side<0?1:-1;place(g.off,0);await walkTo(x)}
async function walkOut(){const g=geo();el.dataset.cpose='walk';C.face=g.side<0?-1:1;await walkTo(g.off);el.dataset.cpose='none';cat.busy=false;cat.spot=null;cat.next=performance.now()+rnd(50000,90000)}
async function stillPose(pose,x,y,ms,spot){cat.busy=true;place(x,y);C.face=1;el.dataset.cpose=pose;cat.spot=spot;await hold(ms);el.dataset.cpose='none';cat.busy=false;cat.spot=null}
async function catSit(ms=9000,swat,line){
  if(cat.busy)return;if(!motion())return stillPose('sit',0,0,ms,'floor');
  await walkIn(0);C.sy.t=.93;el.dataset.cpose='sit';cat.spot='floor';setTimeout(()=>C.sy.t=1,120);   // settles onto his haunches
  if(swat)setTimeout(swatNow,700);if(line)say(line,2600);
  await hold(ms);C.sy.t=1.05;await wait(140);C.sy.t=1;await walkOut();
}
/* the laptop is claimed the moment a nap or walk is chosen, so the typing exit waits for him (exitScene → catLeave).
   Only while typing is settled: mid-exit or mid-enter the laptop may be going away, so he takes the floor instead. */
const claimLaptop=()=>{if(cur!=='typing'||running)return false;cat.spot='laptop';return true};
async function catNap(ms=14000){
  if(cat.busy)return;if(!claimLaptop())return catSit();const g=geo();if(!motion())return stillPose('loaf',g.napX,g.napY,ms,'laptop');
  const beside=g.napX+(g.side<0?-1:1)*g.w*.95;
  await walkIn(beside);await hop(g.napX,g.napY);
  C.face=1;el.dataset.cpose='loaf';if(!cat.leave)say('Sully has claimed the laptop.',2600);
  await hold(ms);
  el.dataset.cpose='stretch';const st=poseEl('stretch');
  await tween(1300,p=>{const s=1+.1*Math.sin(Math.PI*p);st.setAttribute('transform',`translate(18 58) scale(${s.toFixed(3)} 1) translate(-18 -58)`)});st.removeAttribute('transform');
  el.dataset.cpose='walk';C.face=g.side<0?-1:1;await hop(beside,0,18);
  await walkOut();
}
async function catWalk(){
  if(cat.busy)return;if(!claimLaptop())return catSit();const g=geo();if(!motion())return stillPose('walk',g.napX,g.napY,4000,'laptop');
  const s=g.side<0?-1:1,near=g.napX+s*g.w*.95,far=g.napX-s*g.w*.95;
  await walkIn(near);await hop(g.napX+s*g.w*.35,g.napY);
  expr('surprised',1400);document.dispatchEvent(new CustomEvent('buddy:catwalk'));
  await walkTo(g.napX-s*g.w*.35);
  C.face=-C.face;await hop(far,0,18);cat.spot='floor';
  C.face=-C.face;await walkOut();
}
async function catLeave(){if(!cat.busy)return;cat.leave=true;while(cat.busy)await wait(100)}
function swatNow(){if(el.dataset.cpose!=='sit')return;const p=poseEl('sit').querySelector('.cpaw');
  tween(760,q=>{const a=-70*Math.abs(Math.sin(TAU*q));p.setAttribute('transform',`rotate(${a.toFixed(1)})`)}).then(()=>p.removeAttribute('transform'))}
function catSwat(px,py){if(el.dataset.cpose!=='sit'||!motion()||performance.now()<cat.swatT)return;const r=catEl.getBoundingClientRect();
  if(Math.hypot(px-(r.left+r.width/2),py-(r.top+r.height*.4))<110){cat.swatT=performance.now()+1500;swatNow()}}
function catDirector(now){
  if(cat.pinned||cat.busy||!motion()||pinned||now<cat.next)return;
  if(cur==='typing')(Math.random()<.5?catNap:catWalk)();else catSit();
}
async function catPreview(s){
  cat.pinned=s!=='auto';if(s==='auto'||s==='none'){await catLeave();return}
  await catLeave();
  if(s==='nap'||s==='walk'){pinned='typing';tick();while(cur!=='typing')await wait(100)}
  ({sit:()=>catSit(),swat:()=>catSit(9000,true),nap:()=>catNap(),walk:()=>catWalk()})[s]();
}

requestAnimationFrame(frame);
/* first hello (not on in-site page changes) */
tick();

window.Buddy={STATES,CATS,SKINS,LIKENESS,setLikeness,say,react,expr,context,look,
  pin(s){pinned=s==='auto'?null:s;tick()},
  cat:catPreview,catShow(){catSit()},catLeave,
  get state(){return el.dataset.state},get target(){return target},get phase(){return el.dataset.phase},get catState(){return el.dataset.cpose},get catSpot(){return cat.spot}};
})();
