local settingsKey = 'exec-hud:settings'

local last = { hp=-1, ar=-1, talking=-1, id=-1, ammo=-1, clip=-1, max=-1, weapon=0 }
local editing = false
local state = { enabled=false, visible=false, paused=false, hidden=false, appearanceHidden=false }
state.paused = IsPauseMenuActive()
local brandEnabled = Config.EnableDiscordText ~= false
local logoOverlay = Config.LogoOverlay or {}
local kvpGet
local applyVisibility

local function send(m) SendNUIMessage(m) end
local function isPlayerReady()
  local ped = PlayerPedId()
  return ped ~= 0 and DoesEntityExist(ped) and NetworkIsPlayerActive(PlayerId())
end

local function pushBootstrap()
  send({ action='applySettings', data=kvpGet() })
  local discordText = brandEnabled and Config.DiscordText or ''
  send({
    action='style',
    data=Config.Style,
    discord=discordText,
    brandEnabled=brandEnabled,
    showPercent=Config.Defaults.showPercent,
    logoOverlay=logoOverlay
  })
  applyVisibility()
end

applyVisibility = function()
  local shouldShow = state.enabled and not state.paused and not state.hidden and not state.appearanceHidden
  if shouldShow ~= state.visible then
    state.visible = shouldShow
    send({ action='visible', value=shouldShow })
  end
end

-- Exports
function SetHudEnabled(on) state.enabled = on and true or false; applyVisibility() end
function SetHudVisible(on)
  if not on then
    state.hidden = true
  else
    state.hidden = false
  end
  applyVisibility()
end
function ShowHud() SetHudVisible(true) end
function HideHud() SetHudVisible(false) end
exports('SetHudEnabled', SetHudEnabled)
exports('SetHudVisible', SetHudVisible)
exports('ShowHud', ShowHud)
exports('HideHud', HideHud)

local function setAppearanceHidden(hidden)
  state.appearanceHidden = hidden and true or false
  applyVisibility()
end

RegisterNetEvent('fivem-appearance:client:open', function()
  setAppearanceHidden(true)
end)

RegisterNetEvent('fivem-appearance:client:close', function()
  setAppearanceHidden(false)
end)

RegisterNetEvent('exec:appearance:open', function()
  setAppearanceHidden(true)
end)

RegisterNetEvent('exec:appearance:close', function()
  setAppearanceHidden(false)
end)

CreateThread(function()
  local wasPaused = state.paused
  while true do
    local paused = IsPauseMenuActive()
    if paused ~= wasPaused then
      wasPaused = paused
      state.paused = paused
      applyVisibility()
    end
    Wait(200)
  end
end)

-- KVP
kvpGet = function()
  local raw = GetResourceKvpString(settingsKey)
  local function deepCopy(tbl)
    if type(tbl) ~= 'table' then return tbl end
    local result = {}
    for k,v in pairs(tbl) do result[k] = deepCopy(v) end
    return result
  end

  local function mergeDefaults(saved)
    local defaults = deepCopy(Config.Defaults)
    if type(defaults.style) ~= 'table' then defaults.style = {} end
    if type(saved) ~= 'table' then return defaults end
    local function merge(dst, src)
      for k,v in pairs(src) do
        if type(v) == 'table' and type(dst[k]) == 'table' then
          merge(dst[k], v)
        else
          dst[k] = v
        end
      end
    end
    merge(defaults, saved)
    if type(defaults.style) ~= 'table' then defaults.style = {} end
    return defaults
  end

  if not raw then return mergeDefaults(nil) end
  local ok, parsed = pcall(json.decode, raw)
  if ok and type(parsed) == 'table' then return mergeDefaults(parsed) end
  return mergeDefaults(nil)
end
local function kvpSet(tbl) SetResourceKvp(settingsKey, json.encode(tbl)) end

-- Edit mode
local function setEditMode(on)
  editing = on
  SetNuiFocus(on, on)
  if on then
    send({ action='beginEdit', data=kvpGet() }) -- snapshot for cancel
  else
    send({ action='edit', value=false })
  end
end

RegisterNUICallback('saveSettings', function(data, cb)
  if type(data) == 'table' then
    if type(data.style) ~= 'table' then data.style = {} end
    kvpSet(data); cb({ok=true})
  else
    cb({ok=false})
  end
end)
RegisterNUICallback('finishEdit', function(_, cb) setEditMode(false); cb({ok=true}) end)
RegisterNUICallback('cancelEdit', function(_, cb) send({ action='applySettings', data=kvpGet() }); setEditMode(false); cb({ok=true}) end)
RegisterNUICallback('requestSettings', function(_, cb)
  local settings = kvpGet()
  send({ action='applySettings', data=settings })
  cb(settings)
end)
RegisterNUICallback('requestBootstrap', function(_, cb)
  pushBootstrap()
  cb({ok=true})
end)

