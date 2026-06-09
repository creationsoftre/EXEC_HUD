-- oxmysql persistence for per-player HUD settings
local TABLE = 'user_hud_settings'

CreateThread(function()
  local sql = ([[CREATE TABLE IF NOT EXISTS `%s` (
      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `identifier` VARCHAR(64) NOT NULL,
      `settings` JSON NOT NULL,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_identifier` (`identifier`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;]]):format(TABLE)
  MySQL.query(sql)
end)

local function getIdentifier(src)
  local ids = GetPlayerIdentifiers(src)
  for _, id in ipairs(ids) do if id:find('license:') == 1 then return id end end
  for _, id in ipairs(ids) do if id:find('license2:') == 1 then return id end end
  for _, id in ipairs(ids) do if id:find('fivem:')   == 1 then return id end end
  for _, id in ipairs(ids) do if id:find('steam:')   == 1 then return id end end
  return ('src:%s'):format(src)
end

local cache = {}

local function saveSettings(identifier, data)
  cache[identifier] = data
  MySQL.query(([[INSERT INTO `%s` (identifier, settings)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE settings = VALUES(settings)]])
                 :format(TABLE),
                 { identifier, json.encode(data) })
end

local function fetchSettings(identifier, cb)
  if cache[identifier] then cb(cache[identifier]) return end
  MySQL.single(([[SELECT settings FROM `%s` WHERE identifier = ?]]):format(TABLE), { identifier }, function(row)
    if row and row.settings then
      local ok, decoded = pcall(json.decode, row.settings)
      if ok and type(decoded) == 'table' then cache[identifier] = decoded end
    end
    cb(cache[identifier])
  end)
end

RegisterNetEvent('react_hud:saveSettings', function(data)
  if type(data) ~= 'table' then return end
  saveSettings(getIdentifier(source), data)
end)

RegisterNetEvent('react_hud:requestSettings', function()
  local src = source
  local id = getIdentifier(src)
  fetchSettings(id, function(settings)
    TriggerClientEvent('react_hud:applyServerSettings', src, settings)
  end)
end)
