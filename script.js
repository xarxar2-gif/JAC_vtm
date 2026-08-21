function escapeAttr(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getByPath(obj, path){
  return path.reduce((o, k) => o[k], obj);
}

function clampInt(v, min){
  const n = parseInt(v, 10);
  return isNaN(n) ? min : Math.max(min, n);
}

let editing = false;
let traits = { merits: {}, flaws: {} };
let bioIndex = 0;

// Some browsers don't reliably blur a focused editable field before a click
// elsewhere fires (e.g. clicking a button in Safari/Firefox). Force it on
// mousedown so an in-progress edit's blur-to-save handler always runs before
// whatever the click triggers (switching characters, deleting a row, etc.).
document.addEventListener('mousedown', e => {
  const ae = document.activeElement;
  if(ae && ae !== document.body && ae !== e.target && !ae.contains(e.target) &&
     (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')){
    ae.blur();
  }
}, true);

function dotsHTML(value, max){
  max = max || 5;
  let out = '<div class="dots">';
  for(let i = 1; i <= max; i++){
    out += '<span class="dot' + (i <= value ? ' filled' : '') + '" data-i="' + i + '"></span>';
  }
  out += '</div>';
  return out;
}

/**
 * path: property path into the active character (e.g. ['attributes','physical']) or null for read-only.
 * extensible: whether rows can be freely added/removed (true for Disciplines; false for the
 * fixed-name attribute/skill/virtue trait lists).
 */
function renderStats(id, obj, max, path, extensible){
  const el = document.getElementById(id);
  let html = '';
  for(const [name, val] of Object.entries(obj)){
    const zero = val === 0 ? ' zero' : '';
    html += '<div class="stat-row' + zero + '" data-name="' + escapeAttr(name) + '">' +
      '<span class="name">' + name + '</span><span class="leader"></span>' +
      dotsHTML(val, max) +
      (path && extensible ? '<button type="button" class="row-remove" title="Remove">&times;</button>' : '') +
      '</div>';
  }
  if(path && extensible){
    html += '<div class="add-row"><input type="text" class="add-input" placeholder="Add discipline…"></div>';
  }
  el.innerHTML = html;

  if(!path) return;

  el.querySelectorAll('.stat-row').forEach(row => {
    const name = row.dataset.name;
    row.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const i = parseInt(dot.dataset.i, 10);
        const current = getByPath(Store.getActive(), path)[name];
        const next = current === i ? i - 1 : i;
        Store.update(c => { getByPath(c, path)[name] = next; });
        render();
      });
    });
    const removeBtn = row.querySelector('.row-remove');
    if(removeBtn) removeBtn.addEventListener('click', () => {
      Store.update(c => { delete getByPath(c, path)[name]; });
      render();
    });
  });

  const addInput = el.querySelector('.add-input');
  if(addInput){
    addInput.addEventListener('keydown', e => {
      if(e.key === 'Enter' && addInput.value.trim()){
        const name = addInput.value.trim();
        Store.update(c => { getByPath(c, path)[name] = 1; });
        render();
      }
    });
  }
}

function bindMeter(labelId, pipId, obj, path){
  renderMeterLabel(labelId, obj, path);
  renderMeter(pipId, obj.value, obj.max, path);
}

function renderMeterLabel(id, obj, path){
  const el = document.getElementById(id);
  if(el.contains(document.activeElement)) return;
  if(path){
    el.innerHTML = '<input type="number" min="0" class="meter-input meter-value" value="' + obj.value + '"> / ' +
      '<input type="number" min="1" class="meter-input meter-max" value="' + obj.max + '">';
    const valInput = el.querySelector('.meter-value');
    const maxInput = el.querySelector('.meter-max');
    valInput.onchange = () => Store.update(c => { getByPath(c, path).value = clampInt(valInput.value, 0); });
    maxInput.onchange = () => Store.update(c => { getByPath(c, path).max = clampInt(maxInput.value, 1); });
  } else {
    el.textContent = obj.value + ' / ' + obj.max;
  }
}

function renderMeter(id, value, max, path){
  const el = document.getElementById(id);
  let html = '';
  for(let i = 1; i <= max; i++){
    html += '<span class="pip' + (i <= value ? ' filled' : '') + '" data-i="' + i + '"></span>';
  }
  el.innerHTML = html;
  if(!path) return;
  el.querySelectorAll('.pip').forEach(pip => {
    pip.addEventListener('click', () => {
      const i = parseInt(pip.dataset.i, 10);
      const current = getByPath(Store.getActive(), path).value;
      const next = current === i ? i - 1 : i;
      Store.update(c => { getByPath(c, path).value = next; });
      render();
    });
  });
}

