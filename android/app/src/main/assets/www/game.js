(function () {
  'use strict';

  var SAVE_KEY = 'hellclicker-save-v1';
  var MAX_LEVEL = 25;
  var BASE_DAMAGE = 8;
  var AUTO_MS = 800;
  var TICK_MS = 200;
  var EVENT_START = new Date(2026, 9, 20).getTime();
  var EVENT_END = new Date(2026, 10, 5).getTime();

  var MONSTERS = [
    { id: 'skeleton', emoji: '\u2665', name: 'Скелет', hp: 18, dmg: 2, xp: 6, gold: 5 },
    { id: 'devil', emoji: '\uD83D\uDE0C', name: 'Чёрт', hp: 32, dmg: 4, xp: 9, gold: 8 },
    { id: 'hound', emoji: '\uD83D\uDC38', name: 'Адский Пёс', hp: 48, dmg: 6, xp: 12, gold: 11, elite: true },
    { id: 'ghost', emoji: '\uD83D\uDC6B', name: 'Призрак', hp: 58, dmg: 8, xp: 15, gold: 14, elite: true }
  ];

  var state = null;
  var toastTimer = null;

  function defaultState() {
    return {
      hero: { level: 1, xp: 0, hp: 68, maxHp: 68 },
      gold: 15,
      souls: 0,
      upgrades: { weapon: 0, auto: 0, gold: 0 },
      kills: 0,
      taps: 0,
      deaths: 0,
      totalGold: 15,
      achievements: {},
      demonId: 1
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        Object.keys(base).forEach(function (k) { if (p[k] !== undefined) base[k] = p[k]; });
        if (p.hero) Object.keys(p.hero).forEach(function (k) { if (p.hero[k] !== undefined) base.hero[k] = p.hero[k]; });
        if (p.upgrades) Object.keys(p.upgrades).forEach(function (k) { if (p.upgrades[k] !== undefined) base.upgrades[k] = p.upgrades[k]; });
      }
    } catch (e) {}
    return base;
  }

  function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

  function xpNextFor(level) { return Math.round(30 * Math.pow(level, 1.6)); }
  function getDamage() {
    var mult = 1 + state.upgrades.weapon * 0.5;
    mult *= 1 + state.souls * 0.1;
    return Math.floor(8 * state.hero.level * mult);
  }
  function getMaxHp() { return Math.floor(60 + state.hero.level * 8); }
  function getAutoMult() { return 1 + state.upgrades.auto * 0.85; }
  function getGoldMult() { return 1 + state.upgrades.gold * 0.35; }
  function eventActive() { var n = Date.now(); return n >= EVENT_START && n < EVENT_END; }
  function getSpawnInterval() { return eventActive() ? 2000 : 3000; }

  var ACHIEVEMENTS = [
    { id: 'first', name: 'Первый демон', desc: 'Убить первого демона', check: function () { return state.kills >= 1; } },
    { id: 'kills25', name: 'Демон-мафия', desc: 'Убить 25 демонов', check: function () { return state.kills >= 25; } },
    { id: 'lvl10', name: 'Рыцарь Ада', desc: 'Достичь 10 уровня героя', check: function () { return state.hero.level >= 10; } },
    { id: 'upg5', name: 'Тиран', desc: 'Купить 5 улучшений', check: function () { return state.upgrades.weapon + state.upgrades.auto + state.upgrades.gold >= 5; } },
    { id: 'gold1m', name: 'Кладбище', desc: 'Накопить 1 000 000 золота', check: function () { return state.totalGold >= 1000000; } },
    { id: 'soul', name: 'Восстание', desc: 'Получить душу героя', check: function () { return state.souls > 0; } },
    { id: 'death', name: 'Тень', desc: 'Умереть в аду', check: function () { return state.deaths >= 1; } }
  ];

  function fmt(n) {
    if (n < 1000) return String(Math.floor(n));
    var units = ['K', 'M', 'B', 'T'];
    var u = -1;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u += 1; }
    return n.toFixed(n >= 100 ? 0 : 1) + units[u];
  }

  function gainXp(amount) {
    state.hero.xp += amount;
    while (state.hero.xp >= xpNextFor(state.hero.level)) {
      state.hero.xp -= xpNextFor(state.hero.level);
      state.hero.level += 1;
      state.hero.maxHp = getMaxHp();
      state.hero.hp = state.hero.maxHp;
    }
  }

  function addFloat(demon, text) {
    var el = document.createElement('span');
    el.className = 'float-text';
    el.textContent = text;
    document.getElementById('demons').appendChild(el);
    setTimeout(function () { el.remove(); }, 800);
  }

  function doKill(demon) {
    state.kills += 1;
    var xpMult = eventActive() ? 2 : 1;
    var goldMult = getGoldMult() * (eventActive() ? 2 : 1);
    var xpGain = Math.round(demon.xp * xpMult);
    var goldGain = Math.round(demon.gold * goldMult);
    gainXp(xpGain);
    state.gold += goldGain;
    state.totalGold += goldGain;
    addFloat(demon, '+' + goldGain);
    checkAchievements();
    render();
  }

  function heroAttack(demon, dmg) {
    if (!demon || demon.hp <= 0 || state.hero.hp <= 0) return false;
    demon.hp -= dmg;
    addFloat(demon, '-' + Math.round(dmg));
    if (demon.hp <= 0) { doKill(demon); return true; }
    return false;
  }

  function demonCap() { return 2 + Math.min(3, state.upgrades.auto); }

  function spawnDemon() {
    if (state.demons.length >= demonCap()) return;
    var m = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    if (eventActive() && Math.random() < 0.15) {
      m = { id: 'halloween', emoji: '\u{1F383}', name: 'Хэллоуинский Демон', hp: 90, dmg: 12, xp: 40, gold: 60, elite: true };
    }
    state.demons.push({ id: state.demonId++, emoji: m.emoji, name: m.name, hp: m.hp, maxHp: m.hp, dmg: m.dmg, xp: m.xp, gold: m.gold, elite: !!m.elite });
    render();
  }

  function autoAttack() {
    var target = null;
    for (var i = state.demons.length - 1; i >= 0; i--) { if (state.demons[i].hp > 0) { target = state.demons[i]; break; } }
    if (!target) return;
    heroAttack(target, getDamage() * getAutoMult());
  }

  function onHeroDeath() {
    state.deaths += 1;
    state.hero.level = 1;
    state.hero.xp = 0;
    state.hero.maxHp = getMaxHp();
    state.hero.hp = state.hero.maxHp;
    render();
  }

  function tick() {
    if (state.hero.hp <= 0) { onHeroDeath(); return; }
    state.hero.hp += 0.05;
    if (state.hero.hp > state.hero.maxHp) state.hero.hp = state.hero.maxHp;
    autoAttack();
    render();
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach(function (a) {
      if (!state.achievements[a.id] && a.check()) {
        state.achievements[a.id] = true;
        showToast('Достижение: ' + a.name);
      }
    });
  }

  function hitDemon(demon) {
    if (state.hero.hp <= 0) return;
    state.taps += 1;
    var dmg = getDamage();
    if (Math.random() < 0.1) dmg *= 2;
    heroAttack(demon, dmg);
    render();
  }

  function upgradeInfo(type) {
    var base = { weapon: 40, auto: 60, gold: 30 }[type];
    var lvl = state.upgrades[type];
    var maxed = lvl >= 5;
    return { cost: Math.floor(base * Math.pow(1.7, lvl)), maxed: maxed };
  }

  function buyUpgrade(type) {
    var info = upgradeInfo(type);
    if (info.maxed) return;
    if (state.gold < info.cost) return;
    state.gold -= info.cost;
    state.upgrades[type] += 1;
    saveState();
    render();
  }

  function canPrestige() { return state.hero.level >= MAX_LEVEL; }
  function doPrestige() {
    var gain = Math.floor(state.hero.level / 3);
    state.souls += gain;
    state.hero.level = 1;
    state.hero.xp = 0;
    state.hero.maxHp = getMaxHp();
    state.hero.hp = state.hero.maxHp;
    saveState();
    checkAchievements();
    render();
  }

  function renderDemon(d) {
    var pct = Math.max(0, Math.round((d.hp / d.maxHp) * 100));
    var dead = d.hp <= 0;
    return '<button class="demon' + (dead ? ' dead' : '') + '" data-id="' + d.id + '">' +
      '<span class="demon-emoji">' + d.emoji + '</span>' +
      '<span class="demon-name">' + d.name + (d.elite ? '\u{1F451}' : '') + '</span>' +
      '<span class="demon-hp"><i style="width:' + pct + '%"></i></span>' +
      '<span class="demon-dmg">' + Math.ceil(d.hp) + '/' + d.maxHp + '</span>' +
      '</button>';
  }

  function render() {
    document.getElementById('gold').textContent = fmt(state.gold);
    document.getElementById('souls').textContent = state.souls;
    document.getElementById('hero-level').textContent = state.hero.level;
    document.getElementById('hero-dmg').textContent = 'Урон: ' + getDamage();
    document.getElementById('hero-hpcur').textContent = Math.floor(state.hero.hp) + '/' + state.hero.maxHp;

    var hpFill = document.getElementById('hp-fill');
    hpFill.style.width = (state.hero.hp / state.hero.maxHp * 100) + '%';
    var xpFill = document.getElementById('xp-fill');
    var need = xpNextFor(state.hero.level);
    var pct = Math.max(0, Math.min(100, (state.hero.xp / need) * 100));
    xpFill.style.width = pct + '%';

    var banner = document.getElementById('event-banner');
    banner.hidden = !eventActive();

    var demonsEl = document.getElementById('demons');
    if (state.demons.length === 0) {
      demonsEl.innerHTML = '<div class="demons-empty">\u{1F608} Демоны приближаются...</div>';
    } else {
      demonsEl.innerHTML = state.demons.map(renderDemon).join('');
    }

    var shopBox = document.getElementById('shop-list');
    var sh = '';
    var upgrades = [
      { id: 'weapon', name: '\u{1F52A} Адский Молот', desc: '+50% урона за уровень (макс. 5)' },
      { id: 'auto', name: '\u{1F47E} Призрачный Скелет', desc: '+85% скорости автоатаки за уровень (макс. 5)' },
      { id: 'gold', name: '\u{1F4B0} Кладовка Ада', desc: '+35% золота за уровень (макс. 5)' }
    ];
    upgrades.forEach(function (u) {
      var info = upgradeInfo(u.id);
      var afford = !info.maxed && state.gold >= info.cost;
      sh += '<div class="upgrade' + (info.maxed ? ' maxed' : '') + '">' +
        '<div class="upgrade-info"><b>' + u.name + '</b><span>' + u.desc + '</span></div>' +
        '<button class="buy" data-buy="' + u.id + '"' + (info.maxed || !afford ? ' disabled' : '') + '>' + (info.maxed ? 'MAX' : 'Купить: ' + fmt(info.cost)) + '</button>' +
        '</div>';
    });
    shopBox.innerHTML = sh;

    var achBox = document.getElementById('ach-list');
    var ach = '';
    ACHIEVEMENTS.forEach(function (a) {
      var got = !!state.achievements[a.id];
      ach += '<div class="ach' + (got ? ' unlocked' : '') + '"><b>' + a.name + '</b><span>' + a.desc + '</span></div>';
    });
    achBox.innerHTML = ach;

    var can = canPrestige();
    document.getElementById('soul-gain').textContent = can ? Math.floor(state.hero.level / 3) : 0;
    document.getElementById('soul-total').textContent = state.souls;
    document.getElementById('prestige-btn').disabled = !can;
    document.getElementById('prestige').hidden = !can;
  }

  function showToast(t) {
    var el = document.getElementById('toast');
    el.textContent = t;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2500);
  }

  function initTabs() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var t = b.getAttribute('data-tab');
        ['battle', 'shop', 'achievements'].forEach(function (sec) { document.getElementById(sec).hidden = (sec !== t); });
      });
    });
  }

  function start() {
    state = loadState();
    state.demons = [];
    setInterval(tick, TICK_MS);
    setInterval(spawnDemon, getSpawnInterval());
    setInterval(autoAttack, AUTO_MS);
    render();
    initTabs();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
