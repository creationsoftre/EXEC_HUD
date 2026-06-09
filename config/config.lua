Config = Config or {}

-- Defaults (normalized 0..1 positions)
Config.Defaults = {
  position = { x = 0.50, y = 0.92 },   -- bottom dock (centered by CSS)
  ammoPos  = { x = 0.98, y = 0.06 },   -- top-right ammo widget
  scale    = 1.0,
  showPercent = true,
  showLogoOverlay = true,
  style = {}
}

-- Look & feel
Config.Style = {
  dockBg      = 'rgba(20,21,23,0.85)',
  dockBorder  = '#2A2C30',
  tileBg      = '#1A1B1E',
  tileActive  = 'rgba(57,255,20,0.15)',
  tileIdle    = 'rgba(20,21,23,0.85)',
  stroke      = 'rgba(57,255,20,0.35)',
  text        = '#FFFFFF',
  glow        = 'rgba(0,0,0,0.6)',

  -- Bars
  hpLeft  = '#39FF14', hpRight = '#2EE60F',
  arLeft  = '#A8A8A8', arRight = '#6B6B6B'
}

-- Radar / HUD
Config.RadarOnlyInVehicle = true
Config.HideDefaultHud      = true -- we keep weapon wheel

-- Ticks
Config.TickRate       = 150
Config.RadarCheckRate = 250

-- Commands
Config.EditCommand  = 'hudedit'
Config.ResetCommand = 'hudreset'

-- Branding
Config.DiscordText = 'discord.gg/exec-scripts'
Config.EnableDiscordText = true

Config.LogoOverlay = {
  enabled = true,
  asset = 'exec_logo.png',
  alt = 'Server logo'
}