function renderList(id, items, path, descriptions){
  const el = document.getElementById(id);
  let html = '';
  items.forEach((item, i) => {
    if(path){
      html += '<div class="list-row editable-row" data-i="' + i + '">' +
        '<span class="name" contenteditable="true" data-field="name">' + escapeAttr(item.name || '') + '</span>' +
        '<span class="pts" contenteditable="true" data-field="pts">' + escapeAttr(item.pts || '') + '</span>' +
        '<button type="button" class="row-remove" title="Remove">&times;</button>' +
        '</div>';
    } else {
      const desc = descriptions && descriptions[item.name];
      const tipAttr = desc ? ' data-tooltip="' + escapeAttr(desc) + '"' : '';
      html += '<div class="list-row"' + tipAttr + '><span class="name">' + item.name + '</span><span class="pts">' + (item.pts || '') + '</span></div>';
    }
  });
  if(path){
    html += '<div class="add-row"><input type="text" class="add-name" placeholder="Name"><input type="text" class="add-pts" placeholder="pts"><button type="button" class="row-add">+ Add</button></div>';
  }
  el.innerHTML = html;

  if(!path) return;

  el.querySelectorAll('.editable-row').forEach(row => {
    const i = parseInt(row.dataset.i, 10);
    row.querySelectorAll('[contenteditable]').forEach(span => {
      span.addEventListener('blur', () => {
        Store.update(c => { getByPath(c, path)[i][span.dataset.field] = span.textContent.trim(); });
      });
    });
    row.querySelector('.row-remove').addEventListener('click', () => {
      Store.update(c => { getByPath(c, path).splice(i, 1); });
      render();
    });
  });
  const addBtn = el.querySelector('.row-add');
  addBtn.addEventListener('click', () => {
    const nameInput = el.querySelector('.add-name');
    const ptsInput = el.querySelector('.add-pts');
    if(!nameInput.value.trim()) return;
    Store.update(c => { getByPath(c, path).push({ name: nameInput.value.trim(), pts: ptsInput.value.trim() }); });
    render();
  });
}

function bindText(id, value, onSave, placeholder){
  const el = document.getElementById(id);
  if(document.activeElement === el) return;
  if(onSave){
    el.textContent = value || '';
    el.contentEditable = 'true';
    el.classList.add('editable');
    el.classList.remove('empty-state');
    el.onblur = () => onSave(el.textContent.trim());
  } else {
    el.contentEditable = 'false';
    el.classList.remove('editable');
    el.onblur = null;
    if(placeholder !== undefined){
      if(value && String(value).trim()){ el.textContent = value; el.classList.remove('empty-state'); }
      else { el.textContent = placeholder; el.classList.add('empty-state'); }
    } else {
      el.textContent = value || '';
    }
  }
}

function renderContacts(id, items, path){
  const el = document.getElementById(id);
  if(editing){
    let html = items.map((c, i) =>
      '<div class="panel contact-card editable-row" data-i="' + i + '">' +
        '<input type="text" class="cf-name" placeholder="Name" value="' + escapeAttr(c.name || '') + '">' +
        '<input type="text" class="cf-role" placeholder="Role" value="' + escapeAttr(c.role || '') + '">' +
        '<textarea class="cf-notes" placeholder="Notes">' + escapeAttr(c.notes || '') + '</textarea>' +
        '<button type="button" class="row-remove">Remove</button>' +
      '</div>'
    ).join('');
    html += '<div class="panel contact-card add-card"><button type="button" class="row-add" id="contact-add-btn">+ New Contact</button></div>';
    el.innerHTML = html;
    el.querySelectorAll('.editable-row').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('.cf-name').onblur = e => Store.update(c => { getByPath(c, path)[i].name = e.target.value.trim(); });
      row.querySelector('.cf-role').onblur = e => Store.update(c => { getByPath(c, path)[i].role = e.target.value.trim(); });
      row.querySelector('.cf-notes').onblur = e => Store.update(c => { getByPath(c, path)[i].notes = e.target.value.trim(); });
      row.querySelector('.row-remove').addEventListener('click', () => {
        Store.update(c => { getByPath(c, path).splice(i, 1); });
        render();
      });
    });
    document.getElementById('contact-add-btn').addEventListener('click', () => {
      Store.update(c => { getByPath(c, path).push({ name: 'New Contact', role: '', notes: '' }); });
      render();
    });
    return;
  }
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

