// SEPTILLION — ULAZ: dva svijeta i živi šav između njih (prototip v4).
import { $, $$, clamp, lerp, easeIO, seamAt, RM } from './core/dom';
import { job, unjob, T0 } from './core/loop';
import { initNav, goFade } from './core/nav';
import { initChrome } from './core/chrome';
import { Swarm } from './swarm';

const arrived = initNav();
initChrome('gate');

const sec = $('.view-gate'), cv = $<HTMLCanvasElement>('#gate-gl'), jc = $<HTMLCanvasElement>('#gate-jelly');
const la = $('.gate-a'), lb = $('.gate-b');
const sideA = $<HTMLAnchorElement>('.side.a'), sideB = $<HTMLAnchorElement>('.side.b');
let gl: WebGLRenderingContext | null = null, tex: WebGLTexture | null = null, texSize = [1800, 1200], ok = false;
const U: Record<string, WebGLUniformLocation | null> = {};
let seam = 0.5, target = 0.5, amp = 1, vert = false, pointerIn = false;
let flooding: { side: 'a' | 'b'; from: number; t0: number; to: 'pasta-rhymes' | 'jellyfish-in-space'; url: string } | null = null, arriving = false;
let rmDirty = true; // smanjeno kretanje: crta se samo kad treba
addEventListener('resize', () => { rmDirty = true; });

// naljepnice na strani Paste (iscrtane pri buildu); na uskom ekranu drugi raspored
const stk = $$('.stk', la);
const stkPos = () => {
  const m = sec.clientWidth < 760 && sec.clientHeight > sec.clientWidth;
  const D = [['5%', '17%'], ['27%', '27%'], ['15%', '37%'], ['35%', '50%']], M = [['62%', '14%'], ['70%', '30%'], ['56%', '40%'], ['80%', '44%']];
  stk.forEach((s, i) => { const p = (m ? M : D)[i]; s.style.left = p[0]; s.style.top = p[1]; s.style.display = m && i === 2 ? 'none' : ''; });
};
stkPos(); addEventListener('resize', stkPos);

function initGL() {
  gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision highp float;
uniform vec2 uRes,uASize,uM;uniform float uT,uSeam,uAmp,uVert;uniform sampler2D uA;
float seamF(float u){return uSeam+uAmp*(0.030*sin(u*6.0+uT*0.9)+0.018*sin(u*13.0-uT*1.4)+0.008*sin(u*27.0+uT*2.1));}
vec2 cover(vec2 uv,vec2 res,vec2 im){vec2 s=res/im;float sc=max(s.x,s.y);vec2 sz=im*sc;vec2 off=(res-sz)*.5;return (uv*res-off)/sz;}
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*nz(p);p*=2.03;a*=.5;}return v;}
float stars(vec2 q,float sc,float thr,float sp){vec2 g=floor(q*sc),f=fract(q*sc);float h=h21(g);if(h<thr)return 0.;vec2 c=vec2(h21(g+1.3),h21(g+2.7))*.8+.1;
 float r=length(f-c);return smoothstep(.09,0.,r)*(.55+.45*sin(uT*sp+h*60.));}
