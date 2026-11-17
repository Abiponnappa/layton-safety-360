let data, selectedState="", selectedProject="", selectedHazard="", dispatch=null, briefIndex=0, editingReportId=null;
let actionState=JSON.parse(localStorage.getItem("safety360-actions")||"{}");
let fieldReports=JSON.parse(localStorage.getItem("safety360-field-reports")||"[]");
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString();
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

fetch("data/app_data.json").then(r=>r.json()).then(x=>{data=x;setup();render();});

function setup(){
  document.body.classList.add("home-active");
  const states=[...new Set(data.projects.map(x=>x.state))].sort();
  $("state").innerHTML+=[...states].map(x=>"<option>"+x+"</option>").join("");
  const options=data.projects.sort((a,b)=>a.job_id.localeCompare(b.job_id)).map(x=>'<option value="'+x.job_id+'">'+x.job_id+" · "+x.project_type+" · "+x.state+"</option>").join("");
  $("project-filter").innerHTML+=options;
  $("project-360").innerHTML=options;
  $("capture-project").innerHTML=options;
  $("state").onchange=e=>{selectedState=e.target.value;selectedProject="";$("project-filter").value="";render();};
  $("project-filter").onchange=e=>{selectedProject=e.target.value;render();};
  $("project-360").onchange=e=>{selectedProject=e.target.value;renderProject();};
  $("reset").onclick=()=>{selectedState="";selectedProject="";$("state").value="";$("project-filter").value="";render();};
  $("priority-filter").onchange=renderActions;
  $("metric").onchange=renderStates;
  document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.view));
  $("go-home").onclick=home;
  $("enter-workspace").onclick=()=>show("pulse");
  document.querySelectorAll("[data-open-field]").forEach(b=>b.onclick=()=>show("field"));
  $("copy-brief").onclick=()=>navigator.clipboard.writeText($("brief-text").textContent);
  $("brief-prev").onclick=()=>{briefIndex=Math.max(0,briefIndex-1);renderBrief(metrics(scopeProjects()),ranked(scopeProjects(),metrics(scopeProjects())));};
  $("brief-next").onclick=()=>{const list=ranked(scopeProjects(),metrics(scopeProjects()));briefIndex=Math.min(list.length-1,briefIndex+1);renderBrief(metrics(scopeProjects()),list);};
  document.querySelector(".close-report").onclick=()=>$("report-modal").close();
  $("save-draft").onclick=saveDraft;
  $("update-action").onclick=updateAction;
  $("send-report").onclick=sendReport;
  $("field-form").onsubmit=submitFieldReport;
  $("capture-cancel").onclick=cancelFieldEdit;
  $("capture-due").value=defaultDate(7);
}

