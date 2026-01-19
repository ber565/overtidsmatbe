
// overtidsmat_shared.js (clean base with pricing + cutoff + robust normalization)
(function(global){
  const CONFIG_KEY = 'overtidsmat_config_v1';

  function getDefaultConfig(){
    return {
      suppliers: [], // [{name, password, menu:[{item, price, subitems:[{name, price, extras:[{name, price}]}]}], drinks:[{name, price, variants:[{name, price, extras:[{name, price}]}]}]}]
      departments: [],
      deliveryPlaces: [],
      futureFormsOptions: [], // [{label,type,choices?}]
      menuLinks: [],
      cutoffWeekday: '13:00',
      cutoffWeekendOnFriday: '14:00',
      updated: new Date().toISOString()
    };
  }

  function saveConfig(cfg){ cfg.updated = new Date().toISOString(); localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }

  function loadConfig(){
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if(!raw){ const d = getDefaultConfig(); saveConfig(d); return d; }
      const cfg = JSON.parse(raw);
      normalize(cfg);
      return cfg;
    } catch(e){
      const d = getDefaultConfig(); saveConfig(d); return d;
    }
  }

  // Backward-compatible normalization from the clean (no-price) model
  function normalize(cfg){
    cfg.suppliers = Array.isArray(cfg.suppliers) ? cfg.suppliers : [];
    cfg.suppliers.forEach(s => {
      s.password = s.password || '';
      // MENU
      s.menu = Array.isArray(s.menu) ? s.menu : [];
      s.menu = s.menu.map(m => (typeof m === 'string') ? { item:m, price:0, subitems:[] } : ({ item:m.item, price:Number(m.price||0), subitems:Array.isArray(m.subitems)?m.subitems:[] }));
      s.menu.forEach(m => {
        m.subitems = m.subitems.map(si => (typeof si === 'string') ? { name:si, price:0, extras:[] } : ({ name:si.name, price:Number(si.price||0), extras:Array.isArray(si.extras)?si.extras:[] }));
        m.subitems.forEach(si => {
          si.extras = si.extras.map(ex => (typeof ex === 'string') ? { name:ex, price:0 } : ({ name:ex.name, price:Number(ex.price||0) }));
        });
      });
      // DRINKS
      s.drinks = Array.isArray(s.drinks) ? s.drinks : [];
      s.drinks = s.drinks.map(d => (typeof d === 'string') ? { name:d, price:0, variants:[] } : ({ name:d.name||d, price:Number(d.price||0), variants:Array.isArray(d.variants)?d.variants:[] }));
      s.drinks.forEach(d => {
        d.variants = d.variants.map(v => (typeof v === 'string') ? { name:v, price:0, extras:[] } : ({ name:v.name, price:Number(v.price||0), extras:Array.isArray(v.extras)?v.extras:[] }));
        d.variants.forEach(v => {
          v.extras = v.extras.map(ex => (typeof ex === 'string') ? { name:ex, price:0 } : ({ name:ex.name, price:Number(ex.price||0) }));
        });
      });
    });
    cfg.departments = Array.isArray(cfg.departments) ? cfg.departments : [];
    cfg.deliveryPlaces = Array.isArray(cfg.deliveryPlaces) ? cfg.deliveryPlaces : [];
    cfg.futureFormsOptions = Array.isArray(cfg.futureFormsOptions) ? cfg.futureFormsOptions : [];
    cfg.menuLinks = Array.isArray(cfg.menuLinks) ? cfg.menuLinks : [];
    if(typeof cfg.cutoffWeekday !== 'string') cfg.cutoffWeekday = '13:00';
    if(typeof cfg.cutoffWeekendOnFriday !== 'string') cfg.cutoffWeekendOnFriday = '14:00';
  }

  // Helpers
  function _findSupplier(cfg, name){
    return (cfg.suppliers||[]).find(s => String(s.name||'').toLowerCase() === String(name||'').toLowerCase());
  }

  // Suppliers
  function getSuppliers(cfg){ return (cfg.suppliers||[]).map(s => s.name||s); }
  function addSupplier(cfg,name){ const t=String(name||'').trim(); if(!t) throw new Error('Navn kan ikke være tomt.'); if(_findSupplier(cfg,t)) throw new Error('Leverandør finnes allerede.'); (cfg.suppliers=cfg.suppliers||[]).push({name:t,password:'',menu:[],drinks:[]}); saveConfig(cfg); }
  function renameSupplier(cfg,oldName,newName){ const s=_findSupplier(cfg,oldName); if(!s) throw new Error('Fant ikke leverandør.'); const t=String(newName||'').trim(); if(!t) throw new Error('Nytt navn kan ikke være tomt.'); if(_findSupplier(cfg,t) && t.toLowerCase()!==oldName.toLowerCase()) throw new Error('En annen leverandør med dette navnet finnes allerede.'); s.name=t; saveConfig(cfg); }
  function removeSupplier(cfg,name){ const before=(cfg.suppliers||[]).length; cfg.suppliers=(cfg.suppliers||[]).filter(s => String(s.name||'').toLowerCase()!==String(name||'').toLowerCase()); if(before===cfg.suppliers.length) throw new Error('Fant ikke leverandør.'); saveConfig(cfg); }
  function setSupplierPassword(cfg,name,pw){ const s=_findSupplier(cfg,name); if(!s) throw new Error('Fant ikke leverandør.'); s.password=String(pw||''); saveConfig(cfg); }
  function findSupplier(cfg,name){ return _findSupplier(cfg,name); }

  // MENU CRUD + pricing
  function _menuRef(cfg,supplierName,item){ const s=_findSupplier(cfg,supplierName); if(!s) return null; s.menu=s.menu||[]; return s.menu.find(x=>String(x.item||'').toLowerCase()===String(item||'').toLowerCase())||null; }
  function getMenuItems(cfg,supplierName){ const s=_findSupplier(cfg,supplierName); return s&&Array.isArray(s.menu)? s.menu.map(m=>m.item):[]; }
  function addMenuItem(cfg,supplierName,item){ const s=_findSupplier(cfg,supplierName); if(!s) throw new Error('Fant ikke leverandør.'); const t=String(item||'').trim(); if(!t) throw new Error('Menytekst kan ikke være tom.'); if((s.menu||[]).some(m=>String(m.item||'').toLowerCase()===t.toLowerCase())) throw new Error('Menyelement finnes allerede.'); (s.menu=s.menu||[]).push({item:t, price:0, subitems:[]}); saveConfig(cfg); }
  function removeMenuItem(cfg,supplierName,item){ const s=_findSupplier(cfg,supplierName); if(!s) throw new Error('Fant ikke leverandør.'); const before=(s.menu||[]).length; s.menu=(s.menu||[]).filter(m=>String(m.item||'').toLowerCase()!==String(item||'').toLowerCase()); if(before===s.menu.length) throw new Error('Fant ikke menyelement.'); saveConfig(cfg); }
  function getMenuItemPrice(cfg,supplierName,item){ const r=_menuRef(cfg,supplierName,item); return r?Number(r.price||0):0; }
  function setMenuItemPrice(cfg,supplierName,item,price){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); r.price=Number(price||0); saveConfig(cfg); }
  function getSubmenu(cfg,supplierName,item){ const r=_menuRef(cfg,supplierName,item); if(!r) return []; r.subitems=r.subitems||[]; return r.subitems.map(si=>typeof si==='string'?si:(si.name||'')); }
  function addSubmenuItem(cfg,supplierName,item,sub){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); const t=String(sub||'').trim(); if(!t) throw new Error('Under-valg kan ikke være tomt.'); r.subitems=r.subitems||[]; if(r.subitems.map(x=>typeof x==='string'?x:(x.name||'')).map(x=>x.toLowerCase()).includes(t.toLowerCase())) throw new Error('Under-valg finnes allerede.'); r.subitems.push({name:t, price:0, extras:[]}); saveConfig(cfg); }
  function removeSubmenuItem(cfg,supplierName,item,sub){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); const before=(r.subitems||[]).length; r.subitems=(r.subitems||[]).filter(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()!==String(sub||'').toLowerCase()); if(before===(r.subitems||[]).length) throw new Error('Fant ikke under-valg.'); saveConfig(cfg); }
  function getSubmenuItemPrice(cfg,supplierName,item,sub){ const r=_menuRef(cfg,supplierName,item); if(!r) return 0; const si=(r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); return si?Number(si.price||0):0; }
  function setSubmenuItemPrice(cfg,supplierName,item,sub,price){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); r.subitems=r.subitems||[]; const i=r.subitems.findIndex(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()===String(sub||'').toLowerCase()); if(i<0) throw new Error('Fant ikke under-valg.'); const obj=typeof r.subitems[i]==='string'?{name:r.subitems[i],price:0,extras:[]}:r.subitems[i]; obj.price=Number(price||0); r.subitems[i]=obj; saveConfig(cfg); }
  function getSubExtras(cfg,supplierName,item,sub){ const r=_menuRef(cfg,supplierName,item); if(!r) return []; const si=(r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); if(!si) return []; si.extras=si.extras||[]; return si.extras.map(ex=> typeof ex==='string'?ex:(ex.name||'')); }
  function addSubExtra(cfg,supplierName,item,sub,extra){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); const si=(r.subitems=r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); if(!si) throw new Error('Fant ikke under-valg.'); const t=String(extra||'').trim(); if(!t) throw new Error('Tillegg kan ikke være tomt.'); si.extras=si.extras||[]; if(si.extras.map(e=>(typeof e==='string'?e:e.name).toLowerCase()).includes(t.toLowerCase())) throw new Error('Tillegg finnes allerede.'); si.extras.push({name:t, price:0}); saveConfig(cfg); }
  function removeSubExtra(cfg,supplierName,item,sub,extra){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); const si=(r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); if(!si) throw new Error('Fant ikke under-valg.'); const before=(si.extras||[]).length; si.extras=(si.extras||[]).filter(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()!==String(extra||'').toLowerCase()); if(before===si.extras.length) throw new Error('Fant ikke tillegg.'); saveConfig(cfg); }
  function getSubExtraPrice(cfg,supplierName,item,sub,extra){ const r=_menuRef(cfg,supplierName,item); if(!r) return 0; const si=(r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); if(!si) return 0; const ex=(si.extras||[]).map(x=>typeof x==='string'?{name:x,price:0}:x).find(x=>String(x.name||'').toLowerCase()===String(extra||'').toLowerCase()); return ex?Number(ex.price||0):0; }
  function setSubExtraPrice(cfg,supplierName,item,sub,extra,price){ const r=_menuRef(cfg,supplierName,item); if(!r) throw new Error('Fant ikke menyelement.'); const si=(r.subitems=r.subitems||[]).map(x=>typeof x==='string'?{name:x,price:0,extras:[]}:x).find(x=>String(x.name||'').toLowerCase()===String(sub||'').toLowerCase()); if(!si) throw new Error('Fant ikke under-valg.'); si.extras=si.extras||[]; const idx=si.extras.findIndex(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()===String(extra||'').toLowerCase()); const obj= idx<0 ? {name:String(extra||''), price:Number(price||0)} : (typeof si.extras[idx]==='string'? {name:si.extras[idx], price:Number(price||0)}: {name:si.extras[idx].name, price:Number(price||0)});
      if(idx<0) si.extras.push(obj); else si.extras[idx]=obj; saveConfig(cfg); }

  // Drinks + pricing
  function _drinkRef(cfg,supplierName,drink){ const s=_findSupplier(cfg,supplierName); if(!s) return null; s.drinks=s.drinks||[]; return s.drinks.find(d=>String(d.name||'').toLowerCase()===String(drink||'').toLowerCase())||null; }
  function getDrinks(cfg,supplierName){ const s=_findSupplier(cfg,supplierName); return s&&Array.isArray(s.drinks)? s.drinks.map(d=>d.name):[]; }
  function addDrink(cfg,supplierName,drink){ const s=_findSupplier(cfg,supplierName); if(!s) throw new Error('Fant ikke leverandør.'); const t=String(drink||'').trim(); if(!t) throw new Error('Drikke kan ikke være tom.'); s.drinks=s.drinks||[]; if(s.drinks.some(d=>String(d.name||'').toLowerCase()===t.toLowerCase())) throw new Error('Drikke finnes allerede.'); s.drinks.push({name:t, price:0, variants:[]}); saveConfig(cfg); }
  function removeDrink(cfg,supplierName,drink){ const s=_findSupplier(cfg,supplierName); if(!s) throw new Error('Fant ikke leverandør.'); const before=(s.drinks||[]).length; s.drinks=(s.drinks||[]).filter(d=>String(d.name||'').toLowerCase()!==String(drink||'').toLowerCase()); if(before===s.drinks.length) throw new Error('Fant ikke drikke.'); saveConfig(cfg); }
  function getDrinkPrice(cfg,supplierName,drink){ const d=_drinkRef(cfg,supplierName,drink); return d?Number(d.price||0):0; }
  function setDrinkPrice(cfg,supplierName,drink,price){ const d=_drinkRef(cfg,supplierName,drink); if(!d) throw new Error('Fant ikke drikke.'); d.price=Number(price||0); saveConfig(cfg); }
  function getDrinkVariants(cfg,supplierName,drink){ const d=_drinkRef(cfg,supplierName,drink); return d&&Array.isArray(d.variants)? d.variants.map(v=>v.name):[]; }
  function addDrinkVariant(cfg,supplierName,drink,variant){ const d=_drinkRef(cfg,supplierName,drink); if(!d) throw new Error('Fant ikke drikke.'); const t=String(variant||'').trim(); if(!t) throw new Error('Variant kan ikke være tom.'); d.variants=d.variants||[]; if(d.variants.some(v=>String(v.name||'').toLowerCase()===t.toLowerCase())) throw new Error('Varianten finnes allerede.'); d.variants.push({name:t, price:0, extras:[]}); saveConfig(cfg); }
  function removeDrinkVariant(cfg,supplierName,drink,variant){ const d=_drinkRef(cfg,supplierName,drink); if(!d) throw new Error('Fant ikke drikke.'); const before=(d.variants||[]).length; d.variants=(d.variants||[]).filter(v=>String(v.name||'').toLowerCase()!==String(variant||'').toLowerCase()); if(before===(d.variants||[]).length) throw new Error('Fant ikke variant.'); saveConfig(cfg); }
  function getDrinkVariantPrice(cfg,supplierName,drink,variant){ const v=_variantRef(cfg,supplierName,drink,variant); return v?Number(v.price||0):0; }
  function setDrinkVariantPrice(cfg,supplierName,drink,variant,price){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) throw new Error('Fant ikke variant.'); v.price=Number(price||0); saveConfig(cfg); }
  function _variantRef(cfg,supplierName,drink,variant){ const d=_drinkRef(cfg,supplierName,drink); if(!d) return null; d.variants=d.variants||[]; return d.variants.find(v=>String(v.name||'').toLowerCase()===String(variant||'').toLowerCase())||null; }
  function getDrinkExtras(cfg,supplierName,drink,variant){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) return []; v.extras=v.extras||[]; return v.extras.map(x=> typeof x==='string'? x : (x.name||'')); }
  function addDrinkExtra(cfg,supplierName,drink,variant,extra){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) throw new Error('Fant ikke variant.'); const t=String(extra||'').trim(); if(!t) throw new Error('Tillegg kan ikke være tomt.'); v.extras=v.extras||[]; if(v.extras.map(e=> (typeof e==='string'? e : e.name).toLowerCase()).includes(t.toLowerCase())) throw new Error('Tillegg finnes allerede.'); v.extras.push({name:t, price:0}); saveConfig(cfg); }
  function removeDrinkExtra(cfg,supplierName,drink,variant,extra){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) throw new Error('Fant ikke variant.'); const before=(v.extras||[]).length; v.extras=(v.extras||[]).filter(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()!==String(extra||'').toLowerCase()); if(before===(v.extras||[]).length) throw new Error('Fant ikke tillegg.'); saveConfig(cfg); }
  function getDrinkExtraPrice(cfg,supplierName,drink,variant,extra){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) return 0; const ex=(v.extras||[]).map(x=>typeof x==='string'?{name:x,price:0}:x).find(x=>String(x.name||'').toLowerCase()===String(extra||'').toLowerCase()); return ex?Number(ex.price||0):0; }
  function setDrinkExtraPrice(cfg,supplierName,drink,variant,extra,price){ const v=_variantRef(cfg,supplierName,drink,variant); if(!v) throw new Error('Fant ikke variant.'); v.extras=v.extras||[]; const idx=v.extras.findIndex(x=>String((typeof x==='string'?x:(x.name||''))).toLowerCase()===String(extra||'').toLowerCase()); const obj= idx<0 ? {name:String(extra||''), price:Number(price||0)} : (typeof v.extras[idx]==='string'? {name:v.extras[idx], price:Number(price||0)}: {name:v.extras[idx].name, price:Number(price||0)});
      if(idx<0) v.extras.push(obj); else v.extras[idx]=obj; saveConfig(cfg); }

  // Departments / Places / Future / Links
  function getDepartments(cfg){ return (cfg.departments||[]).slice(); }
  function addDepartment(cfg,name){ const t=String(name||'').trim(); if(!t) throw new Error('Avdelingsnavn kan ikke være tomt.'); if((cfg.departments||[]).map(x=>x.toLowerCase()).includes(t.toLowerCase())) throw new Error('Avdeling finnes allerede.'); (cfg.departments=cfg.departments||[]).push(t); saveConfig(cfg); }
  function removeDepartment(cfg,name){ const before=(cfg.departments||[]).length; cfg.departments=(cfg.departments||[]).filter(x=>x.toLowerCase()!==String(name).toLowerCase()); if((cfg.departments||[]).length===before) throw new Error('Fant ikke avdeling.'); saveConfig(cfg); }
  function getDeliveryPlaces(cfg){ return (cfg.deliveryPlaces||[]).slice(); }
  function addDeliveryPlace(cfg, place){ const t=String(place||'').trim(); if(!t) throw new Error('Sted kan ikke være tomt.'); if((cfg.deliveryPlaces||[]).map(p=>p.toLowerCase()).includes(t.toLowerCase())) throw new Error('Sted finnes allerede.'); (cfg.deliveryPlaces=cfg.deliveryPlaces||[]).push(t); saveConfig(cfg); }
  function removeDeliveryPlace(cfg, place){ const before=(cfg.deliveryPlaces||[]).length; cfg.deliveryPlaces = (cfg.deliveryPlaces||[]).filter(p=>p.toLowerCase()!==String(place).toLowerCase()); if((cfg.deliveryPlaces||[]).length===before) throw new Error('Fant ikke sted.'); saveConfig(cfg); }
  function getFutureOptions(cfg){ return (cfg.futureFormsOptions||[]).slice(); }
  function addFutureOption(cfg,label,type){ const l=String(label||'').trim(); if(!l) throw new Error('Label kan ikke være tom.'); if(!['text','dropdown','date'].includes(type)) throw new Error('Ugyldig type.'); const obj={label:l,type:type}; if(type==='dropdown') obj.choices=[]; (cfg.futureFormsOptions=cfg.futureFormsOptions||[]).push(obj); saveConfig(cfg); }
  function removeFutureOption(cfg,label){ const before=(cfg.futureFormsOptions||[]).length; cfg.futureFormsOptions = (cfg.futureFormsOptions||[]).filter(o=>String(o.label||'').toLowerCase()!==String(label).toLowerCase()); if((cfg.futureFormsOptions||[]).length===before) throw new Error('Fant ikke valg.'); saveConfig(cfg); }
  function moveFutureOption(cfg,label,dir){ const arr=cfg.futureFormsOptions||[]; const i=arr.findIndex(x=>String(x.label||'').toLowerCase()===String(label||'').toLowerCase()); if(i<0) throw new Error('Fant ikke felt.'); const j=i+(dir<0?-1:1); if(j<0 || j>=arr.length) return; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; saveConfig(cfg); }
  function moveDropdownChoice(cfg,label,choice,dir){ const f=(cfg.futureFormsOptions||[]).find(o=>String(o.label||'').toLowerCase()===String(label||'').toLowerCase()); if(!f||f.type!=='dropdown') throw new Error('Feltet finnes ikke eller er ikke dropdown.'); const arr=f.choices||[]; const i=arr.findIndex(c=>c.toLowerCase()===String(choice).toLowerCase()); if(i<0) throw new Error('Fant ikke valg.'); const j=i+(dir<0?-1:1); if(j<0 || j>=arr.length) return; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; saveConfig(cfg); }
  function addDropdownChoice(cfg,label,choice){ const f=(cfg.futureFormsOptions||[]).find(o=>String(o.label||'').toLowerCase()===String(label||'').toLowerCase()); if(!f||f.type!=='dropdown') throw new Error('Feltet finnes ikke eller er ikke dropdown.'); const t=String(choice||'').trim(); if(!t) throw new Error('Valg kan ikke være tomt.'); f.choices=f.choices||[]; if(f.choices.map(c=>c.toLowerCase()).includes(t.toLowerCase())) throw new Error('Valget finnes allerede.'); f.choices.push(t); saveConfig(cfg); }
  function removeDropdownChoice(cfg,label,choice){ const f=(cfg.futureFormsOptions||[]).find(o=>String(o.label||'').toLowerCase()===String(label||'').toLowerCase()); if(!f||f.type!=='dropdown') throw new Error('Feltet finnes ikke eller er ikke dropdown.'); const before=(f.choices||[]).length; f.choices=(f.choices||[]).filter(c=>c.toLowerCase()!==String(choice).toLowerCase()); if((f.choices||[]).length===before) throw new Error('Fant ikke valg.'); saveConfig(cfg); }

  // Links
  function getMenuLinks(cfg){ return (cfg.menuLinks||[]).slice(); }
  function addMenuLink(cfg,label,url){ const l=String(label||'').trim(); const u=String(url||'').trim(); if(!l) throw new Error('Tittel kan ikke være tom.'); if(!u) throw new Error('URL kan ikke være tom.'); if((cfg.menuLinks||[]).some(x=>String(x.label||'').toLowerCase()===l.toLowerCase())) throw new Error('En lenke med samme tittel finnes allerede.'); (cfg.menuLinks=cfg.menuLinks||[]).push({label:l,url:u}); saveConfig(cfg); }
  function removeMenuLink(cfg,label){ const before=(cfg.menuLinks||[]).length; cfg.menuLinks=(cfg.menuLinks||[]).filter(x=>String(x.label||'').toLowerCase()!==String(label||'').toLowerCase()); if(before===(cfg.menuLinks||[]).length) throw new Error('Fant ikke lenke.'); saveConfig(cfg); }
  function moveMenuLink(cfg,label,dir){ const arr=cfg.menuLinks||[]; const i=arr.findIndex(x=>String(x.label||'').toLowerCase()===String(label||'').toLowerCase()); if(i<0) throw new Error('Fant ikke lenke.'); const j=i+(dir<0?-1:1); if(j<0 || j>=arr.length) return; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; saveConfig(cfg); }

  // Cutoff
  function getCutoffSettings(cfg){ return { weekday: cfg.cutoffWeekday||'13:00', weekendFri: cfg.cutoffWeekendOnFriday||'14:00' }; }
  function setCutoffSettings(cfg, weekday, weekendFri){ const w=String(weekday||'').trim(); const f=String(weekendFri||'').trim(); if(!/^\d{1,2}:\d{2}$/.test(w)) throw new Error('Ugyldig hverdagstid (HH:MM).'); if(!/^\d{1,2}:\d{2}$/.test(f)) throw new Error('Ugyldig helgetid (HH:MM).'); cfg.cutoffWeekday=w; cfg.cutoffWeekendOnFriday=f; saveConfig(cfg); }

  // Expose API
  global.OvertidsmatConfig = {
    CONFIG_KEY, getDefaultConfig, loadConfig, saveConfig,
    // suppliers
    getSuppliers, addSupplier, renameSupplier, removeSupplier, setSupplierPassword, findSupplier,
    // menu & pricing
    getMenuItems, addMenuItem, removeMenuItem, getMenuItemPrice, setMenuItemPrice,
    getSubmenu, addSubmenuItem, removeSubmenuItem, getSubmenuItemPrice, setSubmenuItemPrice,
    getSubExtras, addSubExtra, removeSubExtra, getSubExtraPrice, setSubExtraPrice,
    // drinks & pricing
    getDrinks, addDrink, removeDrink, getDrinkPrice, setDrinkPrice,
    getDrinkVariants, addDrinkVariant, removeDrinkVariant, getDrinkVariantPrice, setDrinkVariantPrice,
    getDrinkExtras, addDrinkExtra, removeDrinkExtra, getDrinkExtraPrice, setDrinkExtraPrice,
    // depts/places/future/links
    getDepartments, addDepartment, removeDepartment,
    getDeliveryPlaces, addDeliveryPlace, removeDeliveryPlace,
    getFutureOptions, addFutureOption, removeFutureOption, moveFutureOption, addDropdownChoice, removeDropdownChoice, moveDropdownChoice,
    getMenuLinks, addMenuLink, removeMenuLink, moveMenuLink,
    // cutoff
    getCutoffSettings, setCutoffSettings
  };
})(window);
