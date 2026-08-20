function escapeAttr(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function dotsHTML(value, max){
  max = max || 5;
  let out = '<div class="dots">';
  for(let i=1;i<=max;i++){
    out += '<span class="dot' + (i<=value ? ' filled' : '') + '"></span>';
  }
  out += '</div>';
  return out;
}

function renderStats(id, obj, max){
  const el = document.getElementById(id);
  let html = '';
  for(const [name, val] of Object.entries(obj)){
    const zero = val === 0 ? ' zero' : '';
    html += '<div class="stat-row' + zero + '"><span class="name">' + name + '</span><span class="leader"></span>' + dotsHTML(val, max) + '</div>';
  }
  el.innerHTML = html;
}

function renderMeter(id, value, max){
  const el = document.getElementById(id);
  let html = '';
  for(let i=1;i<=max;i++){
    html += '<span class="pip' + (i<=value ? ' filled' : '') + '"></span>';
  }
  el.innerHTML = html;
}

function renderList(id, items, descriptions){
  const el = document.getElementById(id);
  let html = '';
  for(const item of items){
    const desc = descriptions && descriptions[item.name];
    const tipAttr = desc ? ' data-tooltip="' + escapeAttr(desc) + '"' : '';
    html += '<div class="list-row"' + tipAttr + '><span class="name">' + item.name + '</span><span class="pts">' + item.pts + '</span></div>';
  }
  el.innerHTML = html;
}

function text(id, value){ document.getElementById(id).textContent = value; }

function renderProse(id, value, placeholder){
  const el = document.getElementById(id);
  if(value && String(value).trim()){
    el.textContent = value;
    el.classList.remove('empty-state');
  } else {
    el.textContent = placeholder;
    el.classList.add('empty-state');
  }
}

function renderContacts(id, items){
  const el = document.getElementById(id);
  if(!items || !items.length){
    el.innerHTML = '<div class="empty-state">No contacts recorded yet.</div>';
    return;
  }
  let html = '';
  for(const c of items){
    html += '<div class="panel contact-card"><div class="cname">' + c.name + '</div>' +
      (c.role ? '<div class="crole">' + c.role + '</div>' : '') +
      (c.notes ? '<div class="cnotes">' + c.notes + '</div>' : '') +
      '</div>';
  }
  el.innerHTML = html;
}

function renderInventory(id, items){
  const el = document.getElementById(id);
  if(!items || !items.length){
    el.innerHTML = '<div class="empty-state">No possessions recorded yet.</div>';
    return;
  }
  let html = '';
  for(const it of items){
    html += '<div class="inv-item"><div class="iname">' + it.name + '</div>' +
      (it.notes ? '<div class="inotes">' + it.notes + '</div>' : '') +
      '</div>';
  }
  el.innerHTML = html;
}

function renderHavenIdentity(id, haven){
  const el = document.getElementById(id);
  const rows = [['Name', haven.name], ['Location', haven.location], ['Security', haven.security]]
    .filter(([, v]) => v && String(v).trim());
  if(!rows.length){ el.style.display = 'none'; return; }
  let html = '';
  for(const [k, v] of rows){
    html += '<div class="id-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }
  el.innerHTML = html;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

Promise.all([
  fetch('data.json').then(res => res.json()),
  fetch('traits.json').then(res => res.json()).catch(() => ({ merits: {}, flaws: {} }))
])
  .then(([data, traits]) => {
    document.title = data.name + ' — Character Sheet';

    text('hero-clan-tag', data.clanTag);
    text('hero-name', data.name);
    text('hero-quote', data.quote);
    text('hero-predator', data.predatorType);
    text('hero-clan', data.clan);
    text('hero-generation', data.generation);
    text('hero-sire', data.sire);

    text('ambition-text', data.ambition);
    text('desire-text', data.desire);

    renderStats('attr-physical', data.attributes.physical, 5);
    renderStats('attr-social', data.attributes.social, 5);
    renderStats('attr-mental', data.attributes.mental, 5);

    renderStats('skill-talents', data.skills.talents, 5);
    renderStats('skill-skills', data.skills.skills, 5);
    renderStats('skill-knowledges', data.skills.knowledges, 5);

    renderStats('disciplines', data.disciplines, 5);
    renderStats('virtues', data.virtues, 5);

    text('willpower-label', data.willpower.value + ' / ' + data.willpower.max);
    text('humanity-label', data.humanity.value + ' / ' + data.humanity.max);
    renderMeter('meter-willpower', data.willpower.value, data.willpower.max);
    renderMeter('meter-humanity', data.humanity.value, data.humanity.max);

    text('merits-points', data.meritsPoints);
    text('flaws-points', data.flawsPoints);
    renderList('merits', data.merits, traits.merits);
    renderList('flaws', data.flaws, traits.flaws);
    renderList('backgrounds', data.backgrounds);

    renderInventory('inventory-list', data.inventory);

    renderHavenIdentity('haven-identity', data.haven || {});
    renderProse('haven-description', data.haven && data.haven.description, 'No haven description recorded yet.');
  })
  .catch(err => {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="position:fixed;top:0;left:0;right:0;background:#5e0d17;color:#fff;padding:10px 16px;font-family:sans-serif;font-size:14px;z-index:9999;">' +
      'Could not load data.json (' + err.message + '). If you opened this file directly (file://), browsers block local fetch — serve the folder with a local server instead, e.g. <code>python -m http.server</code> or the VS Code Live Server extension.' +
      '</div>');
    console.error(err);
  });

let bioChapters = [];
let bioIndex = 0;

function renderBioNav(){
  const nav = document.getElementById('bio-chapter-nav');
  nav.innerHTML = '';
  bioChapters.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.textContent = 'Ch. ' + ch.number;
    btn.addEventListener('click', () => { bioIndex = i; renderBioChapter(); });
    nav.appendChild(btn);
  });
}

function renderBioChapter(){
  const ch = bioChapters[bioIndex];
  if(!ch) return;
  text('bio-chapter-num', 'Chapter ' + ch.number);
  text('bio-chapter-title', ch.title);
  document.getElementById('bio-chapter-body').innerHTML =
    ch.paragraphs.map(p => '<p>' + p + '</p>').join('');
  text('bio-page-indicator', (bioIndex + 1) + ' / ' + bioChapters.length);
  document.getElementById('bio-prev').disabled = bioIndex === 0;
  document.getElementById('bio-next').disabled = bioIndex === bioChapters.length - 1;
  document.querySelectorAll('#bio-chapter-nav button').forEach((b, i) => b.classList.toggle('active', i === bioIndex));
}

document.getElementById('bio-prev').addEventListener('click', () => {
  if(bioIndex > 0){ bioIndex--; renderBioChapter(); }
});
document.getElementById('bio-next').addEventListener('click', () => {
  if(bioIndex < bioChapters.length - 1){ bioIndex++; renderBioChapter(); }
});

fetch('bio.json')
  .then(res => res.json())
  .then(bio => {
    bioChapters = bio.chapters || [];
    renderBioNav();
    renderBioChapter();
  })
  .catch(err => {
    document.querySelector('#tab-bio .bio-reader').innerHTML =
      '<div class="empty-state">Could not load bio.json.</div>';
    console.error(err);
  });

fetch('contacts.json')
  .then(res => res.json())
  .then(data => renderContacts('contacts-grid', data.contacts))
  .catch(err => {
    document.getElementById('contacts-grid').innerHTML =
      '<div class="empty-state">Could not load contacts.json.</div>';
    console.error(err);
  });
