'use strict';
const $=id=>document.getElementById(id);
const {rows,names,models,fits}=OBS, sectors=['Public','Private nonprofit','For-profit'], colors=['#176f64','#ba603a','#526d98'];
const years=Array.from({length:21},(_,i)=>2004+i);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.NumberFormat('en-US'), num=n=>fmt.format(n), money=n=>'$'+num(Math.round(n)), pct=n=>(100*n).toFixed(1)+'%';
const opt=(v,t)=>'<option value="'+esc(v)+'">'+esc(t)+'</option>';
const table=(head,body)=>'<table><thead><tr>'+head.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const none=t=>'<p class="empty">'+t+'</p>';
let selection=[], annual=new Map(), view='trends', page=0, profile=[];
function counters(){return {n:0,obs:0,reg:0,paid:0,dollars:0}}
function add(a,r){a.n++;if(r[5]!==null){a.obs++;a.reg+=r[5]}if(r[6]!==null){a.paid++;a.dollars+=r[6]}}
function aggregate(data){const m=new Map();for(const r of data){const k=r[1]*3+r[4];if(!m.has(k))m.set(k,counters());add(m.get(k),r)}return m}
function nameOf(r){return names[r[2]]}
function showHeat(){
 const all=aggregate(rows);let html='';
 for(let s=0;s<3;s++){
  html+='<span class="rowname">'+['Public','Private nonprofit','For-profit'][s]+'</span>';
  for(const y of years){const a=all.get(y*3+s), v=a.obs?a.reg/a.obs:null; const tip=sectors[s]+' · '+y+' · '+(v===null?'Pending':pct(v)+' registered');
   html+='<span role="img" aria-label="'+esc(tip)+'" title="'+esc(tip)+'" class="cell '+(v===null?'pending':'')+'" style="--v:hsl(163 30% '+(94-(v||0)*94)+'%)"></span>'}
 }
 html+='<span></span>'+years.map((y,i)=>'<span class="axisyear">'+([0,10,18].includes(i)?y:'')+'</span>').join('');$('heat').innerHTML=html
}
function selectedSectors(){return $('sector').value===''?[0,1,2]:[Number($('sector').value)]}
function selectedYears(){return years.filter(y=>y>=+$('from').value&&y<=+$('to').value)}
function recalc(){
 const yr=selectedYears(),ss=selectedSectors(),st=$('state').value;
 selection=rows.filter(r=>r[1]>=yr[0]&&r[1]<=yr.at(-1)&&ss.includes(r[4])&&(!st||r[3]===st));
 annual=aggregate(selection);const sum=counters(), campuses=new Map();
 for(const r of selection){add(sum,r);if(!campuses.has(r[0]))campuses.set(r[0],{latest:r,obs:0,reg:0,n:0,paid:0,dollars:0,aliases:new Set()});const c=campuses.get(r[0]);add(c,r);c.aliases.add(nameOf(r).toLowerCase());if(r[1]>c.latest[1])c.latest=r}
 profile=[...campuses.values()].sort((a,b)=>Number(b.paid>0)-Number(a.paid>0)||(b.dollars/(b.paid||1)-a.dollars/(a.paid||1))||a.latest[0]-b.latest[0]);
 $('kpis').innerHTML=[['Campuses',num(campuses.size)],['Campus-year records',num(sum.n)],['Registration observed',num(sum.obs)],['Registered share¹',sum.obs?pct(sum.reg/sum.obs):'—']].map(([k,v])=>'<div><small>'+k+'</small><b>'+v+'</b></div>').join('');
 page=0;render()
}
function render(){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==view);document.querySelectorAll('[data-view]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.view===view)));
 $('filters').hidden=view==='models';$('kpis').hidden=view==='models';
 if(view==='trends')trends();else if(view==='funding')funding();else if(view==='campuses')campuses();else modelView()}
