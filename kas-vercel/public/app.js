/* Buku Kas Harian - logika aplikasi.
   Data disimpan di database SQLite lewat backend (server.js) bila terhubung;
   jika backend tidak ada, otomatis memakai localStorage (kunci "kas_v1").
   Bagian utama: period() / sorted() = hitungan kas, render() = tampilan,
   shRK / shPP / shBH / shPU + build() = isi file Excel (ExcelJS, mengikuti template Training_ke_AI.xlsx),
   monthly() + share() = bagi hasil bulanan, renderPU() = piutang & utang,
   fmtIn() = format angka otomatis (300000 -> 300.000). */
const $=s=>document.querySelector(s);
const KEY='kas_v1';
const DEF={init:0,pA:60,nA:'Pihak 1',nB:'Pihak 2',nk:''};
let S={...DEF,tx:[]};
let SERVER=false;   // true = terhubung ke backend (database SQLite)
const API=((window.KAS_API||'')+'/api');
async function api(method,path,body,retry=true){
 const key=(()=>{try{return localStorage.getItem('kas_key')||''}catch(e){return''}})();
 const hd={};if(body)hd['Content-Type']='application/json';if(key)hd['x-kas-key']=key;
 const r=await fetch(API+path,{method,headers:hd,body:body?JSON.stringify(body):undefined});
 const o=await r.json().catch(()=>({}));
 if(r.status===401&&retry){   // server meminta kata sandi (mis. di Vercel)
  const k=prompt(key?'Kata sandi salah. Masukkan lagi:':'Masukkan kata sandi aplikasi:');
  if(k!==null){try{localStorage.setItem('kas_key',k.trim())}catch(e){}return api(method,path,body,false)}}
 if(!r.ok)throw new Error(o.error||('Server error '+r.status));
 return o}
try{const r=localStorage.getItem(KEY);if(r)S=Object.assign(S,JSON.parse(r))}catch(e){}
let tmr;
// save(): simpan pengaturan (ke database jika terhubung, selain itu ke localStorage)
const save=()=>{if(SERVER){clearTimeout(tmr);tmr=setTimeout(()=>api('PUT','/settings',{init:S.init,pA:S.pA,nA:S.nA,nB:S.nB,nk:S.nk}).catch(e=>setMode(false,e.message)),400)}
 else{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}};
// saveTx(): transaksi disimpan lewat API saat SERVER; hanya mode lokal yang menulis localStorage
const saveTx=()=>{if(!SERVER)save()};
const fmt=n=>new Intl.NumberFormat('id-ID').format(Math.round(n));
const rp=n=>(n<0?'-':'')+'Rp '+fmt(Math.abs(n));
const fd=d=>d.split('-').reverse().join('/');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mName=m=>{const[y,mo]=m.split('-');return new Date(+y,mo-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const isL=x=>x.s!=='belum';
const sorted=()=>S.tx.filter(isL).map(x=>({...x,od:x.d,d:x.dp||x.d})).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:a.id-b.id);
const pend=()=>S.tx.filter(x=>!isL(x)).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:a.id-b.id);
const MT={rekening:'Rekening',qris:'QRIS',cash:'Cash'};
const byM=(tx,k)=>tx.filter(x=>x.t==='in'&&x.m===k).reduce((s,x)=>s+x.a,0);
const sgn=x=>x.t==='in'?x.a:-x.a;
function period(scope){const all=sorted();
 if(scope==='all')return{tx:all,open:S.init,label:'Semua periode'};
 const m=$('#bulan').value,first=m+'-01';
 return{tx:all.filter(x=>x.d.startsWith(m)),open:S.init+all.filter(x=>x.d<first).reduce((s,x)=>s+sgn(x),0),label:mName(m)}}
function daily(tx){const o={};tx.forEach(x=>{const r=o[x.d]??={d:x.d,i:0,o:0};x.t==='in'?r.i+=x.a:r.o+=x.a});return Object.values(o).sort((a,b)=>a.d<b.d?-1:1)}
function monthly(tx){const o={};tx.forEach(x=>{const k=x.d.slice(0,7),r=o[k]??={m:k,i:0,o:0};x.t==='in'?r.i+=x.a:r.o+=x.a});return Object.values(o).sort((a,b)=>a.m<b.m?-1:1)}
function share(l){if(l<=0)return[0,0];const a=Math.round(l*S.pA/100);return[a,l-a]}
const sum=(tx,t)=>tx.filter(x=>x.t===t).reduce((s,x)=>s+x.a,0);
function bycat(tx,t){const o={};tx.filter(x=>x.t===t).forEach(x=>{const k=x.c||'Lainnya';o[k]=(o[k]||0)+x.a});return Object.entries(o).sort((a,b)=>b[1]-a[1])}