function scopeProjects(){return data.projects.filter(x=>(!selectedState||x.state===selectedState)&&(!selectedProject||x.job_id===selectedProject));}
function syncProjectFilter(){
  const options=data.projects.filter(x=>!selectedState||x.state===selectedState).sort((a,b)=>a.job_id.localeCompare(b.job_id));
  const projectOptions=options.map(x=>'<option value="'+x.job_id+'">'+x.job_id+" · "+x.project_type+" · "+x.state+"</option>").join("");
  $("project-filter").innerHTML='<option value="">All projects</option>'+projectOptions;
  $("capture-project").innerHTML=projectOptions;
  if(selectedProject&&options.some(x=>x.job_id===selectedProject)){
    $("project-filter").value=selectedProject;
    $("capture-project").value=selectedProject;
  }
}
function syncProject360(){
  const options=data.projects.filter(x=>!selectedState||x.state===selectedState).sort((a,b)=>a.job_id.localeCompare(b.job_id));
  $("project-360").innerHTML=options.map(x=>'<option value="'+x.job_id+'">'+x.job_id+" · "+x.project_type+" · "+x.state+"</option>").join("");
  if(selectedProject&&options.some(x=>x.job_id===selectedProject))$("project-360").value=selectedProject;
}
function scopeIncidents(){return data.incidents.filter(x=>(!selectedState||x.STATE===selectedState)&&(!selectedProject||x.JOB_ID===selectedProject));}
function metrics(p=scopeProjects()){
  const h=p.reduce((s,x)=>s+x.total_hours,0),r=p.reduce((s,x)=>s+x.recordable_incidents,0),l=p.reduce((s,x)=>s+x.lta_incidents,0);
  return {h,r,l,rr:h?r*200000/h:0,lr:h?l*200000/h:0,ptp:h?p.reduce((s,x)=>s+x.daily_ptp_compliance*x.total_hours,0)/h:0,focus:h?p.reduce((s,x)=>s+x.weekly_focus_walk_compliance*x.total_hours,0)/h:0,over:p.reduce((s,x)=>s+x.issues_marked_overdue,0),follow:p.reduce((s,x)=>s+x.good_catch_follow_ups_open,0)};
}
function projectHazard(x){
  const g={};data.incidents.filter(i=>i.JOB_ID===x.job_id&&i.INCIDENT_CLASSIFICATION==="Lost Time Accident").forEach(i=>g[i.OSHA_HAZARD_CATEGORY]=(g[i.OSHA_HAZARD_CATEGORY]||0)+1);
  return Object.entries(g).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
}
function priority(x,m){
  const f=[];const hazard=projectHazard(x);let decision,owner,verify,trigger;
  if(x.lta_incidents){
    f.push(x.lta_incidents+" LTA"+(x.lta_incidents>1?"s":""));if(hazard)f.push(hazard+" serious-injury pattern");
    if(hazard==="Falls"){decision="Verify ladder and fall-protection controls before the next elevated-work activity.";owner="Superintendent + Safety Manager";verify="Complete an elevated-work field review, correct high-severity fall findings, and document the next Focus Walk.";}
    else if(hazard==="Struck-By"){decision="Verify equipment–pedestrian separation before the next comparable activity.";owner="Superintendent + Equipment Lead";verify="Inspect exclusion zones, spotter controls, and traffic plans; close related high-severity findings.";}
    else {decision="Complete a serious-injury control review before the next comparable task.";owner="Superintendent + Safety Manager";verify="Document the task-control review, assign corrective actions, and verify high-severity closure.";}
    trigger="serious outcome";
  } else if(x.issues_marked_overdue>=45||x.good_catch_follow_ups_open>=14){
    if(x.issues_marked_overdue>=45)f.push(x.issues_marked_overdue+" overdue issues");if(x.good_catch_follow_ups_open>=14)f.push(x.good_catch_follow_ups_open+" open Good Catch follow-ups");
    decision="Run a closure review and escalate aged high-severity items.";owner="Project Manager + Project Safety Manager";verify="Every high-severity item has an owner, due date, evidence of correction, and closure status.";trigger="closure backlog";
  } else if(x.daily_ptp_compliance<.85||x.weekly_focus_walk_compliance<.80){
    if(x.daily_ptp_compliance<.85)f.push((x.daily_ptp_compliance*100).toFixed(1)+"% Daily PTP completion");if(x.weekly_focus_walk_compliance<.80)f.push((x.weekly_focus_walk_compliance*100).toFixed(1)+"% Focus Walk completion");
    decision="Restore pre-task planning and inspection discipline before the next shift.";owner="Superintendent + Project Safety Manager";verify="Submit missing PTPs or the weekly Focus Walk and review current work hazards with the crew.";trigger="control completion gap";
  } else if(x.overtime_share>.20&&x.recordable_incident_rate>m.rr){
    f.push((x.overtime_share*100).toFixed(1)+"% overtime share");f.push(x.recordable_incident_rate.toFixed(3)+" recordable rate");
    decision="Review fatigue-sensitive work planning, staffing, and supervision for the next work period.";owner="Project Manager + Superintendent";verify="Document a staffing and sequence review; confirm break, supervision, and escalation plan.";trigger="overtime exposure";
  } else if(x.recordable_incident_rate>m.rr*1.5){
    f.push(x.recordable_incident_rate.toFixed(3)+" recordable rate");decision="Review current work conditions and prevention controls with the project leadership team.";owner="Project Safety Manager";verify="Complete a targeted work-area review and record the controls strengthened.";trigger="elevated rate";
  } else {
    f.push("No serious outcome or closure backlog trigger");decision="Capture and share the project’s preventive practices with comparable teams.";owner="Regional Safety Leader";verify="Document one transferable practice and review adoption with a comparable project.";trigger="leading practice";
  }
  const score=(x.lta_incidents?100:0)+(x.issues_marked_overdue>=45?45:0)+(x.good_catch_follow_ups_open>=14?20:0)+(x.daily_ptp_compliance<.85?18:0)+(x.weekly_focus_walk_compliance<.80?18:0)+(x.overtime_share>.20&&x.recordable_incident_rate>m.rr?12:0)+(x.recordable_incident_rate>m.rr*1.5?8:0);
  return {f,decision,owner,verify,trigger,score};
}
function ranked(p,m){return p.map(x=>({x,...priority(x,m)})).sort((a,b)=>b.score-a.score||b.x.lta_rate-a.x.lta_rate);}
function statusFor(id){return actionState[id]?.status||"needs-review";}
function statusLabel(s){return {"needs-review":"Needs leadership review",sent:"Action sent","in-progress":"In progress",awaiting:"Awaiting verification",verified:"Verified closed"}[s]||"Needs leadership review";}
function saveActionState(){localStorage.setItem("safety360-actions",JSON.stringify(actionState));}
function defaultDate(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function controlTone(v){return v>=.9?"green":v>=.8?"amber":"red";}
function backlogTone(v){return v<20?"green":v<48?"amber":"red";}
function rateTone(v,base){return v<=base*.85?"green":v<=base*1.15?"amber":"red";}
function valueHtml(value,tone,label){return '<strong class="metric-value '+tone+'">'+value+'</strong><small>'+label+"</small>";}

function render(){
  const p=scopeProjects(),m=metrics(p),scope=selectedProject||selectedState||"Portfolio",top=ranked(p,m),base=metrics(data.projects);
  briefIndex=Math.min(briefIndex,Math.max(top.length-1,0));
  syncProjectFilter();
  syncProject360();
  $("workspace-copy").textContent=scope+" view · focus the review, assign an accountable action, and verify the control";
  $("decision-card").innerHTML=top.length?'<p class="eyebrow">TOP SAFETY DECISIONS</p><h2>What leadership should direct now</h2><p>Priorities combine serious outcomes, preventive-control completion, closure backlog, and overtime exposure. They are decision-support signals, not predictions.</p><div class="decision-list">'+top.slice(0,3).map((z,i)=>{
    const s=statusFor(z.x.job_id);
    return '<div class="decision-item"><span class="status '+s+'">'+(i===0?"First priority · ":"")+statusLabel(s)+'</span><h3>'+z.x.job_id+" · "+z.x.state+'</h3><p><b>Decision:</b> '+esc(z.decision)+'</p><p class="mini"><b>Why now:</b> '+esc(z.f.join(" · "))+'</p><p class="mini"><b>Owner:</b> '+esc(z.owner)+'</p><button onclick="openProject(\''+z.x.job_id+'\')">Review evidence</button> <button onclick="sendActionReport(\''+z.x.job_id+'\')">Route action</button></div>';
  }).join("")+"</div>":"<h2>No projects match the selected scope.</h2>";
  $("kpis").innerHTML=[
    ["Serious outcomes",valueHtml(m.l,m.l?"red":"green",m.lr.toFixed(3)+" LTA rate")],
    ["Control completion",valueHtml((m.focus*100).toFixed(1)+"%",controlTone(m.focus),"Focus Walk completion")],
    ["Closure pressure",valueHtml(m.over,backlogTone(p.length?m.over/p.length:0),"overdue issues")]
  ].map(x=>'<div class="kpi"><label>'+x[0]+"</label>"+x[1]+"</div>").join("");
  renderActionSummary(p,m,top);renderBrief(m,top);renderHazards();renderActions();renderStates();renderTrend();renderOvertime();renderScatter();renderDeepAnalysis(p,m,top);renderProject();renderReplicate(p,m);renderCaptureQueue();
}
function renderActionSummary(p,m,top){
  const serious=p.filter(x=>x.lta_incidents>0).length;
  const priorityProjects=top.filter(z=>z.trigger!=="leading practice");
  const review=priorityProjects.filter(z=>statusFor(z.x.job_id)==="needs-review").length;
  const verification=priorityProjects.filter(z=>statusFor(z.x.job_id)==="awaiting").length;
  const g={};scopeIncidents().filter(x=>x.INCIDENT_CLASSIFICATION==="Lost Time Accident").forEach(x=>g[x.OSHA_HAZARD_CATEGORY]=(g[x.OSHA_HAZARD_CATEGORY]||0)+1);
  const hazard=Object.entries(g).sort((a,b)=>b[1]-a[1])[0]?.[0]||"No LTA hazard pattern";
  $("portfolio-action-summary").innerHTML='<p class="eyebrow">PORTFOLIO ACTIONS THIS WEEK</p><h2>What needs a leader’s attention</h2><div class="summary-grid"><div><b class="metric-value '+(review?"red":"green")+'">'+review+'</b><span>priority actions need leadership review</span></div><div><b class="metric-value '+(serious?"red":"green")+'">'+serious+'</b><span>projects with a serious outcome</span></div><div><b class="metric-value '+(verification?"amber":"green")+'">'+verification+'</b><span>actions awaiting closure verification</span></div><div><b>'+esc(hazard)+'</b><span>leading serious-risk mechanism</span></div></div><p class="next-step"><b>Next leadership decision:</b> Review the first priority, confirm the accountable owner and due date, then verify the control—not only the report.</p><button onclick="show(\'actions\')">Review priority actions</button>';
}
function renderBrief(m,top){
  const current=top[briefIndex];
  $("brief-title").textContent=current?current.x.job_id+" · "+current.x.state:"Priority decision";
  $("brief-text").innerHTML=current?'<div class="brief-item"><span>WHY NOW</span><p>'+esc(current.f.join(" · "))+'</p></div><div class="brief-item"><span>DECISION</span><p>'+esc(current.decision)+'</p></div><div class="brief-grid"><div class="brief-item"><span>OWNER</span><p>'+esc(current.owner)+'</p></div><div class="brief-item"><span>VERIFY CLOSURE</span><p>'+esc(current.verify)+'</p></div></div>':"<p>No project is available in this scope</p>";
  $("brief-count").textContent=top.length?(briefIndex+1)+" of "+Math.min(top.length,3):"";
  $("brief-prev").disabled=briefIndex===0;
  $("brief-next").disabled=briefIndex>=Math.min(top.length,3)-1;
}
function renderHazards(){
  const g={};scopeIncidents().filter(x=>x.INCIDENT_CLASSIFICATION==="Lost Time Accident").forEach(x=>g[x.OSHA_HAZARD_CATEGORY]=(g[x.OSHA_HAZARD_CATEGORY]||0)+1);
  const a=Object.entries(g).sort((a,b)=>b[1]-a[1]),max=a[0]?.[1]||1;
  $("hazards").innerHTML=a.map(([k,v])=>'<div class="bar-row" onclick="hazard(\''+k+'\')"><span>'+k+'</span><div class="track"><div class="bar lta" style="width:'+(v/max*100)+'%">'+v+" LTAs</div></div><b>"+(v/(metrics().l||1)*100).toFixed(1)+"%</b></div>").join("")||"<p>No LTAs in this selected scope</p>";
}
function hazard(h){
  selectedHazard=h;
  const inc=scopeIncidents().filter(x=>x.OSHA_HAZARD_CATEGORY===h),l=inc.filter(x=>x.INCIDENT_CLASSIFICATION==="Lost Time Accident"),sub={},body={},jobs={};
  inc.forEach(x=>{sub[x.HAZARD_SUBCATEGORY]=(sub[x.HAZARD_SUBCATEGORY]||0)+1;body[x.BODY_PART_INJURED]=(body[x.BODY_PART_INJURED]||0)+1;jobs[x.JOB_ID]=(jobs[x.JOB_ID]||0)+1;});
  const leader=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Not available";
  const themes={Falls:"Fall-related","Struck-By":"Struck-by",Electrocution:"Electrical"};
  const theme=(data.deep?.proactive_incident_theme_crosswalk||[]).find(x=>x.safety_theme===themes[h]);
  const proactive=theme?'<p><b>Detection and follow-through:</b> '+theme.good_catches+' Good Catches in this hazard category, '+theme.open_good_catch_follow_ups+' follow-ups still open, and '+theme.overdue_issues+' issues overdue.</p>':"";
  $("hazard-evidence").innerHTML='<p class="eyebrow">HAZARD EVIDENCE</p><h3>'+h+'</h3><p><b>'+inc.length+'</b> incidents · <b>'+l.length+'</b> LTAs · leading subcategory: <b>'+leader(sub)+'</b> · most affected body area: <b>'+leader(body)+'</b>.</p><p>Projects with recorded incidents: '+Object.keys(jobs).join(", ")+'. Review the related control before the next comparable task.</p>'+proactive+'<p class="analysis-note">Incident, Safety Issue, and Good Catch records are independent. A shared hazard category supports comparison, not case-level linkage.</p>';
}
function renderActions(){
  const m=metrics(),mode=$("priority-filter").value;
  const a=ranked(scopeProjects(),m).filter(z=>mode==="all"||(mode==="severe"?z.x.lta_incidents>0:mode==="controls"?z.trigger==="control completion gap":z.trigger==="closure backlog")).slice(0,12);
  $("action-cards").innerHTML=a.map(z=>{
    const s=statusFor(z.x.job_id);
    return '<article class="action '+(z.score<30?"med":"")+'"><div class="action-top"><span class="tag">'+esc(z.trigger.toUpperCase())+'</span><span class="status '+s+'">'+statusLabel(s)+'</span></div><h3>'+z.x.job_id+" · "+z.x.state+'</h3><p>'+esc(z.f.join(" · "))+'</p><div class="decision"><b>Decision:</b> '+esc(z.decision)+'<br><br><b>Owner:</b> '+esc(z.owner)+'<br><br><b>Verify:</b> '+esc(z.verify)+'</div><div class="card-buttons"><button onclick="openProject(\''+z.x.job_id+'\')">Project 360</button><button onclick="sendActionReport(\''+z.x.job_id+'\')">Route action</button></div></article>';
  }).join("")||"<p>No priority actions match this filter.</p>";
}
function health(stateMetric,projects){
  const base=metrics(data.projects),avgOver=stateMetric.over/projects.length;
  if(stateMetric.lr>base.lr*1.15||stateMetric.focus<.80||avgOver>=48)return {label:"RED · REVIEW",tone:"red"};
  if(stateMetric.lr<=base.lr&&stateMetric.rr<=base.rr&&stateMetric.focus>=.83&&avgOver<45)return {label:"GREEN · STABLE",tone:"green"};
  return {label:"AMBER · MONITOR",tone:"amber"};
}
function renderStates(){
  const key=$("metric").value;
  const scoped=scopeProjects();
  const metric={
    recordable:{label:"Recordable rate",detail:"recordable events per 200,000 worked hours",value:x=>x.m.rr,format:v=>v.toFixed(3),tone:(x,base)=>rateTone(x.m.rr,base.rr)},
    lta:{label:"LTA rate",detail:"lost-time accidents per 200,000 worked hours",value:x=>x.m.lr,format:v=>v.toFixed(3),tone:(x,base)=>rateTone(x.m.lr,base.lr)},
    ptp:{label:"Daily PTP completion",detail:"submitted on days with recorded work",value:x=>x.m.ptp,format:v=>(v*100).toFixed(1)+"%",tone:x=>controlTone(x.m.ptp)},
    focus:{label:"Focus Walk completion",detail:"submitted in weeks with recorded work",value:x=>x.m.focus,format:v=>(v*100).toFixed(1)+"%",tone:x=>controlTone(x.m.focus)}
  }[key];
  const a=[...new Set(scoped.map(x=>x.state))].map(s=>{const projects=scoped.filter(x=>x.state===s),m=metrics(projects);return {s,m,projects,h:health(m,projects)};});
  const base=metrics(scoped);
  const value=metric.value;
  $("state-health-title").textContent="State health — "+metric.label;
  $("state-health-note").textContent="Primary metric: "+metric.detail+". Health status still reflects serious outcomes, leading controls, and closure signals—not this metric alone.";
  $("state-comparison-title").textContent="State comparison — "+metric.label;
  $("state-health").innerHTML=a.slice().sort((a,b)=>a.s.localeCompare(b.s)).map(x=>'<div class="health-card '+x.h.tone+'" onclick="pickState(\''+x.s+'\')"><div class="health-top"><strong>'+x.s+'</strong><span class="health-status '+x.h.tone+'">'+x.h.label+'</span></div><p><b class="metric-value">'+metric.format(value(x))+"</b> "+metric.label+' · <b>'+x.m.lta+' LTA'+(x.m.lta===1?"":"s")+'</b> · '+(x.m.over/x.projects.length).toFixed(0)+" overdue/project</p></div>").join("")||"<p>No matching state data.</p>";
  const comparison=[...new Set(data.projects.map(x=>x.state))].map(s=>{const projects=data.projects.filter(x=>x.state===s),m=metrics(projects);return {s,m,projects};});
  const portfolio=metrics(data.projects),max=Math.max(...comparison.map(value),1),highlight=selectedProject?(data.projects.find(x=>x.job_id===selectedProject)||{}).state:selectedState;
  $("state-comparison-note").textContent=highlight?highlight+" is highlighted against the full portfolio. Select another state to change the leadership workspace.":"Compare states against the portfolio benchmark, then select a state to focus the workspace.";
  $("states-chart").innerHTML='<div class="comparison-benchmark">Portfolio benchmark: <b>'+metric.format(value({m:portfolio}))+'</b></div>'+comparison.slice().sort((a,b)=>value(b)-value(a)).map(x=>{const v=value(x),t=metric.tone(x,{rr:portfolio.rr,lr:portfolio.lr}),selected=x.s===highlight?" selected":"";return '<div class="bar-row comparison-row'+selected+'" onclick="pickState(\''+x.s+'\')"><span>'+x.s+(x.s===highlight?" · selected":"")+'</span><div class="track"><div class="bar '+t+'" style="width:'+(v/max*100)+'%">'+metric.format(v)+"</div></div></div>";}).join("")||"<p>No portfolio comparison data.</p>";
}
function pickState(s){selectedState=s;selectedProject="";$("state").value=s;$("project-filter").value="";render();show("pulse");}
function renderTrend(){
  const rows=data.monthly.filter(x=>(!selectedState||x.state===selectedState)&&(!selectedProject||x.job_id===selectedProject)),g={};
  rows.forEach(x=>{const k=x.month_start.slice(0,7);g[k]=g[k]||{h:0,r:0,l:0};g[k].h+=x.total_hours;g[k].r+=x.recordable_incidents;g[k].l+=x.lta_incidents;});
  const a=Object.entries(g).map(([d,x])=>({d,rr:x.r*200000/x.h,lr:x.l*200000/x.h})).sort((a,b)=>a.d.localeCompare(b.d));
  if(!a.length){$("trend").innerHTML="<p>No monthly trend data in this scope.</p>";return;}
  const benchmark=metrics(data.projects).rr,showBenchmark=Boolean(selectedState||selectedProject),max=Math.max(...a.map(x=>Math.max(x.rr,x.lr)),showBenchmark?benchmark:0,1),w=620,h=278,plotLeft=52,plotRight=566,plotTop=28,plotBottom=216;
  const xy=(x,i,k)=>({x:plotLeft+i*(plotRight-plotLeft)/Math.max(a.length-1,1),y:plotBottom-x[k]/max*(plotBottom-plotTop)});
  const points=k=>a.map((x,i)=>{const p=xy(x,i,k);return p.x+","+p.y;}).join(" ");
  const grid=[0,.25,.5,.75,1].map(t=>{const y=plotBottom-t*(plotBottom-plotTop),v=(max*t).toFixed(1);return '<line x1="'+plotLeft+'" y1="'+y+'" x2="'+plotRight+'" y2="'+y+'" stroke="#e2eaed"/><text x="5" y="'+(y+4)+'" font-size="11" fill="#61737d">'+v+"</text>";}).join("");
  const dots=k=>a.map((x,i)=>{const p=xy(x,i,k);return '<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="'+(k==="rr"?"#075a9b":"#8e0038")+'"/>';}).join("");
  const labels=a.filter((x,i)=>i===0||i===a.length-1||i%6===0).map((x,i)=>{const original=a.indexOf(x),p=xy(x,original,"rr");return '<text x="'+p.x+'" y="244" text-anchor="middle" font-size="11" fill="#61737d">'+x.d.slice(2).replace("-","/")+"</text>";}).join("");
  const latest=a[a.length-1],latestRR=xy(latest,a.length-1,"rr"),latestLR=xy(latest,a.length-1,"lr"),benchY=plotBottom-benchmark/max*(plotBottom-plotTop);
  const benchmarkLine=showBenchmark?'<line x1="'+plotLeft+'" y1="'+benchY+'" x2="'+plotRight+'" y2="'+benchY+'" stroke="#7697aa" stroke-width="1.5" stroke-dasharray="5 4"/><text x="'+plotRight+'" y="'+(benchY-5)+'" text-anchor="end" font-size="10" fill="#506d7d">Portfolio recordable benchmark '+benchmark.toFixed(3)+"</text>":"";
  $("trend").innerHTML='<div class="trend-header"><span>Rate per 200,000 worked hours</span><div><span class="dot blue"></span>Recordable <span class="dot wine"></span>LTA'+(showBenchmark?' <span class="benchmark-key">— — Portfolio benchmark</span>':"")+'</div></div><svg viewBox="0 0 '+w+" "+h+'">'+grid+benchmarkLine+'<polyline points="'+points("rr")+'" fill="none" stroke="#075a9b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="'+points("lr")+'" fill="none" stroke="#8e0038" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+dots("rr")+dots("lr")+'<text x="'+Math.min(latestRR.x+8,plotRight-2)+'" y="'+(latestRR.y-8)+'" font-size="11" font-weight="700" fill="#075a9b">Recordable '+latest.rr.toFixed(3)+'</text><text x="'+Math.min(latestLR.x+8,plotRight-2)+'" y="'+(latestLR.y+15)+'" font-size="11" font-weight="700" fill="#8e0038">LTA '+latest.lr.toFixed(3)+'</text>'+labels+'<text x="'+plotLeft+'" y="18" font-size="11" font-weight="700" fill="#61737d">Rate per 200,000 hours</text></svg>';
}
function renderOvertime(){
  const selected=scopeProjects();
  const groups=[{name:"Under 10%",test:x=>x.overtime_share<.10},{name:"10–20%",test:x=>x.overtime_share>=.10&&x.overtime_share<=.20},{name:"Over 20%",test:x=>x.overtime_share>.20}].map(g=>{const p=selected.filter(g.test),m=metrics(p);return {name:g.name,rate:m.rr,h:m.h,n:p.length};}).filter(x=>x.h>0);
  const max=Math.max(...groups.map(x=>x.rate),1);
  $("overtime-analysis").innerHTML=groups.map(x=>'<div class="bar-row overtime-row"><span>'+x.name+'</span><div class="track"><div class="bar '+rateTone(x.rate,metrics(selected).rr)+'" style="width:'+(x.rate/max*100)+'%">'+x.rate.toFixed(3)+"</div></div><b>"+x.n+" project"+(x.n===1?"":"s")+" · "+fmt(x.h)+" hrs</b></div>").join("")||"<p>No overtime exposure data in this scope.</p>";
}
function median(values){
  const a=values.filter(x=>Number.isFinite(x)).sort((a,b)=>a-b);if(!a.length)return 0;
  const mid=Math.floor(a.length/2);return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
}
function groupedRate(projects){
  const m=metrics(projects);return m.h?m.rr:0;
}
function renderDeepAnalysis(p,m,top){
  const topProject=top[0],attention=topProject?topProject.score:0;
  const components=topProject?[
    [topProject.x.lta_incidents?"Serious outcome":"No serious outcome",topProject.x.lta_incidents?100:0],
    ["Closure backlog",(topProject.x.issues_marked_overdue>=45?45:0)+(topProject.x.good_catch_follow_ups_open>=14?20:0)],
    ["Control completion gap",(topProject.x.daily_ptp_compliance<.85?18:0)+(topProject.x.weekly_focus_walk_compliance<.80?18:0)],
    ["Overtime / elevated rate",(topProject.x.overtime_share>.20&&topProject.x.recordable_incident_rate>m.rr?12:0)+(topProject.x.recordable_incident_rate>m.rr*1.5?8:0)]
  ]:[];
  $("attention-index").innerHTML=topProject?'<p class="eyebrow">TRANSPARENT PRIORITIZATION</p><h2>Safety Attention Index</h2><p><b>'+topProject.x.job_id+'</b> has the highest current attention score in this scope: <b>'+attention+'</b>.</p><div class="scorebar"><div style="width:'+Math.min(attention/180*100,100)+'%"></div></div><div class="component-list">'+components.map(x=>'<span>'+x[0]+' <b>'+x[1]+'</b></span>').join("")+'</div><p class="next-step"><b>Next leadership decision:</b> Open '+topProject.x.job_id+' and confirm the recommended action, owner, and closure evidence.</p><p class="analysis-note">This score does not penalize Safety Issue or Good Catch reporting. Only overdue issues and open Good Catch follow-ups contribute to the closure-backlog component. It is an action-prioritization rule, not a prediction model.</p>':'<h2>Safety Attention Index</h2><p>No projects match this scope.</p>';
  const ptpLow=p.filter(x=>x.daily_ptp_compliance<.85),ptpHigh=p.filter(x=>x.daily_ptp_compliance>=.85),focusLow=p.filter(x=>x.weekly_focus_walk_compliance<.80),focusHigh=p.filter(x=>x.weekly_focus_walk_compliance>=.80);
  $("control-analysis").innerHTML='<p class="eyebrow">CONTROL EFFECTIVENESS</p><h2>Preventive-control associations</h2><p>Compare planning and inspection completion groups to decide where leadership should strengthen routine controls.</p><div class="mini-metrics"><div><span>PTP below 85%</span><b class="metric-value '+rateTone(groupedRate(ptpLow),m.rr)+'">'+groupedRate(ptpLow).toFixed(3)+'</b><small>recordable rate</small></div><div><span>PTP at or above 85%</span><b class="metric-value '+rateTone(groupedRate(ptpHigh),m.rr)+'">'+groupedRate(ptpHigh).toFixed(3)+'</b><small>recordable rate</small></div><div><span>Focus Walk below 80%</span><b class="metric-value '+rateTone(groupedRate(focusLow),m.rr)+'">'+groupedRate(focusLow).toFixed(3)+'</b><small>recordable rate</small></div><div><span>Focus Walk at or above 80%</span><b class="metric-value '+rateTone(groupedRate(focusHigh),m.rr)+'">'+groupedRate(focusHigh).toFixed(3)+'</b><small>recordable rate</small></div></div><p class="next-step"><b>Next leadership decision:</b> Ask projects below the completion thresholds to restore planning and inspection discipline before the next work period.</p><p class="analysis-note">Comparisons are exposure-adjusted and descriptive; they do not establish causation.</p>';
  const followRequired=p.reduce((s,x)=>s+(x.good_catches_requiring_follow_up||0),0),followOpen=p.reduce((s,x)=>s+x.good_catch_follow_ups_open,0),issuesOpen=p.reduce((s,x)=>s+x.issues_currently_open_or_in_progress,0),issuesOver=p.reduce((s,x)=>s+x.issues_marked_overdue,0);
  const followRate=followRequired?followOpen/followRequired:0;
  $("closure-analysis").innerHTML='<p class="eyebrow">CLOSURE ACCOUNTABILITY</p><h2>Does reporting become verified control?</h2><p>Safety Issues and Good Catches show successful hazard detection. These measures focus only on whether required follow-up and issue closure remain unresolved.</p><div class="mini-metrics three-up"><div><span>Open Good Catch follow-ups</span><b class="metric-value '+(followRate>.45?"red":followRate>.25?"amber":"green")+'">'+(followRate*100).toFixed(1)+'%</b><small>'+followOpen+' of '+followRequired+' requiring follow-up</small></div><div><span>Overdue safety issues</span><b class="metric-value '+backlogTone(issuesOver)+'">'+issuesOver+'</b><small>items marked overdue</small></div><div><span>Open or in-progress issues</span><b class="metric-value '+backlogTone(issuesOpen)+'">'+issuesOpen+'</b><small>current unresolved issue status</small></div></div><p class="next-step"><b>Next leadership decision:</b> Escalate aged high-severity items until correction evidence and field verification are recorded.</p><p class="analysis-note">Reporting activity is not a negative signal. “Overdue” and “open or in progress” are separate measures, not a numerator and denominator; neither implies an identified hazard became an incident.</p>';
  const weather=(data.deep?.condition_weather_profile||[]).filter(x=>x.meets_100k_hour_comparison_threshold).sort((a,b)=>b.recordable_incident_rate-a.recordable_incident_rate).slice(0,2);
  const work=(data.deep?.condition_work_activity_profile||[]).filter(x=>x.meets_100k_hour_comparison_threshold).sort((a,b)=>b.recordable_incident_rate-a.recordable_incident_rate).slice(0,2);
  $("conditions-analysis").innerHTML='<p class="eyebrow">WORK-CONDITION CONTEXT</p><h2>Where exposure merits extra planning</h2><p>Use recurring conditions to focus the next pre-task plan and Focus Walk.</p><div class="condition-list"><div><b>Weather</b>'+weather.map(x=>'<span>'+x.group+' · '+Number(x.recordable_incident_rate).toFixed(3)+' recordable rate</span>').join("")+'</div><div><b>Work activity</b>'+work.map(x=>'<span>'+x.group+' · '+Number(x.recordable_incident_rate).toFixed(3)+' recordable rate</span>').join("")+'</div></div><p class="next-step"><b>Next leadership decision:</b> Ask teams doing these activities to address the identified condition in their next PTP and Focus Walk.</p><p class="analysis-note">Portfolio-wide condition comparison; use it to focus pre-task planning, not to claim a condition caused an incident.</p>';
}
function renderScatter(){
  const p=scopeProjects();
  if(!p.length){$("scatter").innerHTML='<text x="40" y="60" font-size="14" fill="#5b707b">No project comparison data in this scope.</text>';return;}
  const left=58,right=478,top=34,bottom=235,maxY=Math.max(...p.map(x=>x.recordable_incident_rate),1)*1.1;
  const xPos=v=>left+v*(right-left),yPos=v=>bottom-v/maxY*(bottom-top);
  const grid=[0,.25,.5,.75,1].map(t=>{const x=xPos(t),y=yPos(maxY*t);return '<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+bottom+'" stroke="#edf2f3"/><text x="'+x+'" y="'+(bottom+17)+'" text-anchor="middle" font-size="10" fill="#61737d">'+Math.round(t*100)+'%</text><line x1="'+left+'" y1="'+y+'" x2="'+right+'" y2="'+y+'" stroke="#edf2f3"/><text x="'+(left-7)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#61737d">'+(maxY*t).toFixed(2)+'</text>';}).join("");
  const points=p.map(x=>{const selected=x.job_id===selectedProject,stroke=selected?"#d99c28":"#fff",sw=selected?3:1.3,r=5+Math.sqrt(x.total_hours/100000)*2.8;return '<circle onclick="openProject(\''+x.job_id+'\')" cx="'+xPos(x.weekly_focus_walk_compliance)+'" cy="'+yPos(x.recordable_incident_rate)+'" r="'+r+'" fill="'+(x.lta_incidents?"#8e0038":"#075a9b")+'" stroke="'+stroke+'" stroke-width="'+sw+'" opacity=".82"><title>'+x.job_id+' · '+(x.weekly_focus_walk_compliance*100).toFixed(1)+'% Focus Walk · '+x.recordable_incident_rate.toFixed(3)+' recordable rate · '+fmt(x.total_hours)+' hours</title></circle>';}).join("");
  $("scatter").innerHTML=grid+'<line x1="'+left+'" y1="'+bottom+'" x2="'+right+'" y2="'+bottom+'" stroke="#9bb1ba"/><line x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+bottom+'" stroke="#9bb1ba"/>'+points+'<text x="'+((left+right)/2)+'" y="'+(bottom+38)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#506d7d">Weekly Focus Walk completion</text><text x="15" y="'+((top+bottom)/2)+'" transform="rotate(-90 15 '+((top+bottom)/2)+')" text-anchor="middle" font-size="11" font-weight="700" fill="#506d7d">Recordable rate per 200,000 hours</text><circle cx="70" cy="288" r="6" fill="#075a9b"/><text x="81" y="292" font-size="11" fill="#506d7d">No LTA</text><circle cx="148" cy="288" r="6" fill="#8e0038"/><text x="159" y="292" font-size="11" fill="#506d7d">LTA recorded</text><circle cx="264" cy="288" r="9" fill="none" stroke="#506d7d"/><text x="278" y="292" font-size="11" fill="#506d7d">Circle size = worked hours</text><text x="70" y="313" font-size="11" fill="#506d7d">Select a circle to open Project 360</text>';
}
function renderReplicate(p,m){
  const candidates=p.filter(x=>!x.lta_incidents&&x.recordable_incident_rate<=m.rr&&x.daily_ptp_compliance>=.9&&x.weekly_focus_walk_compliance>=.9&&x.issues_marked_overdue<20).sort((a,b)=>b.weekly_focus_walk_compliance-a.weekly_focus_walk_compliance||a.issues_marked_overdue-b.issues_marked_overdue);
  const x=candidates[0];
  const signals=[
    {name:"no LTA",pass:y=>!y.lta_incidents},
    {name:"below-scope recordable rate",pass:y=>y.recordable_incident_rate<=m.rr},
    {name:"Daily PTP at least 90%",pass:y=>y.daily_ptp_compliance>=.9},
    {name:"Focus Walk at least 90%",pass:y=>y.weekly_focus_walk_compliance>=.9},
    {name:"fewer than 20 overdue issues",pass:y=>y.issues_marked_overdue<20}
  ];
  const closest=p.map(y=>({y,passes:signals.filter(s=>s.pass(y)),gaps:signals.filter(s=>!s.pass(y))})).sort((a,b)=>b.passes.length-a.passes.length||a.y.issues_marked_overdue-b.y.issues_marked_overdue||a.y.recordable_incident_rate-b.y.recordable_incident_rate)[0];
  if(x){
    $("replicate-card").innerHTML='<p class="eyebrow">POTENTIAL LEADING-CONTROL PROFILE</p><h2>'+x.job_id+" · "+x.state+'</h2><p>This project meets all five preventive-control signals in the selected scope: <b>'+(x.daily_ptp_compliance*100).toFixed(1)+'%</b> Daily PTP, <b>'+(x.weekly_focus_walk_compliance*100).toFixed(1)+'%</b> Focus Walk, and <b>'+x.issues_marked_overdue+'</b> overdue issues.</p><p class="next-step"><b>Next leadership decision:</b> Validate the field routine with this project before sharing it with comparable teams.</p><p class="analysis-note">This profile identifies a practice to investigate; it does not establish causation.</p><button onclick="openProject(\''+x.job_id+'\')">Compare Project 360</button>';
  }else if(closest){
    const y=closest.y;
    $("replicate-card").innerHTML='<p class="eyebrow">PROMISING PRACTICE TO VALIDATE</p><h2>'+y.job_id+" · "+y.state+' meets '+closest.passes.length+' of 5 preventive-control signals.</h2><p>Strongest signals: '+closest.passes.map(s=>s.name).join(", ")+'. Remaining gap: <b>'+closest.gaps.map(s=>s.name).join(", ")+'</b>.</p><p class="next-step"><b>Next leadership decision:</b> Review this project’s routine in the field, address the remaining gap, then decide whether any practice should be adapted elsewhere.</p><p class="analysis-note">This is a candidate for learning—not proof that its practices caused an outcome.</p><button onclick="openProject(\''+y.job_id+'\')">Review Project 360</button>';
  }else{$("replicate-card").innerHTML='<p class="eyebrow">PROMISING PRACTICE TO VALIDATE</p><h2>No projects match this selected scope.</h2><p>Choose a broader state or portfolio view to identify a project for field learning.</p>';}
}
function renderProject(){
  const id=selectedProject||$("project-360").value;if(!id)return;
  $("project-360").value=id;const x=data.projects.find(p=>p.job_id===id),m=metrics(scopeProjects()),z=priority(x,m),s=statusFor(id);
  const peers=data.projects.filter(p=>p.job_id!==id&&p.project_type===x.project_type&&p.contract_size_band===x.contract_size_band);
  const peerRate=median(peers.map(p=>p.recordable_incident_rate)),peerFocus=median(peers.map(p=>p.weekly_focus_walk_compliance)),peerOver=median(peers.map(p=>p.issues_marked_overdue));
  const peerBlock=peers.length?'<article class="peer-card"><p class="eyebrow">FAIR PEER BENCHMARK</p><h3>'+peers.length+' comparable '+x.project_type+' projects in '+x.contract_size_band+'</h3><div class="peer-metrics"><span>Project rate <b class="metric-value '+rateTone(x.recordable_incident_rate,peerRate)+'">'+x.recordable_incident_rate.toFixed(3)+'</b><small>Peer median '+peerRate.toFixed(3)+'</small></span><span>Focus Walk <b class="metric-value '+controlTone(x.weekly_focus_walk_compliance)+'">'+(x.weekly_focus_walk_compliance*100).toFixed(1)+'%</b><small>Peer median '+(peerFocus*100).toFixed(1)+'%</small></span><span>Overdue issues <b class="metric-value '+backlogTone(x.issues_marked_overdue)+'">'+x.issues_marked_overdue+'</b><small>Peer median '+peerOver.toFixed(0)+'</small></span></div><p class="analysis-note">This comparison uses similar project type and contract-size band, not raw portfolio ranking.</p></article>':'<article class="peer-card"><p class="eyebrow">FAIR PEER BENCHMARK</p><p>No comparable project group is available for this combination.</p></article>';
  $("project-card").innerHTML='<p class="eyebrow">'+x.project_type.toUpperCase()+" · "+x.state+'</p><div class="project-title-row"><h2>'+id+'</h2><span class="status '+s+'">'+statusLabel(s)+'</span></div><div class="kpis project-kpis"><div class="kpi"><label>Recordable rate</label>'+valueHtml(x.recordable_incident_rate.toFixed(3),rateTone(x.recordable_incident_rate,m.rr),"per 200,000 hours")+'</div><div class="kpi"><label>LTA rate</label>'+valueHtml(x.lta_rate.toFixed(3),x.lta_incidents?"red":"green","per 200,000 hours")+'</div><div class="kpi"><label>Focus Walk</label>'+valueHtml((x.weekly_focus_walk_compliance*100).toFixed(1)+"%",controlTone(x.weekly_focus_walk_compliance),"completion")+'</div><div class="kpi"><label>Overdue issues</label>'+valueHtml(x.issues_marked_overdue,backlogTone(x.issues_marked_overdue),"requires closure")+'</div></div><div class="decision"><p class="eyebrow">RECOMMENDED DECISION</p><b>'+esc(z.decision)+'</b><p><b>Why this project:</b> '+esc(z.f.join(" · "))+'</p><p><b>Accountable owner:</b> '+esc(z.owner)+'</p><p><b>Closure verification:</b> '+esc(z.verify)+'</p><button onclick="sendActionReport(\''+id+'\')">Send action report</button></div>'+peerBlock;
}
function sendActionReport(id){
  const x=data.projects.find(p=>p.job_id===id),z=priority(x,metrics(scopeProjects())),existing=actionState[id]||{};dispatch={x,z};
  $("report-title").textContent="Action report · "+id;
  $("report-summary").textContent="Review the proposed action, then route it to the accountable role";
  $("report-evidence").innerHTML="<b>Evidence used:</b> "+esc(z.f.join(" · "))+" · selected-scope decision signals, not causal links or predictions";
  $("report-owner").innerHTML=[existing.owner||z.owner,"Regional Safety Leader","Project Manager","Project Safety Manager","Superintendent"].filter((v,i,a)=>a.indexOf(v)===i).map(v=>"<option>"+v+"</option>").join("");
  $("report-owner").value=existing.owner||z.owner;$("report-due").value=existing.due||defaultDate(7);$("report-lifecycle").value=existing.status&&existing.status!=="needs-review"?existing.status:"sent";
  $("report-action").value=existing.decision||z.decision;$("report-verify").value=existing.verify||z.verify;
  $("report-message").value=existing.message||("Safety 360 action report\n\nProject: "+id+" · "+x.state+"\nWhy now: "+z.f.join("; ")+"\nAccountable owner: "+z.owner+"\n\nThis is evidence-based prioritization, not a causal prediction.");
  $("report-status").textContent="";$("report-modal").showModal();
}
function saveDraft(){
  if(!dispatch)return;
  actionState[dispatch.x.job_id]={...actionState[dispatch.x.job_id],owner:$("report-owner").value,due:$("report-due").value,decision:$("report-action").value,verify:$("report-verify").value,message:$("report-message").value};
  saveActionState();$("report-status").textContent="Draft saved · this action has not been routed";render();
}
function updateAction(){
  if(!dispatch)return;
  const id=dispatch.x.job_id,existing=actionState[id]||{};
  actionState[id]={...existing,status:existing.status||"needs-review",owner:$("report-owner").value,due:$("report-due").value,decision:$("report-action").value,verify:$("report-verify").value,message:$("report-message").value};
  saveActionState();$("report-status").textContent="Action details updated · route the report when ready";render();
}
function sendReport(){
  if(!dispatch)return;
  const id=dispatch.x.job_id,status=$("report-lifecycle").value;
  actionState[id]={status,owner:$("report-owner").value,due:$("report-due").value,decision:$("report-action").value,verify:$("report-verify").value,message:$("report-message").value};
  saveActionState();$("report-status").textContent=statusLabel(status)+" · routed to "+$("report-owner").value+" · due "+($("report-due").value||"not assigned");render();
}
function submitFieldReport(e){
  e.preventDefault();
  const project=data.projects.find(x=>x.job_id===$("capture-project").value);
  if(!project)return;
  const report={id:editingReportId||("FR-"+String(Date.now()).slice(-6)),type:$("capture-type").value,project:project.job_id,state:project.state,hazard:$("capture-hazard").value,severity:$("capture-severity").value,owner:$("capture-owner").value,due:$("capture-due").value,observation:$("capture-observation").value,status:"Awaiting supervisor review"};
  const updatedId=editingReportId;
  if(updatedId){fieldReports=fieldReports.map(x=>x.id===updatedId?report:x);$("capture-status").textContent="Changes saved to "+updatedId+" and returned to supervisor review";}else{fieldReports.unshift(report);$("capture-status").textContent="Report captured and routed for supervisor review";}
  localStorage.setItem("safety360-field-reports",JSON.stringify(fieldReports));resetFieldEdit();renderCaptureQueue();
}
function renderCaptureQueue(){
  $("capture-queue").innerHTML=fieldReports.length?fieldReports.slice(0,6).map(r=>'<div class="capture-item '+(r.id===editingReportId?"editing":"")+'"><div><span class="status awaiting">'+r.status+'</span><strong>'+esc(r.type)+" · "+r.project+'</strong><p>'+esc(r.hazard)+" · "+esc(r.severity)+" · Owner: "+esc(r.owner)+'</p><p>'+esc(r.observation)+'</p><div class="capture-actions"><button type="button" class="secondary" onclick="editFieldReport(\''+r.id+'\')">'+(r.id===editingReportId?"Editing":"Edit")+'</button><button type="button" class="delete-btn" onclick="deleteFieldReport(\''+r.id+'\')">Delete</button></div></div><small>Due '+esc(r.due||"not assigned")+'</small></div>').join(""):'<p class="empty-state">No field reports captured in this session</p>';
}
function editFieldReport(id){
  const r=fieldReports.find(x=>x.id===id);if(!r)return;
  if(![...$("capture-project").options].some(x=>x.value===r.project))$("capture-project").innerHTML+='<option value="'+r.project+'">'+r.project+" · "+esc(r.state)+"</option>";
  editingReportId=id;$("capture-type").value=r.type;$("capture-project").value=r.project;$("capture-hazard").value=r.hazard;$("capture-severity").value=r.severity;$("capture-owner").value=r.owner;$("capture-due").value=r.due||defaultDate(7);$("capture-observation").value=r.observation;$("capture-submit").textContent="Save changes";$("capture-cancel").hidden=false;$("capture-mode").hidden=false;$("capture-mode").textContent="Editing "+r.id+" from the supervisor review queue";$("capture-status").textContent="Update the details, then save changes when ready";renderCaptureQueue();show("field");setTimeout(()=>$("field-form").scrollIntoView({behavior:"smooth",block:"start"}),0);
}
function resetFieldEdit(){
  editingReportId=null;$("capture-submit").textContent="Submit for supervisor review";$("capture-cancel").hidden=true;$("capture-mode").hidden=true;$("capture-mode").textContent="";$("capture-observation").value="";$("capture-due").value=defaultDate(7);
}
function cancelFieldEdit(){
  if(!editingReportId)return;
  resetFieldEdit();$("capture-status").textContent="Editing cancelled";renderCaptureQueue();
}
function deleteFieldReport(id){
  const r=fieldReports.find(x=>x.id===id);if(!r||!window.confirm("Delete "+r.id+"? This cannot be undone in this session"))return;
  fieldReports=fieldReports.filter(x=>x.id!==id);localStorage.setItem("safety360-field-reports",JSON.stringify(fieldReports));if(editingReportId===id){resetFieldEdit();$("field-form").reset();$("capture-due").value=defaultDate(7);$("capture-status").textContent="Report deleted";}renderCaptureQueue();
}
function openProject(id){selectedProject=id;$("project-filter").value=id;$("project-360").value=id;render();show("project");}
function home(){$("home").classList.add("active");$("workspace").classList.remove("active");document.body.classList.add("home-active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));window.scrollTo({top:0,behavior:"smooth"});}
function show(id){$("home").classList.remove("active");$("workspace").classList.add("active");document.body.classList.remove("home-active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.view===id));window.scrollTo({top:0,behavior:"smooth"});}