RegisterCommand(Config.EditCommand, function() setEditMode(not editing) end, false)
RegisterKeyMapping(Config.EditCommand, 'Toggle HUD edit mode', 'keyboard', 'F7')

RegisterCommand(Config.ResetCommand, function()
  kvpSet(Config.Defaults)
  send({ action='applySettings', data=kvpGet() })
end, false)

-- Apply defaults on boot
CreateThread(function()
  Wait(300)
  pushBootstrap()
  SetHudEnabled(false)
end)

AddEventHandler('onClientResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then
    return
  end

  CreateThread(function()
    Wait(300)
    pushBootstrap()
    if isPlayerReady() then
      SetHudEnabled(true)
    end
  end)
end)

AddEventHandler('onClientResourceStop', function(resourceName)
  if resourceName == 'fivem-appearance' then
    setAppearanceHidden(false)
  end
end)

-- Show when player really loads
AddEventHandler('playerSpawned', function() SetHudEnabled(true) end)
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function() SetHudEnabled(true) end)
RegisterNetEvent('QBCore:Client:OnPlayerUnload', function() SetHudEnabled(false) end)
RegisterNetEvent('esx:playerLoaded', function() SetHudEnabled(true) end)
RegisterNetEvent('esx:onPlayerLogout', function() SetHudEnabled(false) end)

-- Ammo helpers
local function getAmmoData(ped)
  local has, weaponHash = GetCurrentPedWeapon(ped, true)
  if not has or weaponHash == 0 then return 0, 0, 0, 0 end
  local clip = 0
  local clipOk, clipCount = GetAmmoInClip(ped, weaponHash)
  if clipOk then clip = clipCount or 0 end
  local total = GetAmmoInPedWeapon(ped, weaponHash) or 0
  local maxAmmo = 0
  local ok, max = GetMaxAmmo(ped, weaponHash); if ok then maxAmmo = max or 0 end
  return clip, total, maxAmmo, weaponHash
end

-- Main tick
CreateThread(function()
  while true do
    local ped = PlayerPedId()

    -- HP normalize 0..100
    local hpRaw = GetEntityHealth(ped) or 0
    local hpMax = GetEntityMaxHealth(ped) or 200
    if hpMax <= 100 then hpMax = 200 end
    local denom = (hpMax - 100); if denom <= 0 then denom = 100 end
    local hp = math.floor(((hpRaw - 100) / denom) * 100.0 + 0.5)
    if IsEntityDead(ped) or IsPedFatallyInjured(ped) then hp = 0 end
    hp = math.max(0, math.min(100, hp))

    local ar = math.max(0, math.min(100, GetPedArmour(ped) or 0))

    local clip, total, maxAmmo, weapon = getAmmoData(ped)
    local talking = NetworkIsPlayerTalking(PlayerId()) and 1 or 0
    local sid = GetPlayerServerId(PlayerId()) or 0

    if hp ~= last.hp or ar ~= last.ar or clip ~= last.clip or total ~= last.ammo or maxAmmo ~= last.max or weapon ~= last.weapon or talking ~= last.talking or sid ~= last.id then
      last.hp, last.ar, last.clip, last.ammo, last.max, last.weapon, last.talking, last.id =
        hp,   ar,   clip,      total,     maxAmmo,    weapon,        talking,      sid
      send({
        action='hud',
        hp=hp, armor=ar,
        clip=clip, ammo=total, maxAmmo=maxAmmo, weapon=weapon,
        talking=talking, id=sid
      })
    end

    applyVisibility()
    Wait(Config.TickRate or 150)
  end
end)

-- Radar & GTA HUD (keep weapon wheel)
if Config.RadarOnlyInVehicle ~= false then
  CreateThread(function()
    while true do
      DisplayRadar((not state.appearanceHidden) and IsPedInAnyVehicle(PlayerPedId(), false))
      Wait(Config.RadarCheckRate or 250)
    end
  end)
end

if Config.HideDefaultHud ~= false then
  CreateThread(function()
    while true do
      Wait(0)
      -- DO NOT hide component 20 (weapon wheel)
      HideHudComponentThisFrame(1)   -- Wanted
      HideHudComponentThisFrame(2)   -- Weapon icon
      HideHudComponentThisFrame(3)   -- Cash
      HideHudComponentThisFrame(4)   -- MP cash
      HideHudComponentThisFrame(6)   -- Vehicle name
      HideHudComponentThisFrame(7)   -- Area
      HideHudComponentThisFrame(8)   -- Vehicle class
      HideHudComponentThisFrame(9)   -- Street
      HideHudComponentThisFrame(13)  -- Cash change
      HideHudComponentThisFrame(17)  -- Save
    end
  end)
end