function render(){
 const p=period('m'),tx=p.tx;
 $('#kasBln').textContent=p.label;
 // Buku kas umum
 let bal=p.open,ti=0,to=0;
 let rows=`<tr><td colspan="5"><b>Saldo awal</b></td><td class="n" colspan="2"><b>${rp(p.open)}</b></td><td></td></tr>`;
 tx.forEach(x=>{bal+=sgn(x);x.t==='in'?ti+=x.a:to+=x.a;
  rows+=`<tr><td data-label="Tanggal">${fd(x.d)}</td><td data-label="Kategori">${esc(x.c||'-')}</td><td data-label="Uraian">${esc(x.k||'')}${x.od!==x.d?' <span class="mut">(trx '+fd(x.od)+')</span>':''}</td><td data-label="Metode">${x.t==='in'?MT[x.m]||'-':''}</td><td data-label="Penerimaan" class="n in">${x.t==='in'?fmt(x.a):''}</td><td data-label="Pengeluaran" class="n out">${x.t==='out'?fmt(x.a):''}</td><td data-label="Saldo" class="n">${fmt(bal)}</td><td><button class="g" data-del="${x.id}">✕</button></td></tr>`});
 $('#kasT').innerHTML=`<table class="rt"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Uraian</th><th>Metode</th><th class="n">Penerimaan</th><th class="n">Pengeluaran</th><th class="n">Saldo</th><th></th></tr></thead><tbody>${rows}</tbody>
 <tfoot><tr><td colspan="4">Total bulan ini</td><td data-label="Penerimaan" class="n in">${fmt(ti)}</td><td data-label="Pengeluaran" class="n out">${fmt(to)}</td><td data-label="Saldo akhir" class="n">${fmt(bal)}</td><td></td></tr></tfoot></table>`+(tx.length?'':'<div class="empty">Belum ada transaksi di bulan ini.</div>');
 // Dashboard
 const dd=daily(tx),laba=ti-to,profitDays=dd.filter(r=>r.i-r.o>0).length;
 const bhTot=share(laba);
 $('#kpi').innerHTML=[['Pemasukan',rp(ti),'in'],['Pengeluaran',rp(to),'out'],['Laba / rugi',rp(laba),laba<0?'out':'in'],['Saldo akhir kas',rp(bal),''],['Hari untung',profitDays+' / '+dd.length+' hari',''],['Masuk via Rekening',rp(byM(tx,'rekening')),''],['Masuk via QRIS',rp(byM(tx,'qris')),''],['Masuk via Cash',rp(byM(tx,'cash')),''],['Piutang belum lunas',rp(sum(pend(),'in')),''],['Utang belum lunas',rp(sum(pend(),'out')),''],[esc(S.nA)+' ('+S.pA+'%)',rp(bhTot[0]),''],[esc(S.nB)+' ('+(100-S.pA)+'%)',rp(bhTot[1]),'']]
  .map(k=>`<div class="kpi"><span class="mut">${k[0]}</span><b class="${k[2]}">${k[1]}</b></div>`).join('');
 const m=$('#bulan').value,[y,mo]=m.split('-').map(Number),days=new Date(y,mo,0).getDate();
 const map=Object.fromEntries(dd.map(r=>[r.d,r]));const mx=Math.max(1,...dd.map(r=>Math.max(r.i,r.o)));
 let ch='';for(let i=1;i<=days;i++){const r=map[m+'-'+String(i).padStart(2,'0')]||{i:0,o:0};
  ch+=`<div class="col" title="${i}: masuk ${fmt(r.i)} / keluar ${fmt(r.o)}"><div class="bars"><i style="background:var(--in);height:${r.i/mx*100}%"></i><i style="background:var(--out);height:${r.o/mx*100}%"></i></div><small>${i}</small></div>`}
 $('#chart').innerHTML=ch;$('#chart').style.minWidth=days*22+'px';
 const catHtml=(t,c)=>{const l=bycat(tx,t),tot=sum(tx,t);return l.length?l.map(([k,v])=>`<div style="margin:6px 0"><div style="display:flex;justify-content:space-between"><span>${esc(k)}</span><b>${rp(v)}</b></div><div style="height:6px;background:var(--soft);border-radius:3px"><div style="height:6px;border-radius:3px;background:var(--${c});width:${v/tot*100}%"></div></div></div>`).join(''):'<div class="mut">Belum ada data.</div>'};
 $('#cIn').innerHTML=catHtml('in','in');$('#cOut').innerHTML=catHtml('out','out');
 // Bagi hasil (bulanan)
 let tA=0,tB=0,tl=0,tIn=0,tOut=0,br='';
 const mm=monthly(sorted());
 mm.forEach(r=>{const l=r.i-r.o,[a,b]=share(l);tA+=a;tB+=b;tl+=l;tIn+=r.i;tOut+=r.o;
  br+=`<tr${r.m===m?' style="background:var(--soft)"':''}><td data-label="Bulan">${mName(r.m)}</td><td data-label="Pemasukan" class="n">${fmt(r.i)}</td><td data-label="Pengeluaran" class="n">${fmt(r.o)}</td><td data-label="Laba bulanan" class="n ${l<0?'out':'in'}">${fmt(l)}</td><td data-label="${esc(S.nA)} ${S.pA}%" class="n">${fmt(a)}</td><td data-label="${esc(S.nB)} ${100-S.pA}%" class="n">${fmt(b)}</td></tr>`});
 $('#bhT').innerHTML=`<table class="rt"><thead><tr><th>Bulan</th><th class="n">Pemasukan</th><th class="n">Pengeluaran</th><th class="n">Laba bulanan</th><th class="n">${esc(S.nA)} ${S.pA}%</th><th class="n">${esc(S.nB)} ${100-S.pA}%</th></tr></thead><tbody>${br}</tbody><tfoot><tr><td><b>Total</b></td><td data-label="Pemasukan" class="n">${fmt(tIn)}</td><td data-label="Pengeluaran" class="n">${fmt(tOut)}</td><td data-label="Laba" class="n">${fmt(tl)}</td><td data-label="${esc(S.nA)}" class="n">${fmt(tA)}</td><td data-label="${esc(S.nB)}" class="n">${fmt(tB)}</td></tr></tfoot></table>`+(mm.length?'':'<div class="empty">Belum ada data.</div>');
 $('#pB').value=100-S.pA;renderPU();
 const cats=[...new Set(S.tx.map(x=>x.c).filter(Boolean))];$('#kl').innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join('');
}