void main(){
 vec2 st=vec2(gl_FragCoord.x/uRes.x,1.-gl_FragCoord.y/uRes.y);
 float along=uVert>.5?st.x:st.y, across=uVert>.5?st.y:st.x;
 float d=across-seamF(along);
 float edge=exp(-abs(d)*80.);
 vec2 pa=cover(st+uM*.012,uRes,uASize);
 vec3 A=vec3(texture2D(uA,pa+vec2(edge*.007,0)).r,texture2D(uA,pa).g,texture2D(uA,pa-vec2(edge*.007,0)).b);
 A+= (h21(st*uRes+uT)-.5)*.05;
 vec2 q=st*vec2(uRes.x/uRes.y,1.);
 float n=fbm(q*1.5+vec2(uT*.012,-uT*.008));
 vec3 B=vec3(.01,.01,.018)+vec3(.05,.055,.08)*pow(n,2.4)+vec3(.02,.015,.03)*pow(fbm(q*3.-uT*.02),3.);
 B+=vec3(stars(q,90.,.965,2.)*.9+stars(q,34.,.985,1.3));
 float m=smoothstep(-.0012,.0012,d);
 vec3 col=mix(A,B,m);
 float core=exp(-abs(d)*700.), glow=exp(-abs(d)*55.);
 col+=vec3(1.)*core*.85+vec3(1.,.28,.2)*glow*.32*(1.-m)+vec3(.62,.78,1.)*glow*.22*m;
 col*=1.-.22*length(st-.5);
 gl_FragColor=vec4(col,1.);
}`;
  const g = gl;
  const sh = (type: number, src: string) => {
    const o = g.createShader(type)!; g.shaderSource(o, src); g.compileShader(o);
    if (!g.getShaderParameter(o, g.COMPILE_STATUS)) { console.warn(g.getShaderInfoLog(o)); return null; }
    return o;
  };
  const v = sh(g.VERTEX_SHADER, vs), f = sh(g.FRAGMENT_SHADER, fs);
  if (!v || !f) return false;
  const prog = g.createProgram()!; g.attachShader(prog, v); g.attachShader(prog, f); g.linkProgram(prog); g.useProgram(prog);
  const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  for (const n of ['uRes', 'uASize', 'uM', 'uT', 'uSeam', 'uAmp', 'uVert', 'uA']) U[n] = g.getUniformLocation(prog, n);
  tex = g.createTexture();
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => {
    g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    texSize = [im.naturalWidth, im.naturalHeight]; ok = true;
  };
  im.src = cv.dataset.tex!;
  return true;
}
// Prilagodljiva kvaliteta: na brzom GPU-u isto kao prototip; na softverskom/sporom renderiranju
// šav se crta u nižoj razlučivosti i rjeđe, da glavna nit ostane slobodna (mobitel, stari uređaji).
let quality = 1, every = 1, fcount = 0;
const dts: number[] = [];
function softwareGL(g: WebGLRenderingContext) {
  const ext = g.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? String(g.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software|basic render/i.test(r);
}
let lastF = 0;
function adapt() {
  // stvarni razmak kadrova (dt iz petlje je ograničen na 0,05 s)
  const now = performance.now(), dt = lastF ? (now - lastF) / 1000 : 0; lastF = now;
  if (dt <= 0 || dt > 1 || document.hidden) return;
  dts.push(dt); if (dts.length < 10) return;
  const avg = dts.reduce((a, b) => a + b, 0) / dts.length; dts.length = 0;
  if (avg > 0.08) { quality = 0.4; every = 2; resize(); } // jako sporo: odmah najniža razina
  else if (avg > 0.034 && quality > 0.4) { quality = Math.max(0.4, quality * 0.7); resize(); }
  else if (avg > 0.034 && every < 3) every++;
}
function resize() {
  const W = sec.clientWidth, H = sec.clientHeight, dpr = Math.min(W < 760 ? 1.4 : 1.75, devicePixelRatio) * quality;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); vert = W < 760 && H > W;
  if (gl) gl.viewport(0, 0, cv.width, cv.height);
}
const hasGL = initGL();
if (gl && softwareGL(gl)) { quality = 0.4; every = 2; }
resize(); addEventListener('resize', resize);
if (!hasGL) cv.style.background = 'linear-gradient(90deg,#FE0000 50%,#050507 50%)';

// meduze samo na strani Jellyfisha
const swarm = new Swarm(jc, { count: innerWidth < 700 ? 8 : 15, region: () => (vert ? { x0: 0, x1: 1 } : { x0: 0.52, x1: 1 }) });

function polys(t: number) {
  const N = 26, A: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, s = seamAt(u, t, seam, amp) * 100;
    A.push(vert ? `${(u * 100).toFixed(2)}% ${s.toFixed(2)}%` : `${s.toFixed(2)}% ${(u * 100).toFixed(2)}%`);
  }
  if (vert) return { a: `polygon(0 0,100% 0,${A.slice().reverse().join(',')})`, b: `polygon(${A.join(',')},100% 100%,0 100%)` };
  return { a: `polygon(0 0,${A.join(',')},0 100%)`, b: `polygon(${A.join(',')},100% 100%,100% 0)` };
}

let mx = 0.5, my = 0.5;
sec.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointerIn = true;
  const r = sec.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
});
sec.addEventListener('pointerleave', () => { pointerIn = false; });
// mobitel: prst kao miš — dok klizi po ulazu, šav ga prati i ističe stranu pod prstom; izbor ostaje nakon
// podizanja prsta, a kratki dodir i dalje otvara lokal (klizanje ne otvara ništa)
const prst = (e: TouchEvent) => {
  const t = e.touches[0]; if (!t || flooding) return;
  pointerIn = true;
  const r = sec.getBoundingClientRect(); mx = (t.clientX - r.left) / r.width; my = (t.clientY - r.top) / r.height;
};
sec.addEventListener('touchstart', prst, { passive: true });
sec.addEventListener('touchmove', prst, { passive: true });
for (const s of [sideA, sideB]) {
  s.addEventListener('focus', () => { pointerIn = true; mx = s === sideA ? 0.15 : 0.85; my = s === sideA ? 0.25 : 0.75; });
  s.addEventListener('blur', () => { pointerIn = false; });
  s.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); flood(s === sideA ? 'a' : 'b');
  });
}
// klik bilo gdje na strani
sec.addEventListener('click', (e) => {
  if ((e.target as Element).closest('a')) return;
  const r = sec.getBoundingClientRect();
  const u = vert ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
  const v = vert ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
  flood(v < seamAt(u, (performance.now() - T0) / 1000, seam, amp) ? 'a' : 'b');
});

function flood(side: 'a' | 'b') {
  if (flooding) return;
  const to = side === 'a' ? 'pasta-rhymes' : 'jellyfish-in-space';
  const url = (side === 'a' ? sideA : sideB).href;
  if (RM) { location.assign(url); return; }
  flooding = { side, from: seam, t0: performance.now(), to, url };
}

function frame(t: number, dt: number) {
  // smanjeno kretanje: šav miruje u sredini, nebo i meduze su jedan statičan kadar
  if (RM) { if (rmDirty) { seam = 0.5; amp = 1; draw(0); swarm.step(0, 0); rmDirty = !ok; } return; }
  if (flooding) {
    const k = clamp((performance.now() - flooding.t0) / 720, 0, 1), e = easeIO(k);
    seam = lerp(flooding.from, flooding.side === 'a' ? 1.28 : -0.28, e); amp = 1 + e * 1.6;
    if (k >= 1) { const f = flooding; unjob('gate'); draw(t); goFade(f.to, f.url); return; }
  } else {
    if (arriving) target = 0.5;
    else if (pointerIn) target = vert ? 0.5 + (0.5 - my) * 0.34 : 0.5 + (0.5 - mx) * 0.38;
    else target = 0.5 + Math.sin(t * (vert ? 0.55 : 0.4)) * (vert ? 0.055 : 0.035);
    seam = lerp(seam, clamp(target, 0.2, 0.8), RM ? 1 : dt * 3.2); amp = lerp(amp, 1, dt * 3);
    if (arriving && Math.abs(seam - 0.5) < 0.01) arriving = false;
  }
  draw(t);
  swarm.step(t, dt);
  if (!flooding) adapt();
  // tko pobjeđuje
  sideA.classList.toggle('dim', seam < 0.43); sideB.classList.toggle('dim', seam > 0.57);
}
function draw(t: number) {
  if (ok && gl && fcount++ % every === 0) {
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform2f(U.uASize, texSize[0], texSize[1]);
    gl.uniform2f(U.uM, mx - 0.5, my - 0.5); gl.uniform1f(U.uT, t); gl.uniform1f(U.uSeam, seam); gl.uniform1f(U.uAmp, amp);
    gl.uniform1f(U.uVert, vert ? 1 : 0); gl.uniform1i(U.uA, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // DOM slojevi prate isti šav
  const p = polys(t); la.style.clipPath = p.a; lb.style.clipPath = p.b; jc.style.clipPath = p.b;
}

function start() {
  // dolazak iz lokala: šav kreće s ruba tog lokala i vraća se u sredinu
  if (arrived && arrived.from !== 'gate' && !RM) { seam = arrived.from === 'pasta-rhymes' ? 1.2 : -0.2; arriving = true; }
  stk.forEach((s, i) => { s.classList.remove('slap'); void s.offsetWidth; s.style.animationDelay = 0.25 + i * 0.12 + 's'; s.classList.add('slap'); });
  resize(); swarm.resize(); job('gate', frame);
}
start();
// povratak iz bfcache-a usred "poplave"
addEventListener('sx:restore', () => { flooding = null; seam = 0.5; amp = 1; job('gate', frame); });
