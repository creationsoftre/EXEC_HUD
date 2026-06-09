(() => {
  const dockWrap = document.getElementById('dockWrap');
  const brand    = document.getElementById('brand');
  const dock     = document.getElementById('dock');
  const mic      = document.getElementById('tile-mic');
  const idTile   = document.getElementById('tile-id');
  const narcBadge = document.getElementById('narcBadge');
  const toggleLogoOverlay = document.getElementById('toggleLogoOverlay');
  const logoOverlayField = toggleLogoOverlay ? toggleLogoOverlay.closest('.style-toggle') : null;

  const hp = document.getElementById('tile-hp');
  const ar = document.getElementById('tile-ar');
  const hpFill = hp.querySelector('.fill'), hpDim = hp.querySelector('.dim'), hpPct = document.getElementById('hpPct');
  const arFill = ar.querySelector('.fill'), arDim = ar.querySelector('.dim'), arPct = document.getElementById('arPct');

  const ammoHud = document.getElementById('ammoHud');
  const ammoClip = document.getElementById('ammoClip');
  const ammoTotal= document.getElementById('ammoTotal');

  const stylePanel = document.getElementById('stylePanel');
  stylePanel.style.pointerEvents = 'none';
  const styleInputs = Array.from(stylePanel.querySelectorAll('input[data-style]'));
  const colorInputs = Array.from(stylePanel.querySelectorAll('input[data-style-color]'));
  const dockRow = dock.querySelector('.row');

  const editControls = document.getElementById('editControls');
  const btnSave = document.getElementById('btnSave');
  const btnCancel = document.getElementById('btnCancel');

  let state = {
    position: { x: 0.5, y: 0.92 },  // dock
    ammoPos:  { x: 0.98, y: 0.06 }, // ammo
    scale: 1,
    showPercent: true,
    showLogoOverlay: true,
    style: {}
  };
  let editing = false, snapshot = null;
  let baseStyle = {};
  let brandEnabled = true;
  let brandText = '';
  let hudVisible = false;
  let logoOverlay = {
    enabled: true,
    asset: 'narc.gif',
    alt: 'Server logo'
  };
  let brandFrame = null;
  let lastViewportKey = `${window.innerWidth}x${window.innerHeight}`;
  const colorProbe = document.createElement('div');
  colorProbe.style.display = 'none';
  document.body.appendChild(colorProbe);

  function updateLogoOverlayVisibility() {
    const visible = hudVisible && logoOverlay.enabled !== false && state.showLogoOverlay !== false;
    narcBadge.classList.toggle('hidden', !visible);
  }

  function updateLogoOverlay() {
    const asset = (logoOverlay.asset || 'narc.gif').trim();
    narcBadge.src = asset || 'narc.gif';
    narcBadge.alt = logoOverlay.alt || 'Server logo';
    updateLogoOverlayVisibility();
  }

  function syncLogoOverlayToggle() {
    if (!toggleLogoOverlay) return;
    const enabled = logoOverlay.enabled !== false;
    toggleLogoOverlay.checked = state.showLogoOverlay !== false;
    toggleLogoOverlay.disabled = !enabled;
    if (logoOverlayField) {
      logoOverlayField.classList.toggle('disabled', !enabled);
    }
  }

  // visibility
  function setVisible(on) {
    hudVisible = !!on;
    dockWrap.classList.toggle('hidden', !on);
    updateLogoOverlayVisibility();
    // ammo hides when unarmed; visible toggling only applies when armed
    if (on) {
      applyDockPos();
      applyAmmoPos();
      scheduleBrandPosition();
    }
  }

  function updatePercentVisibility() {
    document.querySelectorAll('.pct').forEach(el => el.style.display = state.showPercent ? '' : 'none');
  }

  function mergeStyle() {
    const merged = Object.assign({}, baseStyle, state.style || {});
    const root = document.documentElement.style;
    const map = {
      dockBg: '--dock-bg',
      dockBorder: '--dock-border',
      tileBg: '--tile-bg',
      tileActive: '--tile-active',
      tileIdle: '--tile-idle',
      stroke: '--stroke',
      text: '--text',
      glow: '--glow',
      hpLeft: '--hp-left',
      hpRight: '--hp-right',
      arLeft: '--ar-left',
      arRight: '--ar-right'
    };
    Object.entries(map).forEach(([key, cssVar]) => {
      if (merged[key]) root.setProperty(cssVar, merged[key]);
    });
    scheduleBrandPosition();
  }

  function updateBrand() {
    const text = (brandText || '').trim();
    const show = brandEnabled && text.length > 0;
    brand.textContent = show ? text : '';
    brand.classList.toggle('hidden', !show);
    applyDockPos();
    scheduleBrandPosition();
  }

  function getEffectiveStyleValue(key) {
    const overrides = state.style || {};
    if (overrides[key]) return overrides[key];
    if (baseStyle[key]) return baseStyle[key];
    return '';
  }

  function colorStringToHex(value) {
    if (!value) return '#39FF14';
    try {
      colorProbe.style.color = '';
      colorProbe.style.color = value;
      const computed = getComputedStyle(colorProbe).color;
      const match = computed && computed.match(/\d+/g);
      if (!match || match.length < 3) return '#39FF14';
      const r = Math.min(255, Math.max(0, parseInt(match[0], 10) || 0));
      const g = Math.min(255, Math.max(0, parseInt(match[1], 10) || 0));
      const b = Math.min(255, Math.max(0, parseInt(match[2], 10) || 0));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
      return '#39FF14';
    }
  }

  function syncStyleEditor() {
    styleInputs.forEach((input) => {
      const key = input.dataset.style;
      if (!key) return;
      input.value = getEffectiveStyleValue(key);
    });
    colorInputs.forEach((input) => {
      const key = input.dataset.styleColor;
      if (!key) return;
      input.value = colorStringToHex(getEffectiveStyleValue(key) || '#39FF14');
    });
  }

  function scheduleBrandPosition() {
    if (brandFrame) cancelAnimationFrame(brandFrame);
    brandFrame = requestAnimationFrame(() => {
      brandFrame = null;
      const layoutHeight = dock.offsetHeight || dock.getBoundingClientRect().height || 0;
      const gap = Math.max(10, Math.round(window.innerHeight * 0.012));
      brand.style.bottom = `${layoutHeight + gap}px`;
    });
  }

  function requestSettingsRefresh() {
    try {
      fetch(`https://${GetParentResourceName()}/requestSettings`, { method:'POST', body:'{}' });
    } catch {}
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  function viewportMargins() {
    return {
      side: Math.max(10, Math.round(window.innerWidth * 0.012)),
      top: Math.max(10, Math.round(window.innerHeight * 0.018)),
      bottom: Math.max(12, Math.round(window.innerHeight * 0.02))
    };
  }

  function viewportScaleFactor() {
    const widthFactor = window.innerWidth / 2560;
    const heightFactor = window.innerHeight / 1440;
    const responsive = Math.min(widthFactor, heightFactor);
    return Math.min(1, Math.max(0.52, responsive));
  }

  function applyScale() {
    const baseScale = state.scale || 1;
    const responsive = viewportScaleFactor();
    const effective = Math.max(0.5, Math.min(1.25, baseScale * responsive));
    document.documentElement.style.setProperty('--hud-scale', effective.toFixed(3));
    scheduleBrandPosition();
  }

  function resolveDockBounds() {
    const dockRect = dock.getBoundingClientRect();
    const brandHeight = !brand.classList.contains('hidden') ? (brand.offsetHeight || 0) : 0;
    const brandGap = brandHeight > 0 ? Math.max(10, Math.round(window.innerHeight * 0.012)) : 0;
    return {
      width: Math.max(dockRect.width || 0, 320),
      height: Math.max((dockRect.height || 0) + brandHeight + brandGap, 48)
    };
  }

  function getClampedDockPosition(position) {
    const margins = viewportMargins();
    const bounds = resolveDockBounds();
    const halfWidth = bounds.width / 2;
    const minX = (margins.side + halfWidth) / window.innerWidth;
    const maxX = (window.innerWidth - margins.side - halfWidth) / window.innerWidth;
    const minY = margins.top / window.innerHeight;
    const maxY = (window.innerHeight - margins.bottom - bounds.height) / window.innerHeight;

    return {
      x: clamp(position.x, minX, maxX),
      y: clamp(position.y, minY, maxY)
    };
  }

  function resolveAmmoBounds() {
    const rect = ammoHud.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 0, 138),
      height: Math.max(rect.height || 0, 38)
    };
  }

  function getClampedAmmoPosition(position) {
    const margins = viewportMargins();
    const bounds = resolveAmmoBounds();
    const minX = (margins.side + bounds.width) / window.innerWidth;
    const maxX = (window.innerWidth - margins.side) / window.innerWidth;
    const minY = margins.top / window.innerHeight;
    const maxY = (window.innerHeight - margins.bottom - bounds.height) / window.innerHeight;

    return {
      x: clamp(position.x, minX, maxX),
      y: clamp(position.y, minY, maxY)
    };
  }

  // style/branding from Lua
  function applyStyle(s, discordText, showPercent, enabled, overlayConfig) {
    if (s) {
      baseStyle = Object.assign({}, s);
      mergeStyle();
      syncStyleEditor();
    }
    if (typeof enabled === 'boolean') {
      brandEnabled = enabled;
    }
    if (showPercent !== undefined && !editing) {
      state.showPercent = (showPercent !== false);
      updatePercentVisibility();
    }
    if (discordText !== undefined) {
      brandText = discordText || '';
    }
    if (overlayConfig) {
      logoOverlay = Object.assign({}, logoOverlay, overlayConfig);
      updateLogoOverlay();
      syncLogoOverlayToggle();
    }
    updateBrand();
  }

  // positioning (normalized -> px)
  function applyDockPos() {
    const safePos = getClampedDockPosition(state.position || { x: 0.5, y: 0.92 });
    const left = safePos.x * window.innerWidth;
    const top  = safePos.y * window.innerHeight;
    dockWrap.style.left = `${left}px`;
    dockWrap.style.bottom = 'auto';
    dockWrap.style.top = `${top}px`;
    dockWrap.style.transform = `translate(-50%, 0)`;
    scheduleBrandPosition();
  }
  function applyAmmoPos() {
    const safePos = getClampedAmmoPosition(state.ammoPos || { x: 0.98, y: 0.06 });
    const x = safePos.x * window.innerWidth;
    const y = safePos.y * window.innerHeight;
    ammoHud.style.left = `${x}px`;
    ammoHud.style.top  = `${y}px`;
    ammoHud.style.right = 'auto';
    ammoHud.style.transform = `translate(-100%, 0)`; // anchor like top-right
  }

  // re-apply sizing/positions when the viewport changes (resolution switch, alt+enter, etc.)
  let resizeFrame = null;
  function handleViewportChange() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      const viewportKey = `${window.innerWidth}x${window.innerHeight}`;
      const changed = viewportKey !== lastViewportKey;
      if (changed) lastViewportKey = viewportKey;
      applyScale();
      applyDockPos();
      applyAmmoPos();
      if (changed && !editing) requestSettingsRefresh();
    });
  }
  ['resize', 'orientationchange'].forEach(evt => window.addEventListener(evt, handleViewportChange));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange);
  }

  // drag (dock + ammo, anywhere on element in edit mode)
  const drag = { on:false, dx:0, dy:0, target:null, mode:null };
  function beginDrag(e, mode) {
    if (e.button !== 0) return;
    if (!editing) return;
    drag.mode = mode;
    drag.target = mode === 'dock' ? dockWrap : ammoHud;
    drag.on = true;
    document.body.classList.add('dragging');
    const r = drag.target.getBoundingClientRect();
    drag.dx = e.clientX - r.left; drag.dy = e.clientY - r.top;
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag.on) return;
    if (drag.mode === 'dock') {
      const x = (e.clientX - drag.dx) / window.innerWidth;
      const y = (e.clientY - drag.dy) / window.innerHeight;
      state.position = getClampedDockPosition({ x, y });
      applyDockPos();
    } else if (drag.mode === 'ammo') {
      const x = (e.clientX - drag.dx) / window.innerWidth;
      const y = (e.clientY - drag.dy) / window.innerHeight;
      state.ammoPos = getClampedAmmoPosition({ x, y });
      applyAmmoPos();
    }
  }
  function endDrag() {
    if (!drag.on) return;
    drag.on = false; drag.target = null; drag.mode = null;
    document.body.classList.remove('dragging');
  }
  dockRow.addEventListener('mousedown', (e)=>beginDrag(e,'dock'));
  ammoHud.addEventListener('mousedown', (e)=>beginDrag(e,'ammo'));
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', endDrag);

  // edit controls
  btnSave.addEventListener('click', async () => {
    await fetch(`https://${GetParentResourceName()}/saveSettings`, {
      method:'POST', headers:{'Content-Type':'application/json; charset=UTF-8'},
      body: JSON.stringify(state)
    });
    await fetch(`https://${GetParentResourceName()}/finishEdit`, { method:'POST', body:'{}' });
  });
  btnCancel.addEventListener('click', async () => {
    if (snapshot) {
      state = JSON.parse(JSON.stringify(snapshot));
      applyScale();
      applyDockPos();
      applyAmmoPos();
      mergeStyle();
      updatePercentVisibility();
      syncLogoOverlayToggle();
      updateLogoOverlayVisibility();
      syncStyleEditor();
    }
    await fetch(`https://${GetParentResourceName()}/cancelEdit`, { method:'POST', body:'{}' });
  });
  window.addEventListener('keydown', (e)=>{ if (editing && e.key === 'Escape') btnCancel.click(); });

  styleInputs.forEach((input) => {
    input.addEventListener('input', () => {
      if (!editing) return;
      const key = input.dataset.style;
      if (!key) return;
      const value = input.value.trim();
      if (!state.style) state.style = {};
      if (value.length === 0) {
        delete state.style[key];
      } else {
        state.style[key] = value;
      }
      mergeStyle();
      const colorInput = colorInputs.find(c => c.dataset.styleColor === key);
      if (colorInput) colorInput.value = colorStringToHex(value || getEffectiveStyleValue(key));
    });
  });

  colorInputs.forEach((input) => {
    input.addEventListener('input', () => {
      if (!editing) return;
      const key = input.dataset.styleColor;
      if (!key) return;
      const value = input.value.trim();
      const textInput = styleInputs.find(t => t.dataset.style === key);
      if (textInput) textInput.value = value;
      if (!state.style) state.style = {};
      state.style[key] = value;
      mergeStyle();
    });
  });

  if (toggleLogoOverlay) {
    toggleLogoOverlay.addEventListener('change', () => {
      if (!editing || toggleLogoOverlay.disabled) return;
      state.showLogoOverlay = !!toggleLogoOverlay.checked;
      updateLogoOverlayVisibility();
    });
  }

  // messages from Lua
  window.addEventListener('message', (ev) => {
    const m = ev.data || {};
    if (m.action === 'applySettings') {
      const incoming = m.data || {};
      state.position = Object.assign({}, incoming.position || state.position);
      state.ammoPos = Object.assign({}, incoming.ammoPos || state.ammoPos);
      state.scale = incoming.scale !== undefined ? incoming.scale : state.scale;
      state.showPercent = incoming.showPercent !== undefined ? !!incoming.showPercent : state.showPercent;
      state.showLogoOverlay = incoming.showLogoOverlay !== undefined ? !!incoming.showLogoOverlay : state.showLogoOverlay;
      state.style = Object.assign({}, incoming.style || {});
      applyScale();
      applyDockPos();
      applyAmmoPos();
      mergeStyle();
      updatePercentVisibility();
      syncLogoOverlayToggle();
      updateLogoOverlayVisibility();
      syncStyleEditor();
    }
    if (m.action === 'style')  applyStyle(m.data, m.discord, m.showPercent, m.brandEnabled, m.logoOverlay);
    if (m.action === 'visible') setVisible(!!m.value);

    if (m.action === 'beginEdit') {
      editing = true;
      if (m.data) {
        const incoming = m.data;
        state.position = Object.assign({}, incoming.position || state.position);
        state.ammoPos = Object.assign({}, incoming.ammoPos || state.ammoPos);
        state.scale = incoming.scale !== undefined ? incoming.scale : state.scale;
        state.showPercent = incoming.showPercent !== undefined ? !!incoming.showPercent : state.showPercent;
        state.showLogoOverlay = incoming.showLogoOverlay !== undefined ? !!incoming.showLogoOverlay : state.showLogoOverlay;
        state.style = Object.assign({}, incoming.style || state.style || {});
        applyScale();
        applyDockPos();
        applyAmmoPos();
        mergeStyle();
        updatePercentVisibility();
        syncLogoOverlayToggle();
        updateLogoOverlayVisibility();
      }
      snapshot = JSON.parse(JSON.stringify(state));
      document.body.classList.add('edit');
      editControls.classList.remove('hidden');
      stylePanel.classList.remove('hidden');
      stylePanel.style.pointerEvents = 'auto';
      dockWrap.style.pointerEvents = 'auto';
      dock.style.pointerEvents = 'auto';
      ammoHud.style.pointerEvents = 'auto';
      syncStyleEditor();
      setVisible(true);
      scheduleBrandPosition();
    }
    if (m.action === 'edit' && m.value === false) {
      editing = false;
      document.body.classList.remove('edit');
      editControls.classList.add('hidden');
      stylePanel.classList.add('hidden');
      stylePanel.style.pointerEvents = 'none';
      dockWrap.style.pointerEvents = 'none';
      dock.style.pointerEvents = 'none';
      ammoHud.style.pointerEvents = 'none';
      drag.on = false;
      document.body.classList.remove('dragging');
      syncStyleEditor();
      scheduleBrandPosition();
    }

    if (m.action === 'hud') {
      const hpv = Math.max(0, Math.min(100, m.hp|0));
      const arv = Math.max(0, Math.min(100, m.armor|0));
      hpFill.style.width = hpv + '%';  hpDim.style.width = (100 - hpv) + '%';
      arFill.style.width = arv + '%';  arDim.style.width = (100 - arv) + '%';
      if (state.showPercent) { hpPct.textContent = hpv; arPct.textContent = arv; }

      mic.classList.toggle('talking', !!m.talking);
      idTile.textContent = (m.id ?? 0).toString().slice(0,3);

      // Ammo widget
      const armed = (m.weapon && m.weapon !== 0);
      ammoHud.classList.toggle('hidden', !armed);
      if (armed) {
        ammoClip.textContent  = Math.max(0, m.clip|0);
        ammoTotal.textContent = Math.max(0, m.ammo|0);
      }
    }
  });

  // ask Lua for a full bootstrap on boot/reload
  try { fetch(`https://${GetParentResourceName()}/requestBootstrap`, { method:'POST', body:'{}' }); } catch {}

  // init
  setVisible(false);
  applyScale();
  applyDockPos(); applyAmmoPos();
  updateLogoOverlay();
  syncLogoOverlayToggle();
})();