function puGroup(t){const l=pend().filter(x=>x.t===t),g={};l.forEach(x=>{const k=x.p||'(tanpa nama)';g[k]=(g[k]||0)+x.a});return{l,g:Object.entries(g).sort((a,b)=>b[1]-a[1])}}
const age=d=>Math.max(0,Math.round((new Date(today())-new Date(d))/864e5));
function renderPU(){
 const pi=sum(pend(),'in'),ut=sum(pend(),'out');
 $('#puK').innerHTML=[['Total piutang',rp(pi),'in'],['Total utang',rp(ut),'out'],['Posisi bersih (piutang − utang)',rp(pi-ut),pi-ut<0?'out':'in']].map(k=>`<div class="kpi"><span class="mut">${k[0]}</span><b class="${k[2]}">${k[1]}</b></div>`).join('');
 [['in','#puIn','Pelanggan'],['out','#puOut','Pemasok']].forEach(([t,sel,pl])=>{
  const{l,g}=puGroup(t);
  if(!l.length){$(sel).innerHTML='<div class="empty">Tidak ada yang belum lunas.</div>';return}
  const rec=`<table style="min-width:0;margin-bottom:12px"><thead><tr><th>${pl}</th><th class="n">Total</th></tr></thead><tbody>${g.map(([k,v])=>`<tr><td>${esc(k)}</td><td class="n">${fmt(v)}</td></tr>`).join('')}</tbody></table>`;
  const det=l.map(x=>`<tr><td data-label="Tanggal">${fd(x.d)}</td><td data-label="${pl}">${esc(x.p||'-')}</td><td data-label="Uraian">${esc([x.c,x.k].filter(Boolean).join(' - '))}</td><td data-label="Jumlah" class="n">${fmt(x.a)}</td><td data-label="Umur" class="n">${age(x.d)} hr</td><td>${t==='in'?`<select data-mt="${x.id}" style="width:auto;padding:4px">${Object.keys(MT).map(m=>`<option value="${m}"${x.m===m?' selected':''}>${MT[m]}</option>`).join('')}</select> `:''}<button data-pay="${x.id}">Lunasi</button> <button class="g" data-del="${x.id}">✕</button></td></tr>`).join('');
  $(sel).innerHTML=rec+`<table class="rt"><thead><tr><th>Tanggal</th><th>${pl}</th><th>Uraian</th><th class="n">Jumlah</th><th class="n">Umur</th><th>Aksi</th></tr></thead><tbody>${det}</tbody></table>`})}
