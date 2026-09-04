(() => {
  const TAB_ORDER_KEY='tp.workspaceTabOrder', ACTIVE_TAB_KEY='tp.activeWorkspaceTab';
  const app=document.querySelector('.app');
  if(!app)return;
  const subtitle=document.querySelector('.subtitle');
  if(subtitle) subtitle.textContent=subtitle.textContent.replace(/Cloud v[^ ]+$/,'Cloud v6.4.2 TEST');
  const tabs=document.createElement('div');
  tabs.id='workspaceTabs'; tabs.className='workspace-tabs';
  tabs.innerHTML='<button class="workspace-tab active" draggable="true" data-tab="teaching">體育課課表</button><button class="workspace-tab" draggable="true" data-tab="control">項目控管</button>';
  app.parentNode.insertBefore(tabs,app);
  const teaching=document.createElement('section');
  teaching.id='teachingPage'; teaching.className='workspace-page active';
  app.parentNode.insertBefore(teaching,app); teaching.appendChild(app);
  const control=document.createElement('section');
  control.id='controlPage'; control.className='workspace-page';
  control.innerHTML='<div class="control-page"><div class="control-card"><h2>項目控管</h2><p>這一頁已和體育課課表分開，先保留為獨立工作區。</p><div class="control-placeholder">項目控管功能區</div></div></div>';
  teaching.parentNode.insertBefore(control,teaching.nextSibling);
  function activate(name){
    document.querySelectorAll('.workspace-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    teaching.classList.toggle('active',name==='teaching'); control.classList.toggle('active',name==='control');
    localStorage.setItem(ACTIVE_TAB_KEY,name);
  }
  let saved=[]; try{saved=JSON.parse(localStorage.getItem(TAB_ORDER_KEY)||'[]')}catch(e){}
  saved.forEach(id=>{const el=tabs.querySelector(`[data-tab="${id}"]`);if(el)tabs.appendChild(el)});
  let dragged=null;
  tabs.querySelectorAll('.workspace-tab').forEach(tab=>{
    tab.onclick=()=>activate(tab.dataset.tab);
    tab.ondragstart=e=>{dragged=tab;tab.classList.add('dragging');e.dataTransfer.effectAllowed='move'};
    tab.ondragend=()=>{tab.classList.remove('dragging');tabs.querySelectorAll('.workspace-tab').forEach(x=>x.classList.remove('drag-over'));dragged=null};
    tab.ondragover=e=>{e.preventDefault();if(dragged&&dragged!==tab)tab.classList.add('drag-over')};
    tab.ondragleave=()=>tab.classList.remove('drag-over');
    tab.ondrop=e=>{e.preventDefault();tab.classList.remove('drag-over');if(!dragged||dragged===tab)return;const r=tab.getBoundingClientRect();tabs.insertBefore(dragged,e.clientX<r.left+r.width/2?tab:tab.nextSibling);localStorage.setItem(TAB_ORDER_KEY,JSON.stringify([...tabs.querySelectorAll('.workspace-tab')].map(x=>x.dataset.tab)))};
  });
  const active=localStorage.getItem(ACTIVE_TAB_KEY)||'teaching'; activate(tabs.querySelector(`[data-tab="${active}"]`)?active:'teaching');
})();