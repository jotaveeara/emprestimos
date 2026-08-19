(() => {
  "use strict";
  const DAILY = {500:35,600:40,700:46,800:54,900:60,1000:65};
  // Valores da tabela semanal: valor emprestado -> parcelas para 4, 6 e 8 semanas.
  const WEEKLY = {
    500:{4:150,6:110,8:90},600:{4:180,6:132,8:108},700:{4:210,6:154,8:126},
    800:{4:240,6:176,8:144},900:{4:270,6:198,8:162},1000:{4:300,6:220,8:180}
  };
  const $ = id => document.getElementById(id);
  const state = {client:null,user:null,clients:[],loans:[],installments:[],payments:[]};
  const money = value => Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const isoToday = () => new Date().toLocaleDateString("en-CA");
  const localDate = iso => new Date(`${iso}T12:00:00`);
  const formatDate = iso => localDate(iso).toLocaleDateString("pt-BR");
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
  const escapeHtml = value => String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  function toast(message,error=false){const el=$("toast");el.textContent=message;el.className=`toast show${error?" error":""}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",3200)}
  function configured(){const c=window.APP_CONFIG||{};return /^https:\/\/.+\.supabase\.co$/.test(c.SUPABASE_URL||"")&&!/COLE_AQUI/.test(c.SUPABASE_ANON_KEY||"")}

  async function init(){
    $("loan-date").value=isoToday();$("first-due-date").value=isoToday();$("closing-month").value=monthKey(new Date());
    bindEvents();updatePlanFields();
    if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
    if(!configured()||!window.supabase){$("config-warning").hidden=false;$("auth-form").querySelectorAll("button").forEach(b=>b.disabled=true);return}
    state.client=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
    const {data:{session}}=await state.client.auth.getSession();await applySession(session);
    state.client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>applySession(session),0));
  }
  function bindEvents(){
    $("auth-form").addEventListener("submit",login);$("signup-btn").addEventListener("click",signup);$("logout-btn").addEventListener("click",()=>state.client.auth.signOut());
    document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
    document.querySelectorAll("[data-open-loan]").forEach(b=>b.addEventListener("click",openLoan));
    $("new-client-btn").addEventListener("click",()=>$("client-dialog").showModal());
    document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
    $("client-form").addEventListener("submit",saveClient);$("loan-form").addEventListener("submit",saveLoan);
    ["loan-plan","loan-amount","weekly-term","monthly-count","monthly-installment"].forEach(id=>$(id).addEventListener("input",()=>{if(id==="loan-plan")updatePlanFields();renderPreview()}));
    $("charge-filter").addEventListener("change",renderCharges);$("loan-filter").addEventListener("change",renderLoans);$("closing-month").addEventListener("change",renderClosing);
    $("charges-list").addEventListener("click",handleListClick);$("loans-list").addEventListener("click",handleListClick);$("loan-detail-dialog").addEventListener("click",handleListClick);
  }
  async function login(event){event.preventDefault();setAuthBusy(true);const {error}=await state.client.auth.signInWithPassword({email:$("auth-email").value.trim(),password:$("auth-password").value});setAuthBusy(false);if(error)toast(authMessage(error.message),true)}
  async function signup(){setAuthBusy(true);const {data,error}=await state.client.auth.signUp({email:$("auth-email").value.trim(),password:$("auth-password").value});setAuthBusy(false);if(error)return toast(authMessage(error.message),true);toast(data.session?"Conta criada.":"Conta criada. Confirme o e-mail para entrar.")}
  function authMessage(msg){if(/Invalid login/i.test(msg))return"E-mail ou senha incorretos.";if(/already registered/i.test(msg))return"Este e-mail já está cadastrado.";return msg}
  function setAuthBusy(busy){$("login-btn").disabled=busy;$("signup-btn").disabled=busy}
  async function applySession(session){state.user=session?.user||null;$("auth-screen").hidden=!!state.user;$("app").hidden=!state.user;if(!state.user){state.clients=[];state.loans=[];return}$("user-email").textContent=state.user.email;await loadData()}
  async function loadData(){
    const [clients,loans,installments,payments]=await Promise.all([
      state.client.from("clients").select("*").order("name"),
      state.client.from("loans").select("*").order("loan_date",{ascending:false}),
      state.client.from("installments").select("*").order("due_date"),
      state.client.from("payments").select("*").order("paid_at",{ascending:false})
    ]);
    const failed=[clients,loans,installments,payments].find(r=>r.error);if(failed){toast(`Erro ao carregar: ${failed.error.message}`,true);return}
    state.clients=clients.data;state.loans=loans.data;state.installments=installments.data;state.payments=payments.data;renderAll();
  }
  function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="closing")renderClosing()}
  function clientName(id){return state.clients.find(c=>c.id===id)?.name||"Cliente removido"}
  function renderAll(){renderClients();renderLoans();renderDashboard();renderClosing();populateClients()}
  function metric(label,value,negative=false){return `<article class="metric${negative?" negative":""}"><span>${label}</span><strong>${money(value)}</strong></article>`}
  function renderDashboard(){
    const open=state.installments.filter(i=>i.status==="open");const received=state.payments.reduce((s,p)=>s+Number(p.amount),0);const active=state.loans.filter(l=>l.status==="active");const late=open.filter(i=>i.due_date<isoToday());
    $("dashboard-cards").innerHTML=metric("Capital em operações",active.reduce((s,l)=>s+Number(l.principal),0))+metric("Total a receber",open.reduce((s,i)=>s+Number(i.amount),0))+metric("Total já recebido",received)+metric("Em atraso",late.reduce((s,i)=>s+Number(i.amount),0),late.length>0);renderCharges();
  }
  function renderCharges(){
    const filter=$("charge-filter").value,today=isoToday();let rows=state.installments.filter(i=>i.status==="open");if(filter==="today")rows=rows.filter(i=>i.due_date===today);if(filter==="late")rows=rows.filter(i=>i.due_date<today);
    $("charges-list").innerHTML=rows.length?rows.map(i=>{const loan=state.loans.find(l=>l.id===i.loan_id);const kind=i.due_date<today?"late":i.due_date===today?"today":"";return `<article class="list-item"><div class="list-main"><strong>${escapeHtml(clientName(loan?.client_id))}</strong><span>Parcela ${i.number} · ${formatDate(i.due_date)}</span>${kind?`<span class="status ${kind}">${kind==="late"?"ATRASADA":"HOJE"}</span>`:""}</div><div class="list-value"><strong>${money(i.amount)}</strong><button class="primary small" data-pay="${i.id}">Recebeu</button></div></article>`}).join(""):empty("Nenhuma cobrança neste filtro.")
  }
  function renderClients(){$("clients-list").innerHTML=state.clients.length?state.clients.map(c=>{const loans=state.loans.filter(l=>l.client_id===c.id);return `<article class="list-item"><div class="list-main"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.phone||"Sem telefone")}</span></div><div class="list-value"><strong>${loans.length}</strong><span>empréstimo(s)</span></div></article>`}).join(""):empty("Nenhum cliente cadastrado.")}
  function renderLoans(){let loans=state.loans;const filter=$("loan-filter").value;if(filter!=="all")loans=loans.filter(l=>l.status===filter);$("loans-list").innerHTML=loans.length?loans.map(l=>{const open=state.installments.filter(i=>i.loan_id===l.id&&i.status==="open");return `<button class="list-item" data-loan="${l.id}"><div class="list-main"><strong>${escapeHtml(clientName(l.client_id))}</strong><span>${planLabel(l.plan_type)} · ${formatDate(l.loan_date)}</span></div><div class="list-value"><strong>${money(open.reduce((s,i)=>s+Number(i.amount),0))}</strong><span>${open.length} parcela(s) abertas</span></div></button>`}).join(""):empty("Nenhum empréstimo neste filtro.")}
  function renderClosing(){const month=$("closing-month").value;const made=state.loans.filter(l=>l.loan_date.startsWith(month));const payments=state.payments.filter(p=>p.paid_at.slice(0,7)===month);const received=payments.reduce((s,p)=>s+Number(p.amount),0);const realized=payments.reduce((s,p)=>{const loan=state.loans.find(l=>l.id===p.loan_id);return s+(loan?Number(p.amount)*(Number(loan.expected_profit)/Number(loan.total_receivable)):0)},0);const late=state.installments.filter(i=>i.status==="open"&&i.due_date<isoToday()&&i.due_date.startsWith(month));$("closing-cards").innerHTML=metric("Capital emprestado",made.reduce((s,l)=>s+Number(l.principal),0))+metric("Lucro previsto",made.reduce((s,l)=>s+Number(l.expected_profit),0))+metric("Recebido no mês",received)+metric("Lucro realizado",realized)+metric("Vencido no mês",late.reduce((s,i)=>s+Number(i.amount),0),late.length>0)}
  function empty(text){return `<div class="empty">${text}</div>`}
  function planLabel(type){return ({daily:"Diário",weekly:"Semanal",monthly:"Mensal"})[type]||type}
  function populateClients(){$("loan-client").innerHTML=state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
  function openLoan(){if(!state.clients.length){toast("Cadastre um cliente primeiro.",true);showView("clients");return}populateClients();updatePlanFields();renderPreview();$("loan-dialog").showModal()}
  function updatePlanFields(){const type=$("loan-plan").value;$("weekly-term-wrap").hidden=type!=="weekly";$("monthly-count-wrap").hidden=type!=="monthly";$("monthly-installment-wrap").hidden=type!=="monthly";const amounts=type==="monthly"?[500,600,700,800,900,1000,1500,2000]:Object.keys(type==="daily"?DAILY:WEEKLY);const old=$("loan-amount").value;$("loan-amount").innerHTML=amounts.map(a=>`<option value="${a}">${money(a)}</option>`).join("");if(amounts.map(String).includes(old))$("loan-amount").value=old;renderPreview()}
  function loanTerms(){const type=$("loan-plan").value,principal=Number($("loan-amount").value);if(type==="daily")return {count:20,amount:DAILY[principal],interval:"daily"};if(type==="weekly"){const count=Number($("weekly-term").value);return {count,amount:WEEKLY[principal]?.[count],interval:"weekly"}}return {count:Number($("monthly-count").value),amount:Number($("monthly-installment").value),interval:"monthly"}}
  function renderPreview(){const t=loanTerms(),principal=Number($("loan-amount").value),total=t.count*t.amount,profit=total-principal;$("loan-preview").innerHTML=`<div><span>PARCELAS</span><strong>${t.count} × ${money(t.amount)}</strong></div><div><span>TOTAL A RECEBER</span><strong>${money(total)}</strong></div><div><span>LUCRO PREVISTO</span><strong>${money(profit)}</strong></div>`}
  async function saveClient(event){event.preventDefault();const payload={user_id:state.user.id,name:$("client-name").value.trim(),phone:$("client-phone").value.trim()||null,notes:$("client-notes").value.trim()||null};const {error}=await state.client.from("clients").insert(payload);if(error)return toast(error.message,true);$("client-form").reset();$("client-dialog").close();toast("Cliente salvo.");await loadData()}
  function dueDates(start,count,interval){const dates=[];let d=localDate(start);for(let n=0;n<count;n++){if(n>0){if(interval==="daily"){do d.setDate(d.getDate()+1);while(d.getDay()===0)}else if(interval==="weekly")d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1)}dates.push(d.toLocaleDateString("en-CA"))}return dates}
  async function saveLoan(event){
    event.preventDefault();const terms=loanTerms(),principal=Number($("loan-amount").value),total=terms.count*terms.amount;if(!terms.count||!terms.amount||total<=principal)return toast("Revise o plano: o total deve ser maior que o valor emprestado.",true);
    const payload={user_id:state.user.id,client_id:$("loan-client").value,plan_type:$("loan-plan").value,principal,installment_count:terms.count,installment_amount:terms.amount,total_receivable:total,expected_profit:total-principal,loan_date:$("loan-date").value,first_due_date:$("first-due-date").value,status:"active"};
    const {data:loan,error}=await state.client.from("loans").insert(payload).select().single();if(error)return toast(error.message,true);
    const rows=dueDates(payload.first_due_date,terms.count,terms.interval).map((due,index)=>({user_id:state.user.id,loan_id:loan.id,number:index+1,amount:terms.amount,due_date:due,status:"open"}));const {error:installmentError}=await state.client.from("installments").insert(rows);
    if(installmentError){await state.client.from("loans").delete().eq("id",loan.id);return toast(`Parcelas não criadas: ${installmentError.message}`,true)}
    $("loan-dialog").close();toast("Empréstimo criado.");await loadData();showView("loans");
  }
  async function handleListClick(event){const pay=event.target.closest("[data-pay]");if(pay){event.stopPropagation();await receivePayment(pay.dataset.pay);return}const loan=event.target.closest("[data-loan]");if(loan)showLoanDetail(loan.dataset.loan);if(event.target.closest("[data-close-detail]"))$("loan-detail-dialog").close()}
  async function receivePayment(id){const inst=state.installments.find(i=>i.id===id);if(!inst||inst.status!=="open")return;const {error}=await state.client.from("payments").insert({user_id:state.user.id,loan_id:inst.loan_id,installment_id:inst.id,amount:inst.amount,paid_at:new Date().toISOString()});if(error)return toast(error.message,true);const {error:updateError}=await state.client.from("installments").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",inst.id);if(updateError)return toast(updateError.message,true);const remaining=state.installments.filter(i=>i.loan_id===inst.loan_id&&i.status==="open"&&i.id!==inst.id);if(!remaining.length)await state.client.from("loans").update({status:"paid"}).eq("id",inst.loan_id);toast("Pagamento registrado.");await loadData();if($("loan-detail-dialog").open)showLoanDetail(inst.loan_id)}
  function showLoanDetail(id){const loan=state.loans.find(l=>l.id===id);if(!loan)return;const installments=state.installments.filter(i=>i.loan_id===id);$("loan-detail").innerHTML=`<div class="section-head compact"><div><p class="eyebrow">${planLabel(loan.plan_type).toUpperCase()}</p><h2>${escapeHtml(clientName(loan.client_id))}</h2></div><button class="ghost" data-close-detail>Fechar</button></div><div class="preview"><div><span>EMPRESTADO</span><strong>${money(loan.principal)}</strong></div><div><span>TOTAL</span><strong>${money(loan.total_receivable)}</strong></div><div><span>LUCRO</span><strong>${money(loan.expected_profit)}</strong></div></div><div class="installments">${installments.map(i=>`<div class="installment"><span>${i.number}. ${formatDate(i.due_date)}</span><strong>${money(i.amount)}</strong>${i.status==="paid"?'<span class="status paid">PAGA</span>':`<button class="primary small" data-pay="${i.id}">Recebeu</button>`}</div>`).join("")}</div>`;if(!$("loan-detail-dialog").open)$("loan-detail-dialog").showModal()}
  document.addEventListener("DOMContentLoaded",init);
})();