// ---- Excel ----
// ---- Excel (ExcelJS) - tata letak mengikuti template Training_ke_AI.xlsx ----
const FN={name:'Calibri',size:12},FB={name:'Calibri',size:12,bold:true};
const P1='F2CEEF',P2='FBE3D6',ACC='_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-',CT={horizontal:'center',vertical:'middle'},LF={horizontal:'left',vertical:'middle'};
const bx=(st,k='LRTB')=>{const o={};[['L','left'],['R','right'],['T','top'],['B','bottom']].forEach(([c,n])=>{if(k.includes(c))o[n]={style:st}});return o};
const fl=c=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}});
const ud=d=>{const[y,m,dd]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,dd))};
const kn=()=>(S.nk||'').trim()||'[Nama Kantin]';
function put(ws,a,v,o={}){const c=ws.getCell(a);if(v!==undefined&&v!==null)c.value=v;c.font=o.b?FB:FN;if(o.f)c.fill=fl(o.f);if(o.bd)c.border=o.bd;c.alignment=o.al||{vertical:'middle'};if(o.nf)c.numFmt=o.nf;return c}
function titleRows(ws,last,t1,t2,nf){ws.mergeCells('A1:'+last+'1');put(ws,'A1',t1,{b:1,al:CT});ws.mergeCells('A2:'+last+'2');put(ws,'A2',t2,{b:1,al:CT,nf})}
const pdate=(p,scope)=>scope==='all'?p.label:ud($('#bulan').value+'-01');

function shRK(wb,p,tx,scope){
 const ws=wb.addWorksheet('Rekening Koran',{views:[{showGridLines:false}]});
 [11,64.25,18.25,17.66,18.33].forEach((w,i)=>ws.getColumn(i+1).width=w);
 titleRows(ws,'E','BUKU REKENING KORAN '+kn().toUpperCase(),pdate(p,scope),'mmm-yy');
 'ABCDE'.split('').forEach(c=>put(ws,c+'3',null,{bd:bx('thin','B')}));
 ['Tanggal','Uraian','Debit (Rp)','Kredit (Rp)','Saldo (Rp)'].forEach((h,i)=>put(ws,'ABCDE'[i]+'4',h,{b:1,f:P1,bd:bx('thin'),al:CT}));
 const n=Math.max(55,tx.length+1);let bal=p.open,td=0,tk=0;
 for(let i=0;i<n;i++){const r=5+i;let a=null,b=null,c=null,d=null,e=null;
  if(i===0){b='Saldo awal';e=bal}
  else if(tx[i-1]){const x=tx[i-1];bal+=sgn(x);a=ud(x.d);b=[x.t==='in'&&MT[x.m],x.c,x.k].filter(Boolean).join(' - ');
   if(x.t==='out'){c=x.a;td+=x.a}else{d=x.a;tk+=x.a}e={formula:`E${r-1}+D${r}-C${r}`,result:bal}}
  const B={bd:bx('thin')};
  put(ws,'A'+r,a,{...B,nf:'d-mmm-yy',al:LF});put(ws,'B'+r,b,B);put(ws,'C'+r,c,{...B,nf:ACC});put(ws,'D'+r,d,{...B,nf:ACC});put(ws,'E'+r,e,{...B,nf:ACC})}
 const t=5+n,T={b:1,f:P1,bd:bx('thin'),nf:ACC};
 ws.mergeCells(`A${t}:B${t}`);put(ws,'A'+t,'Jumlah',{b:1,f:P1,bd:bx('thin'),al:CT});put(ws,'B'+t,null,{b:1,f:P1,bd:bx('thin')});
 put(ws,'C'+t,{formula:`SUM(C5:C${t-1})`,result:td},T);put(ws,'D'+t,{formula:`SUM(D5:D${t-1})`,result:tk},T);put(ws,'E'+t,{formula:`E${5+tx.length}`,result:bal},T)}

