const Store = (function(){
  const REGISTRY_KEY = 'vtm.characters';
  const ACTIVE_KEY = 'vtm.active';
  const CHAR_PREFIX = 'vtm.char.';
  const DEFAULT_ID = 'juliette';

  // Canonical V20 trait names — fixed for every character, only the dot
  // values differ. Disciplines/merits/flaws/backgrounds/contacts/inventory/
  // bio chapters are open-ended lists instead (see createBlank below).
  const ATTRIBUTE_SCHEMA = {
    physical: ['Strength', 'Dexterity', 'Stamina'],
    social: ['Charisma', 'Manipulation', 'Appearance'],
    mental: ['Perception', 'Intelligence', 'Wits']
  };
  const SKILL_SCHEMA = {
    talents: ['Alertness', 'Athletics', 'Brawl', 'Dodge', 'Empathy', 'Expression', 'Intimidation', 'Leadership', 'Streetwise', 'Subterfuge'],
    skills: ['Animal Ken', 'Crafts', 'Drive', 'Etiquette', 'Firearms', 'Melee', 'Performance', 'Security', 'Stealth', 'Survival'],
    knowledges: ['Academics', 'Computer', 'Finance', 'Investigation', 'Law', 'Linguistics', 'Medicine', 'Occult', 'Politics', 'Science']
  };
  const VIRTUE_SCHEMA = ['Conscience', 'Self-Control', 'Courage'];

  function zeroed(names){
    const out = {};
    for(const n of names) out[n] = 0;
    return out;
  }

  function getRegistry(){
    try{ return JSON.parse(localStorage.getItem(REGISTRY_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveRegistry(reg){
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  }

  function getActiveId(){ return localStorage.getItem(ACTIVE_KEY); }
  function setActiveId(id){ localStorage.setItem(ACTIVE_KEY, id); }

  function readChar(id){
    try{ return JSON.parse(localStorage.getItem(CHAR_PREFIX + id)); }
    catch(e){ return null; }
  }
  function writeChar(char){
    localStorage.setItem(CHAR_PREFIX + char.id, JSON.stringify(char));
  }

  function buildDefaultFromBundle(data, bio, contacts){
    return Object.assign({}, data, {
      id: DEFAULT_ID,
      portraitUrl: 'juliette.PNG',
      bio: { chapters: (bio && bio.chapters) || [] },
      contacts: (contacts && contacts.contacts) || []
    });
  }

  function init(){
    const registry = getRegistry();
    if(registry.length && getActiveId() && readChar(getActiveId())){
      return Promise.resolve();
    }
    // First-ever visit (or corrupted storage): seed from the bundled files.
    return Promise.all([
      fetch('data.json').then(r => r.json()),
      fetch('bio.json').then(r => r.json()).catch(() => ({ chapters: [] })),
      fetch('contacts.json').then(r => r.json()).catch(() => ({ contacts: [] }))
    ]).then(([data, bio, contacts]) => {
      const char = buildDefaultFromBundle(data, bio, contacts);
      writeChar(char);
      saveRegistry([{ id: DEFAULT_ID, name: char.name }]);
      setActiveId(DEFAULT_ID);
    });
  }

  function getActive(){
    const id = getActiveId();
    return id ? readChar(id) : null;
  }

  function save(char){
    writeChar(char);
    const reg = getRegistry();
    const entry = reg.find(c => c.id === char.id);
    if(entry) entry.name = char.name;
    saveRegistry(reg);
  }

  function update(mutatorFn){
    const char = getActive();
    if(!char) return null;
    mutatorFn(char);
    save(char);
    return char;
  }

  function listCharacters(){
    return getRegistry();
  }

  function switchTo(id){
    if(readChar(id)) setActiveId(id);
  }

  function blankSkeleton(name){
    const attributes = {};
    for(const cat in ATTRIBUTE_SCHEMA) attributes[cat] = zeroed(ATTRIBUTE_SCHEMA[cat]);
    const skills = {};
    for(const cat in SKILL_SCHEMA) skills[cat] = zeroed(SKILL_SCHEMA[cat]);

    return {
      id: null,
      name: name || 'New Character',
      portraitUrl: '',
      clanTag: '', quote: '', concept: '', predatorType: '', clan: '', generation: '', sire: '',
      ambition: '', desire: '',
      attributes, skills,
      disciplines: {},
      virtues: zeroed(VIRTUE_SCHEMA),
      willpower: { value: 0, max: 5 },
      humanity: { value: 0, max: 10 },
      meritsPoints: '', merits: [],
      flawsPoints: '', flaws: [],
      backgrounds: [],
      bio: { chapters: [] },
      contacts: [],
      inventory: [],
      haven: { name: '', location: '', security: '', description: '' }
    };
  }

  function newId(){
    return 'char-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function createBlank(name){
    const char = blankSkeleton(name);
    char.id = newId();
    writeChar(char);
    const reg = getRegistry();
    reg.push({ id: char.id, name: char.name });
    saveRegistry(reg);
    setActiveId(char.id);
    return char.id;
  }

  function isPlainObject(v){
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  // Merges an imported/partial character over a full blank skeleton so
  // missing or old-format fields fall back to sane defaults instead of
  // crashing the renderer. Arrays and primitives are replaced wholesale;
  // plain objects are merged key-by-key, recursively.
  function deepMerge(base, override){
    if(!isPlainObject(override)) return override === undefined ? base : override;
    const out = Object.assign({}, base);
    for(const k in override){
      out[k] = isPlainObject(base[k]) ? deepMerge(base[k], override[k]) : override[k];
    }
    return out;
  }

  // Imports a previously-exported character JSON. If its id collides with
  // one already in the registry, asks whether to overwrite that character
  // or bring it in as a separate copy instead.
  function importCharacter(raw){
    if(!raw || typeof raw !== 'object' || !raw.name){
      throw new Error("That file doesn't look like a character sheet.");
    }
    const merged = deepMerge(blankSkeleton(raw.name), raw);

    const reg = getRegistry();
    let id = raw.id;
    const collision = id && reg.find(c => c.id === id);
    if(collision){
      const overwrite = confirm('A character called "' + collision.name + '" already exists with this id.\n\nOK to overwrite it, or Cancel to import this as a separate new character.');
      if(!overwrite) id = null;
    }
    if(!id) id = newId();
    merged.id = id;
    writeChar(merged);

    const idx = reg.findIndex(c => c.id === id);
    if(idx >= 0) reg[idx].name = merged.name;
    else reg.push({ id, name: merged.name });
    saveRegistry(reg);
    setActiveId(id);
    return id;
  }

  function deleteCharacter(id){
    const reg = getRegistry().filter(c => c.id !== id);
    saveRegistry(reg);
    localStorage.removeItem(CHAR_PREFIX + id);
    if(getActiveId() === id){
      if(reg.length) setActiveId(reg[0].id);
      else localStorage.removeItem(ACTIVE_KEY);
    }
  }

  function exportActive(){
    const char = getActive();
    if(!char) return;
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (char.name || 'character').replace(/[^\w-]+/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setPortrait(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX_EDGE = 1000;
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    init, getActive, save, update,
    listCharacters, switchTo, createBlank, deleteCharacter,
    exportActive, importCharacter, setPortrait,
    ATTRIBUTE_SCHEMA, SKILL_SCHEMA, VIRTUE_SCHEMA
  };
})();

// Node/CommonJS export for testing; unused (and harmless) in the browser.
if(typeof module !== 'undefined' && module.exports) module.exports = Store;