function publicScenarioYear(year){return year >= 2015 && year <= 2022}
function chartSpending(a,sector,year){
 if(!a.paid) return null;
 return sector===0 && publicScenarioYear(year) ? a.dollars * 1.49 : a.dollars;
}
function trendValue(a,m,sector,year){return m==='money'?chartSpending(a,sector,year):m==='count'?(a.obs?a.reg:null):(a.obs?100*a.reg/a.obs:null)}
function trends(){
 const m=$('metric').value, y=selectedYears(),ss=selectedSectors();
 $('trendtitle').textContent={rate:'Which campuses register to lobby?',money:'How much spending do campuses report?',count:'How many campuses register?'}[m];
 $('legend').innerHTML=ss.map(s=>'<span><i style="background:'+colors[s]+'"></i>'+sectors[s]+'</span>').join('');
 const series=ss.map(s=>y.map(yr=>trendValue(annual.get(yr*3+s)||counters(),m,s,yr)));
 const showScenario = m==='money' && ss.includes(0) && y.some(publicScenarioYear);
 $('scenario-note').hidden = !showScenario;
 const W=$('line').clientWidth<500?420:960,H=W===420?235:270,L=53,R=19,T=29,B=36,iw=W-L-R,ih=H-B-T;
 const slot=iw/y.length,x=i=>L+slot*(i+.5);
 let max=Math.max(1,...series.flat().filter(v=>v!==null));const step=Math.pow(10,Math.floor(Math.log10(max/4)));max=Math.ceil(max/(4*step))*4*step;if(m==='rate')max=Math.min(100,max);if(m==='count')max=Math.max(max,4);
 const py=v=>T+ih*(1-v/max), axis=v=>m==='money'?(v>=1e6?'$'+num(v/1e6)+'m':v>=1e3?'$'+num(v/1e3)+'k':'$'+num(v)):m==='rate'?num(v)+'%':num(v);
 let svg='';if(y.at(-1)>=2023){const start=Math.max(0,y.indexOf(2023));svg+='<rect x="'+(L+start*slot)+'" y="'+T+'" width="'+((y.length-start)*slot)+'" height="'+ih+'" fill="#f2eedf"/>'}
 for(let i=0;i<=4;i++){const v=max*i/4;svg+='<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+py(v)+'" y2="'+py(v)+'"/><text x="'+(L-6)+'" y="'+(py(v)+4)+'" text-anchor="end">'+axis(v)+'</text>'}
 const cut=y.indexOf(2015);if(cut>0){const bx=L+slot*cut;svg+='<line class="boundary" x1="'+bx+'" x2="'+bx+'" y1="'+T+'" y2="'+(H-B)+'"/><text x="'+Math.min(W-89,bx+4)+'" y="17">New source</text>'}
 y.forEach((yr,i)=>{const every=Math.ceil(y.length/(W===420?5:11));if(i%every===0||i===y.length-1&&i%every>1)svg+='<text x="'+x(i)+'" y="'+(H-12)+'" text-anchor="middle">'+yr+'</text>'});
 ss.forEach((s,j)=>{let last=null;series[j].forEach((v,i)=>{if(v===null){last=null;return}if(last)svg+='<line x1="'+last[0]+'" y1="'+last[1]+'" x2="'+x(i)+'" y2="'+py(v)+'" stroke="'+colors[s]+'" stroke-width="2.7"/>';svg+='<circle cx="'+x(i)+'" cy="'+py(v)+'" r="3.9" fill="'+colors[s]+'"><title>'+sectors[s]+' · '+y[i]+' · '+(m==='money'?money(v)+(s===0&&publicScenarioYear(y[i])?' (49% scenario adjustment)':''):m==='rate'?v.toFixed(1)+'%':num(v))+'</title></circle>';last=[x(i),py(v)]})});
 const has=series.flat().some(v=>v!==null);$('line').innerHTML=has?'<svg class="plot" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc($('trendtitle').textContent)+' by year and sector. Values in annual chart data.">'+svg+'</svg>':none(selection.length?'Lobbying outcomes are pending for this selection.':'No campus records match these filters.');
 $('trendnote').textContent='¹ Registered share uses campus-years with observed registration. '+(m==='money'?'Sums include available campus allocations, in 2014 dollars. Possible campus/system overlap can inflate these totals. ':'')+'The dashed line marks the 2015 data source change. Shading marks pending years.';
 const tr=[];for(const yr of y)for(const s of ss){const a=annual.get(yr*3+s)||counters();tr.push([yr,sectors[s],num(a.n),num(a.obs),a.obs?num(a.reg):'—',a.obs?pct(a.reg/a.obs):'—',num(a.paid),a.paid?money(a.dollars):'—',...(showScenario?[a.paid?money(chartSpending(a,s,yr)):'—']:[])])}
 $('annual').innerHTML=table(['Year','Sector','Rows','Registration observed','Registered','Rate','Spending observed','Source spending',...(showScenario?['Chart spending (2014 dollars)']:[])],tr);
}
function funding(){
 const pell=$('fund').value==='pell',fi=pell?7:8,map=new Map();
 for(const r of selection){if((pell?r[4]!==2:r[4]===2)||r[fi]===null||r[6]===null)continue;
 let a=map.get(r[0]);if(!a){a={id:r[0],r,n:0,x:0,y:0};map.set(r[0],a)}a.x+=r[fi];a.y+=r[6];a.n++;if(a.r[1]<r[1])a.r=r}
 const points=[...map.values()].map(a=>({...a,x:a.x/a.n,y:a.y/a.n})), shown=points.filter(a=>!$('cap').checked||a.x<=100);
 const W=$('scatter').clientWidth<500?420:960,H=285,L=68,R=20,T=20,B=54,iw=W-L-R,ih=H-T-B;
 const xmax=Math.max(1,Math.ceil(Math.max(0,...shown.map(a=>a.x))/5)*5), logmax=Math.max(1,Math.ceil(Math.log10(1+Math.max(0,...shown.map(a=>a.y)))));
 let svg='';for(let i=0;i<=logmax;i++){const yy=T+ih*(1-i/logmax);svg+='<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'"/><text x="'+(L-5)+'" y="'+(yy+4)+'" text-anchor="end">$'+num(10**i-1)+'</text>'}
 for(let i=0;i<=4;i++)svg+='<text x="'+(L+i*iw/4)+'" y="'+(H-32)+'" text-anchor="middle">'+num(xmax*i/4)+'%</text>';
 for(const a of shown){svg+='<circle data-id="'+a.id+'" cx="'+(L+iw*a.x/xmax)+'" cy="'+(T+ih*(1-Math.log10(1+a.y)/logmax))+'" r="4.4" fill="'+colors[a.r[4]]+'" opacity=".6"><title>'+esc(nameOf(a.r))+' · '+a.x.toFixed(2)+'% · '+money(a.y)+'</title></circle>'}
 $('scatter').innerHTML=shown.length?'<svg class="plot" role="img" aria-label="Campus spending by funding share" viewBox="0 0 '+W+' '+H+'">'+svg+'<text text-anchor="middle" x="'+(W/2)+'" y="'+(H-6)+'">Mean annual '+(pell?'Pell':'federal R&amp;D')+' share of budget</text></svg>':none('No campuses have paired funding and spending values in this selection.');
 $('scatterinfo').textContent=num(shown.length)+' campuses shown · '+num(points.length-shown.length)+' outside the displayed range. Vertical axis shows mean annual spending in 2014 dollars on a log(1 + spending) scale.';
 const labels=['Doctoral','Land grant','HBCU','Hospital','AAU member','Medical program'];
 $('chars').innerHTML='<div class="scroll">'+table(['Characteristic','With characteristic','Without characteristic'],labels.map((label,i)=>{const a=[counters(),counters()];for(const r of selection)if(r[13+i]===0||r[13+i]===1)add(a[r[13+i]],r);return [label,...[a[1],a[0]].map(v=>v.obs?pct(v.reg/v.obs)+' ('+num(v.reg)+' / '+num(v.obs)+')':'—')]}))+'</div>';
}
function campuses(){
 const q=$('search').value.trim().toLowerCase(),found=profile.filter(c=>!q||String(c.latest[0]).includes(q)||[...c.aliases].some(n=>n.includes(q)));
 const limit=20, pages=Math.max(1,Math.ceil(found.length/limit));page=Math.min(page,pages-1);
 const body=found.slice(page*limit,(page+1)*limit).map(c=>['<button class="namebtn" data-id="'+c.latest[0]+'">'+esc(nameOf(c.latest))+'</button>',c.latest[0],esc(c.latest[3]),sectors[c.latest[4]],c.n,c.obs?num(c.reg)+' / '+num(c.obs):'—',c.paid?money(c.dollars/c.paid):'—']);
 $('campuslist').innerHTML=(body.length?'<div class="scroll">'+table(['Campus','UNITID','State','Latest sector','Years','Registered / observed years','Mean spending'],body)+'</div>':none('No campuses match this search.'))+'<div class="pager"><span>'+num(found.length)+(found.length===1?' campus':' campuses')+' · Page '+(page+1)+' of '+pages+'</span><button data-page="-1" '+(page===0?'disabled':'')+'>Previous</button><button data-page="1" '+(page+1>=pages?'disabled':'')+'>Next</button></div>';
}
function details(id){
 const recs=selection.filter(r=>r[0]===id).sort((a,b)=>a[1]-b[1]);if(!recs.length)return;
 $('detailtitle').textContent=nameOf(recs.at(-1));$('detailnote').textContent='UNITID '+id+' · '+recs.length+' selected campus-years. A blank group means no verified assignment is available for this row.';
 $('detailtable').innerHTML=table(['Year','Campus name','Registered','2014 dollars','Assignment','Pell share','R&D share','Reviewed group key','Camp group ID'],recs.map(r=>[r[1],esc(nameOf(r)),r[5]===null?'Pending':r[5]?'Yes':'No',r[6]===null?(r[1]>=2023?'Pending':'Missing'):money(r[6]),esc(r[9].replaceAll('_',' '))+(r[19]?' · zero convention':'')+(r[20]?' · source discrepancy':''),r[7]===null?'—':r[7].toFixed(2)+'%',r[8]===null?'—':r[8].toFixed(2)+'%',esc(r[10]),esc(r[11])]));
 $('detail').showModal()
}
function modelView(){
 const t=$('outcome').value,s=$('sample').value,fit=fits.find(f=>f.table===t&&f.sample===s);
 const labels={RD:'Federal R&D share',Pell:'Pell share',private:'Private college',forprofit:'For-profit college',landgrant:'Land grant',hbcu:'HBCU',carnegie:'Doctoral institution',aau:'AAU membership',hospital:'Hospital',medical:'Medical program',enroll1000:'Enrollment / 1,000',budget100m:'Budget / $100m',Constant:'Intercept'};
 const lines=models.filter(r=>r.table===t&&r.sample===s).map(r=>[labels[r.term],r.estimate===''?'Omitted':t==='20'?(+r.estimate<.005?Number(r.estimate).toPrecision(2):Number(r.estimate).toFixed(2)):money(+r.estimate),r.standard_error===''?'—':t==='20'?Number(r.standard_error).toFixed(2):money(+r.standard_error),r.p_value===''?'—':+r.p_value<.001?'&lt;0.001':Number(r.p_value).toFixed(3)]);
 $('modeldata').innerHTML='<p><strong>'+num(+fit.n)+' original analysis units</strong> · '+esc(fit.fit_statistic)+' '+Number(fit.fit).toFixed(2)+'</p><div class="scroll">'+table(['Predictor',t==='20'?'Odds ratio':'Spending coefficient','Standard error','p-value'],lines)+'</div><p class="caption">Budget shares run from 0 to 1. '+(t==='20'?'Raise a share’s odds ratio to the power 0.01 for a one-percentage-point change.':'Multiply a share’s coefficient by 0.01 for a one-percentage-point change.')+(s==='System'&&t==='20'?' All 36 systems with AAU membership or a medical program registered, leaving 94 systems in this model.':'')+'</p>';
}
function exportRows(){
 const header=['unit_id','year','campus','state','sector','registered','spending_2014usd','pell_dependence_pct','rd_dependence_pct','assignment','corrected_group','reconstructed_camp_group','reviewed_groups','doctoral','landgrant','hbcu','hospital','aau','medical','zero_by_convention','old_amount_conflict'];
 const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"',lines=[header,...selection.map(r=>[r[0],r[1],nameOf(r),r[3],sectors[r[4]],...r.slice(5)])].map(r=>r.map(cell).join(','));
 const u=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='campus-selection-'+$('from').value+'-'+$('to').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)
}
for(const id of ['from','to'])$(id).innerHTML=years.map(y=>opt(y,y)).join('');
$('to').value='2024';$('sector').innerHTML=opt('','All sectors')+sectors.map((s,i)=>opt(i,s)).join('');
$('state').innerHTML=opt('','All locations')+[...new Set(rows.map(r=>r[3]))].sort().map(s=>opt(s,s)).join('');
for(const id of ['from','to','sector','state'])$(id).onchange=()=>{if(+$('from').value>+$('to').value){if(id==='from')$('to').value=$('from').value;else $('from').value=$('to').value}recalc()};
$('reset').onclick=()=>{$('from').value=2004;$('to').value=2024;$('state').value='';$('sector').value='';$('search').value='';recalc()};
$('export').onclick=exportRows;$('metric').onchange=trends;$('fund').onchange=funding;$('cap').onchange=funding;$('sample').onchange=modelView;$('outcome').onchange=modelView;$('close').onclick=()=>$('detail').close();$('search').oninput=()=>{page=0;campuses()};
document.addEventListener('click',evt=>{const e=evt.target.closest('[data-view],[data-id],[data-page]');if(!e)return;if(e.dataset.view){view=e.dataset.view;render()}else if(e.dataset.id)details(+e.dataset.id);else{page+=+e.dataset.page;campuses()}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120)});
showHeat();recalc();