function secTable(ws,r0,title,list,minN,totLabel){
 ws.mergeCells(`A${r0}:D${r0}`);
 'ABCD'.split('').forEach((c,i)=>put(ws,c+r0,i?null:title,{b:1,f:P1,bd:bx('medium',['LTB','TB','TB','RTB'][i]),al:LF}));
 ['Tanggal','Kategori','Uraian','Jumlah'].forEach((h,i)=>put(ws,'ABCD'[i]+(r0+1),h,{b:1,f:P1,bd:bx('medium'),al:CT}));
 const n=Math.max(minN,list.length);let s=0;
 for(let i=0;i<n;i++){const r=r0+2+i,x=list[i],B={bd:bx('medium')};
  put(ws,'A'+r,x?ud(x.d):null,{...B,nf:'d-mmm-yy',al:LF});put(ws,'B'+r,x?(x.c||'-'):null,B);put(ws,'C'+r,x?(x.k||''):null,B);put(ws,'D'+r,x?x.a:null,{...B,nf:'#,##0'});if(x)s+=x.a}
 const t=r0+2+n;ws.mergeCells(`A${t}:C${t}`);
 'ABC'.split('').forEach((c,i)=>put(ws,c+t,i?null:totLabel,{b:1,f:P1,bd:bx('medium',['LTB','TB','RTB'][i])}));
 put(ws,'D'+t,{formula:`SUM(D${r0+2}:D${t-1})`,result:s},{b:1,f:P1,bd:bx('medium'),nf:'#,##0'});
 return{t,s}}

function box(ws,top,L){
 L.forEach((l,i)=>{const r=top+i,tp=i===0?'T':'',bt=i===L.length-1?'B':'';
  [['A','a','ba','L'],['B','b','bb',''],['C','c','bc',''],['D','d','bd','R']].forEach(([col,k,bk,side])=>put(ws,col+r,l[k],{b:l[bk],f:P1,bd:bx('medium',side+tp+bt),nf:col==='D'?'#,##0':undefined}))});
 return top+L.length-1}

function shPP(wb,p,tx,scope){
 const ws=wb.addWorksheet('Penerimaan dan Pengeluaran',{views:[{showGridLines:false}]});
 [12.83,24.83,32.83,16.83,8.66].forEach((w,i)=>ws.getColumn(i+1).width=w);
 titleRows(ws,'E','LAPORAN PENERIMAAN DAN PENGELUARAN '+kn().toUpperCase(),pdate(p,scope),'mmm-yy');
 const A=secTable(ws,4,'PENERIMAAN',tx.filter(x=>x.t==='in'),40,'Total penerimaan');
 const cats=t=>{const l=bycat(tx,t);return l.length?l.map(([k,v])=>({b:k,d:v})):[{}]};
 const e1=box(ws,A.t+2,[{a:'Ringkasan per kategori',ba:1},...cats('in')]);
 const B=secTable(ws,e1+2,'PENGELUARAN',tx.filter(x=>x.t==='out'),19,'Total pengeluaran');
 const top=B.t+2,c2=cats('out'),rt=top+1+c2.length+1,ti=A.s,to=B.s,sd=ti-to;
 const e2=box(ws,top,[{a:'Ringkasan per kategori',ba:1},...c2,{},
  {c:'Total penerimaan',bc:1,d:{formula:`D${A.t}`,result:ti},bd:1},
  {c:'Total pengeluaran',bc:1,d:{formula:`D${B.t}`,result:to},bd:1},
  {c:'Surplus / (Defisit)',bc:1,d:{formula:`D${rt}-D${rt+1}`,result:sd},bd:1},
  {c:'Saldo awal',bc:1,d:p.open,bd:1},
  {c:'Saldo akhir',bc:1,d:{formula:`D${rt+3}+D${rt+2}`,result:p.open+sd},bd:1},{}]);
 box(ws,e2+2,[{a:'Penerimaan per metode',ba:1},{b:'Rekening',d:byM(tx,'rekening')},{b:'QRIS',d:byM(tx,'qris')},{b:'Cash',d:byM(tx,'cash')},{}]);
 for(let r=3;r<=ws.rowCount;r++)ws.getRow(r).height=16}