function renderInventory(id, items, path){
  const el = document.getElementById(id);
  if(editing){
    let html = items.map((it, i) =>
      '<div class="inv-item editable-row" data-i="' + i + '">' +
        '<input type="text" class="if-name" placeholder="Item name" value="' + escapeAttr(it.name || '') + '">' +
        '<textarea class="if-notes" placeholder="Notes">' + escapeAttr(it.notes || '') + '</textarea>' +
        '<button type="button" class="row-remove">Remove</button>' +
      '</div>'
    ).join('');
    html += '<button type="button" class="row-add" id="inventory-add-btn">+ New Item</button>';
    el.innerHTML = html;
    el.querySelectorAll('.editable-row').forEach(row => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('.if-name').onblur = e => Store.update(c => { getByPath(c, path)[i].name = e.target.value.trim(); });
      row.querySelector('.if-notes').onblur = e => Store.update(c => { getByPath(c, path)[i].notes = e.target.value.trim(); });
      row.querySelector('.row-remove').addEventListener('click', () => {
        Store.update(c => { getByPath(c, path).splice(i, 1); });
        render();
      });
    });
    document.getElementById('inventory-add-btn').addEventListener('click', () => {
      Store.update(c => { getByPath(c, path).push({ name: 'New Item', notes: '' }); });
      render();
    });
    return;
  }
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

