fx_version 'cerulean'
game 'gta5'

name 'exec_hud'
author 'WickmanCapo'
description 'Dock HUD with HP/Armor/Mic/ID + top-right ammo, draggable edit UX'

version '1.6.3'
ui_page 'html/ui.html'

files {
  'html/ui.html',
  'html/style.css',
  'html/app.js',
  'html/*.gif',
  'html/*.png'
}

client_scripts {
  'config/config.lua',
  'client.lua'
}


exports {
  'ShowHud',
  'HideHud',
  'SetHudVisible',
  'SetHudEnabled'
}

escrow_ignore {
  '.git',
  '.git/**',
  'config/*.lua',
}