function shBH(wb,scope){
 const ws=wb.addWorksheet('Bagi Hasil');
 [5.25,26.25,14.58,16.83,19.25,19.25].forEach((w,i)=>ws.getColumn(i+1).width=w);
 const all=sorted(),yrs=[...new Set(all.map(x=>x.d.slice(0,4)))].sort();
 const yr=scope==='m'?+$('#bulan').value.slice(0,4):(yrs.length?+yrs[yrs.length-1]:new Date().getFullYear());
 titleRows(ws,'F','Rekapitulasi Bagi Hasil Pendapatan '+kn(),yr);
 const H={b:1,f:P2,bd:bx('thin'),al:CT};
 [['A4:A5','A4','No'],['B4:B5','B4','Uraian'],['C4:C5','C4','Bulan'],['D4:D5','D4','Pendapatan (Rp)'],['E4:F4','E4','Jumlah']].forEach(([rg,a,t])=>{ws.mergeCells(rg);put(ws,a,t,H)});
 ['A5','B5','C5','D5','F4'].forEach(a=>put(ws,a,null,H));
 put(ws,'E5',`${S.nA} (${S.pA}%)`,H);put(ws,'F5',`${S.nB} (${100-S.pA}%)`,H);
 const MN=['Jan','Feb','Mar','April','Mei','Jun','Jul','Agust','Sept','Okt','Nop','Des'];
 const mm=Object.fromEntries(monthly(all).map(r=>[r.m,r])),pa=S.pA,pb=100-S.pA;let tD=0,tE=0,tF=0;
 for(let i=0;i<13;i++){const r=6+i,B={bd:bx('thin')},m=i<12;
  const mo=m?mm[yr+'-'+String(i+1).padStart(2,'0')]:null,l=mo?mo.i-mo.o:null;
  put(ws,'A'+r,m?i+1:null,B);put(ws,'B'+r,m?'Pendapatan bersih':null,B);put(ws,'C'+r,m?MN[i]:null,B);put(ws,'D'+r,l,{...B,nf:ACC});
  const a=l!==null?Math.max(l,0)*pa/100:0,b=l!==null?Math.max(l,0)*pb/100:0;
  put(ws,'E'+r,m?{formula:`MAX(D${r},0)*${pa}%`,result:a}:null,{...B,nf:ACC});
  put(ws,'F'+r,m?{formula:`MAX(D${r},0)*${pb}%`,result:b}:null,{...B,nf:ACC});
  if(l!==null)tD+=l;tE+=a;tF+=b}
 const T={b:1,f:P2,bd:bx('thin'),nf:ACC};
 'ABC'.split('').forEach(c=>put(ws,c+'19',null,{b:1,f:P2,bd:bx('thin')}));
 put(ws,'D19',{formula:'SUM(D6:D18)',result:tD},T);put(ws,'E19',{formula:'SUM(E6:E18)',result:tE},T);put(ws,'F19',{formula:'SUM(F6:F18)',result:tF},T)}

function shPU(wb){
 const ws=wb.addWorksheet('Piutang & Utang',{views:[{showGridLines:false}]});
 [12,24,18,34,16,12].forEach((w,i)=>ws.getColumn(i+1).width=w);
 titleRows(ws,'F','REKAP PIUTANG DAN UTANG '+kn().toUpperCase(),'Posisi per '+fd(today())+' (semua transaksi belum lunas)');
 let r=4;const B={bd:bx('thin')},HB={b:1,f:P1,bd:bx('thin')};
 [['in','PIUTANG (Pemasukan belum lunas)','Pelanggan'],['out','UTANG (Pengeluaran belum lunas)','Pemasok']].forEach(([t,tt,pl])=>{
  const{l,g}=puGroup(t),tot=l.reduce((s,x)=>s+x.a,0);
  ws.mergeCells(`A${r}:F${r}`);put(ws,'A'+r,tt,{...HB,al:LF});r++;
  ['Tanggal',pl,'Kategori','Uraian','Jumlah','Umur (hari)'].forEach((h,i)=>put(ws,'ABCDEF'[i]+r,h,{...HB,al:CT}));r++;
  const s0=r;
  l.forEach(x=>{put(ws,'A'+r,ud(x.d),{...B,nf:'d-mmm-yy',al:LF});put(ws,'B'+r,x.p||'-',B);put(ws,'C'+r,x.c||'',B);put(ws,'D'+r,x.k||'',B);put(ws,'E'+r,x.a,{...B,nf:'#,##0'});put(ws,'F'+r,age(x.d),B);r++});
  ws.mergeCells(`A${r}:D${r}`);put(ws,'A'+r,'Total '+(t==='in'?'piutang':'utang'),HB);['B','C','D','F'].forEach(c=>put(ws,c+r,null,HB));
  put(ws,'E'+r,l.length?{formula:`SUM(E${s0}:E${r-1})`,result:tot}:0,{...HB,nf:'#,##0'});r++;
  if(g.length){r++;put(ws,'A'+r,'Rekap per '+pl.toLowerCase(),{b:1});r++;
   g.forEach(([k,v])=>{ws.mergeCells(`A${r}:D${r}`);put(ws,'A'+r,k,B);['B','C','D'].forEach(c=>put(ws,c+r,null,B));put(ws,'E'+r,v,{...B,nf:'#,##0'});r++})}
  r+=2});
 const pi=sum(pend(),'in'),ut=sum(pend(),'out');
 [['Total piutang',pi],['Total utang',ut],['Posisi bersih (piutang - utang)',pi-ut]].forEach(([k,v])=>{put(ws,'D'+r,k,HB);put(ws,'E'+r,v,{...HB,nf:'#,##0'});r++})}