function renderHavenIdentity(id, haven, path){
  const el = document.getElementById(id);
  if(editing){
    el.style.display = '';
    const fields = [['name', 'Name'], ['location', 'Location'], ['security', 'Security']];
    el.innerHTML = fields.map(([k, label]) =>
      '<div class="id-cell"><div class="k">' + label + '</div>' +
      '<input type="text" class="haven-field" data-key="' + k + '" value="' + escapeAttr(haven[k] || '') + '"></div>'
    ).join('');
    el.querySelectorAll('.haven-field').forEach(inp => {
      inp.onblur = () => Store.update(c => { getByPath(c, path)[inp.dataset.key] = inp.value.trim(); });
    });
    return;
  }
  const rows = [['Name', haven.name], ['Location', haven.location], ['Security', haven.security]]
    .filter(([, v]) => v && String(v).trim());
  if(!rows.length){ el.style.display = 'none'; return; }
  el.style.display = '';
  let html = '';
  for(const [k, v] of rows){
    html += '<div class="id-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }
  el.innerHTML = html;
}

function renderToolbar(){
  const data = Store.getActive();
  const sel = document.getElementById('character-select');
  if(!(sel.contains(document.activeElement))){
    const chars = Store.listCharacters();
    sel.innerHTML = chars.map(c => '<option value="' + c.id + '"' + (c.id === data.id ? ' selected' : '') + '>' + escapeAttr(c.name) + '</option>').join('') +
      '<option value="__new__">+ New Character…</option>';
  }

  const editBtn = document.getElementById('edit-toggle');
  editBtn.textContent = editing ? 'Done Editing' : 'Edit';
  editBtn.classList.toggle('active', editing);

  document.getElementById('delete-char-btn').style.display = Store.listCharacters().length > 1 ? '' : 'none';

  const portraitBtn = document.getElementById('portrait-change-btn');
  if(portraitBtn) portraitBtn.style.display = editing ? '' : 'none';
}

function render(){
  const data = Store.getActive();
  if(!data) return;
  document.title = data.name + ' — Character Sheet';
  document.body.classList.toggle('editing', editing);

  renderToolbar();

  const heroImg = document.querySelector('.hero-img');
  if(data.portraitUrl){
    heroImg.style.backgroundImage = "url('" + data.portraitUrl.replace(/'/g, "\\'") + "')";
  } else {
    heroImg.style.backgroundImage = '';
  }

  bindText('hero-clan-tag', data.clanTag, editing ? (v => Store.update(c => { c.clanTag = v; })) : null);
  bindText('hero-name', data.name, editing ? (v => Store.update(c => { c.name = v; })) : null);
  bindText('hero-quote', data.quote, editing ? (v => Store.update(c => { c.quote = v; })) : null);
  bindText('hero-predator', data.predatorType, editing ? (v => Store.update(c => { c.predatorType = v; })) : null);
  bindText('hero-clan', data.clan, editing ? (v => Store.update(c => { c.clan = v; })) : null);
  bindText('hero-generation', data.generation, editing ? (v => Store.update(c => { c.generation = v; })) : null);
  bindText('hero-sire', data.sire, editing ? (v => Store.update(c => { c.sire = v; })) : null);

  bindText('ambition-text', data.ambition, editing ? (v => Store.update(c => { c.ambition = v; })) : null, 'No ambition recorded yet.');
  bindText('desire-text', data.desire, editing ? (v => Store.update(c => { c.desire = v; })) : null, 'No desire recorded yet.');

  renderStats('attr-physical', data.attributes.physical, 5, editing ? ['attributes', 'physical'] : null, false);
  renderStats('attr-social', data.attributes.social, 5, editing ? ['attributes', 'social'] : null, false);
  renderStats('attr-mental', data.attributes.mental, 5, editing ? ['attributes', 'mental'] : null, false);

  renderStats('skill-talents', data.skills.talents, 5, editing ? ['skills', 'talents'] : null, false);
  renderStats('skill-skills', data.skills.skills, 5, editing ? ['skills', 'skills'] : null, false);
  renderStats('skill-knowledges', data.skills.knowledges, 5, editing ? ['skills', 'knowledges'] : null, false);

  renderStats('disciplines', data.disciplines, 5, editing ? ['disciplines'] : null, true);
  renderStats('virtues', data.virtues, 5, editing ? ['virtues'] : null, false);

  bindMeter('willpower-label', 'meter-willpower', data.willpower, editing ? ['willpower'] : null);
  bindMeter('humanity-label', 'meter-humanity', data.humanity, editing ? ['humanity'] : null);

  bindText('merits-points', data.meritsPoints, editing ? (v => Store.update(c => { c.meritsPoints = v; })) : null);
  bindText('flaws-points', data.flawsPoints, editing ? (v => Store.update(c => { c.flawsPoints = v; })) : null);
  renderList('merits', data.merits, editing ? ['merits'] : null, traits.merits);
  renderList('flaws', data.flaws, editing ? ['flaws'] : null, traits.flaws);
  renderList('backgrounds', data.backgrounds, editing ? ['backgrounds'] : null);

  renderContacts('contacts-grid', data.contacts, ['contacts']);
  renderInventory('inventory-list', data.inventory, ['inventory']);

  renderHavenIdentity('haven-identity', data.haven || {}, ['haven']);
  bindText('haven-description', data.haven && data.haven.description, editing ? (v => Store.update(c => { c.haven.description = v; })) : null, 'No haven description recorded yet.');

  if(bioIndex >= data.bio.chapters.length) bioIndex = Math.max(0, data.bio.chapters.length - 1);
  renderBioNav();
  renderBioChapter();
}

function renderBioNav(){
  const nav = document.getElementById('bio-chapter-nav');
  const chapters = Store.getActive().bio.chapters;
  let html = chapters.map((ch, i) => '<button type="button" data-i="' + i + '">Ch. ' + escapeAttr(ch.number) + '</button>').join('');
  if(editing) html += '<button type="button" id="bio-add-chapter" class="row-add">+ Chapter</button>';
  nav.innerHTML = html;

  nav.querySelectorAll('button[data-i]').forEach(b => {
    b.addEventListener('click', () => {
      bioIndex = parseInt(b.dataset.i, 10);
      renderBioChapter();
    });
  });
  const addBtn = document.getElementById('bio-add-chapter');
  if(addBtn) addBtn.addEventListener('click', () => {
    Store.update(c => {
      c.bio.chapters.push({ number: String(c.bio.chapters.length + 1), title: 'New Chapter', paragraphs: [''] });
    });
    bioIndex = Store.getActive().bio.chapters.length - 1;
    render();
  });

  syncBioNavActive();
}

function syncBioNavActive(){
  document.querySelectorAll('#bio-chapter-nav button[data-i]').forEach((b, i) => b.classList.toggle('active', i === bioIndex));
}

function renderBioChapter(){
  const chapters = Store.getActive().bio.chapters;
  const ch = chapters[bioIndex];
  const numEl = document.getElementById('bio-chapter-num');
  const titleEl = document.getElementById('bio-chapter-title');
  const bodyEl = document.getElementById('bio-chapter-body');

  if(!ch){
    numEl.textContent = '';
    titleEl.textContent = '';
    titleEl.contentEditable = 'false';
    titleEl.onblur = null;
    bodyEl.innerHTML = '<div class="empty-state">No chapters yet.</div>';
    document.getElementById('bio-prev').disabled = true;
    document.getElementById('bio-next').disabled = true;
    document.getElementById('bio-page-indicator').textContent = '0 / 0';
    return;
  }

  numEl.textContent = 'Chapter ' + ch.number;

  if(editing){
    if(document.activeElement !== titleEl){
      titleEl.textContent = ch.title;
    }
    titleEl.contentEditable = 'true';
    titleEl.onblur = () => Store.update(c => { c.bio.chapters[bioIndex].title = titleEl.textContent.trim(); });

    if(!bodyEl.contains(document.activeElement)){
      bodyEl.innerHTML = '<textarea class="bio-edit-textarea">' + escapeAttr(ch.paragraphs.join('\n\n')) + '</textarea>' +
        '<button type="button" class="row-remove bio-remove-chapter">Delete Chapter</button>';
      const ta = bodyEl.querySelector('textarea');
      ta.onblur = () => Store.update(c => {
        c.bio.chapters[bioIndex].paragraphs = ta.value.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      });
      bodyEl.querySelector('.bio-remove-chapter').addEventListener('click', () => {
        if(!confirm('Delete this chapter?')) return;
        Store.update(c => { c.bio.chapters.splice(bioIndex, 1); });
        bioIndex = Math.max(0, bioIndex - 1);
        render();
      });
    }
  } else {
    titleEl.contentEditable = 'false';
    titleEl.onblur = null;
    titleEl.textContent = ch.title;
    bodyEl.innerHTML = ch.paragraphs.map(p => '<p>' + p + '</p>').join('');
  }

  document.getElementById('bio-page-indicator').textContent = (bioIndex + 1) + ' / ' + chapters.length;
  document.getElementById('bio-prev').disabled = bioIndex === 0;
  document.getElementById('bio-next').disabled = bioIndex === chapters.length - 1;
  syncBioNavActive();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('character-select').addEventListener('change', e => {
  const val = e.target.value;
  if(val === '__new__'){
    const name = prompt('Character name:');
    if(name && name.trim()){
      Store.createBlank(name.trim());
      bioIndex = 0;
      editing = true;
      render();
    } else {
      renderToolbar();
    }
    return;
  }
  Store.switchTo(val);
  bioIndex = 0;
  render();
});

document.getElementById('edit-toggle').addEventListener('click', () => {
  editing = !editing;
  render();
});

document.getElementById('save-toolbar-btn').addEventListener('click', () => {
  Store.exportActive();
});

document.getElementById('delete-char-btn').addEventListener('click', () => {
  const chars = Store.listCharacters();
  if(chars.length <= 1) return;
  if(confirm('Delete "' + Store.getActive().name + '"? This cannot be undone.')){
    Store.deleteCharacter(Store.getActive().id);
    bioIndex = 0;
    render();
  }
});

document.getElementById('portrait-change-btn').addEventListener('click', () => {
  document.getElementById('portrait-input').click();
});
document.getElementById('portrait-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if(!file) return;
  Store.setPortrait(file).then(dataUrl => {
    Store.update(c => { c.portraitUrl = dataUrl; });
    render();
  });
  e.target.value = '';
});

document.getElementById('bio-prev').addEventListener('click', () => {
  if(bioIndex > 0){ bioIndex--; renderBioChapter(); }
});
document.getElementById('bio-next').addEventListener('click', () => {
  const chapters = Store.getActive().bio.chapters;
  if(bioIndex < chapters.length - 1){ bioIndex++; renderBioChapter(); }
});

Store.init()
  .then(() => fetch('traits.json').then(res => res.json()).catch(() => ({ merits: {}, flaws: {} })))
  .then(t => { traits = t; render(); })
  .catch(err => {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="position:fixed;top:0;left:0;right:0;background:#5e0d17;color:#fff;padding:10px 16px;font-family:sans-serif;font-size:14px;z-index:9999;">' +
      'Could not load character data (' + err.message + '). If you opened this file directly (file://), browsers block local fetch — serve the folder with a local server instead, e.g. <code>python -m http.server</code> or the VS Code Live Server extension.' +
      '</div>');
    console.error(err);
  });