function build(scope){
 const p=period(scope),tx=p.tx,wb=new ExcelJS.Workbook();wb.creator='Buku Kas Harian';
 if($('#x1').checked)shRK(wb,p,tx,scope);
 if($('#x2').checked)shPP(wb,p,tx,scope);
 if($('#x3').checked)shBH(wb,scope);
 if($('#x4').checked)shPU(wb);
 return wb}

// ---- Format angka otomatis (300000 -> 300.000) ----
const toN=v=>+String(v).replace(/\./g,'')||0;
function fmtIn(el,neg){
 const raw=el.value,pos=el.selectionStart??raw.length;
 const left=raw.slice(0,pos).replace(/\D/g,'').length;
 const sign=neg&&raw.trim()[0]==='-'?'-':'';
 const d=raw.replace(/\D/g,'').replace(/^0+(?=\d)/,'');
 const out=sign+d.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 el.value=out;
 let i=sign.length,c=0;
 if(left>0){for(i=0;i<out.length;i++){if(/\d/.test(out[i]))c++;if(c===left){i++;break}}}
 try{el.setSelectionRange(i,i)}catch(e){}
}
// ---- Events ----
$('#tgl').value=today();$('#bulan').value=today().slice(0,7);$('#init').value=fmt(S.init);
$('#nA').value=S.nA;$('#nB').value=S.nB;$('#pA').value=S.pA;
$('#bulan').onchange=render;
$('#add').onclick=async()=>{const a=Math.round(toN($('#jml').value)),d=$('#tgl').value;
 const t=document.querySelector('[name=jn]:checked').value,s=$('#sts').value,p=$('#pihak').value.trim();
 if(!d||!(a>0)){$('#err').textContent='Isi tanggal dan jumlah (lebih dari 0).';return}
 if(s==='belum'&&!p){$('#err').textContent='Isi nama pelanggan/pemasok untuk transaksi belum lunas.';return}
 $('#err').textContent='';
 const o={d,t,s,p:s==='belum'?p:'',m:t==='in'?$('#met').value:'',c:$('#kat').value.trim(),k:$('#ket').value.trim(),a};
 try{o.id=SERVER?(await api('POST','/tx',o)).id:Date.now()+Math.random()}catch(e){$('#err').textContent='Gagal menyimpan: '+e.message;return}
 S.tx.push(o);
 saveTx();$('#jml').value='';$('#ket').value='';$('#pihak').value='';$('#bulan').value=d.slice(0,7);render();$('#jml').focus()};
$('#kasT').onclick=async e=>{const id=e.target.dataset.del;if(id){
 try{if(SERVER)await api('DELETE','/tx/'+id)}catch(er){$('#err').textContent='Gagal menghapus: '+er.message;return}
 S.tx=S.tx.filter(x=>String(x.id)!==id);saveTx();render()}};
const tog=()=>{const o=document.querySelector('[name=jn]:checked').value==='out';$('#wMet').classList.toggle('hide',o);$('#wPihak').classList.toggle('hide',$('#sts').value!=='belum');$('#lPihak').textContent=o?'Nama pemasok (yang dihutangi)':'Nama pelanggan'};
document.querySelectorAll('[name=jn]').forEach(r=>r.onchange=tog);$('#sts').onchange=tog;tog();
$('#pu').onclick=async e=>{const b=e.target.dataset,id=b.pay||b.del;if(!id)return;
 const x=S.tx.find(z=>String(z.id)===id);if(!x)return;
 try{
  if(b.pay){const sel=document.querySelector('[data-mt="'+id+'"]'),n={...x,s:'lunas',dp:today()};if(sel)n.m=sel.value;
   if(SERVER)await api('PUT','/tx/'+id,n);Object.assign(x,n)}
  else{if(SERVER)await api('DELETE','/tx/'+id);S.tx=S.tx.filter(z=>z!==x)}
 }catch(er){$('#err').textContent='Gagal memproses: '+er.message;return}
 saveTx();render()};
$('#tabs').onclick=e=>{const t=e.target.dataset.t;if(!t)return;
 document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b===e.target));
 document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on',s.id===t))};
$('#init').oninput=e=>{fmtIn(e.target,true);S.init=toN(e.target.value);save();render()};
$('#jml').oninput=e=>fmtIn(e.target);
$('#nA').oninput=e=>{S.nA=e.target.value;save();render()};$('#nB').oninput=e=>{S.nB=e.target.value;save();render()};
$('#pA').oninput=e=>{S.pA=Math.min(100,Math.max(0,+e.target.value||0));save();render()};
let armed=false;$('#reset').onclick=async e=>{if(!armed){armed=true;e.target.textContent='Klik lagi untuk konfirmasi hapus';setTimeout(()=>{armed=false;e.target.textContent='Hapus semua data'},4000);return}
 try{if(SERVER)await api('DELETE','/tx')}catch(er){$('#err').textContent='Gagal menghapus: '+er.message;return}
 S.tx=[];S.init=0;$('#init').value=0;armed=false;e.target.textContent='Hapus semua data';save();render()};

let DL=null;
(async()=>{try{DL=window.claude?await claude.use('downloads'):null}catch(e){DL=null}})();
$('#nk').value=S.nk||'';$('#nk').oninput=e=>{S.nk=e.target.value;save()};
$('#dl').onclick=async()=>{
 if(!['x1','x2','x3','x4'].some(i=>$('#'+i).checked)){$('#dlMsg').textContent='Pilih minimal satu laporan.';return}
 const sc=$('#scope').value,filename='Laporan-Kas-'+(sc==='all'?'semua':$('#bulan').value)+'.xlsx';
 $('#dlMsg').textContent='Menyiapkan file...';
 try{
  const wb=build(sc),buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  if(DL){await DL.save({filename,data:blob})}
  else{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
  $('#dlMsg').textContent='File siap disimpan.'}
 catch(e){$('#dlMsg').textContent=e&&e.code==='declined'?'Unduhan dibatalkan.':'Gagal membuat/mengunduh file ('+((e&&(e.code||e.message))||'error')+').'}};
// ---- Koneksi ke backend (database) ----
function setMode(on,msg){const el=$('#mode');el.textContent=on?'● Database terhubung':'○ Mode lokal (browser)'+(msg?' – '+msg:'');el.style.color=on?'var(--in)':'var(--mut)';
 $('#bk').classList.toggle('hide',!on);$('#imj').classList.toggle('hide',!on)}
function fillFields(){$('#init').value=fmt(S.init);$('#nA').value=S.nA;$('#nB').value=S.nB;$('#pA').value=S.pA;$('#nk').value=S.nk||''}
async function loadServer(){
 const d=await api('GET','/data');
 S={...DEF,...d.settings,tx:d.tx};SERVER=true;fillFields();setMode(true);render()}
$('#imp').onclick=async()=>{
 try{const r=JSON.parse(localStorage.getItem(KEY)||'{}');
  const o=await api('POST','/import',{settings:{init:r.init,pA:r.pA,nA:r.nA,nB:r.nB,nk:r.nk},tx:r.tx||[]});
  await loadServer();$('#imp').classList.add('hide');$('#impMsg').textContent='Terkirim: '+o.imported+' transaksi'+(o.skipped?' ('+o.skipped+' dilewati)':'')+'.'}
 catch(e){$('#impMsg').textContent='Gagal impor: '+e.message}};
function dlJson(name,obj){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,1)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
$('#bk').onclick=async e=>{e.preventDefault();try{dlJson('kas-'+today()+'.json',await api('GET','/export'))}catch(er){$('#impMsg').textContent='Gagal mengunduh: '+er.message}};
$('#imj').onclick=()=>$('#imf').click();
$('#imf').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 try{const d=JSON.parse(await f.text());const o=await api('POST','/import',{settings:d.settings,tx:d.tx});await loadServer();$('#impMsg').textContent='Dipulihkan: '+o.imported+' transaksi'+(o.skipped?' ('+o.skipped+' dilewati)':'')+'.'}
 catch(er){$('#impMsg').textContent='Gagal memulihkan: '+er.message}e.target.value=''};
document.addEventListener('visibilitychange',()=>{if(SERVER&&!document.hidden)loadServer().catch(()=>setMode(false,'server tidak merespons'))});
render();setMode(false);
(async()=>{
 const loc=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return{}}})();
 try{await loadServer();if(!S.tx.length&&(loc.tx||[]).length)$('#imp').classList.remove('hide')}
 catch(e){setMode(false,e instanceof TypeError||/404/.test(e.message)?'':e.message)}})();
