# exec_hud

Standalone draggable HUD with health, armor, voice state, server ID, and ammo widgets.

## Dependencies

- No hard dependency for standalone use
- Optional: QBCore or ESX for automatic show and hide events
- Optional: `exec_multichar` or other resources that call the HUD exports

## Installation

1. Copy the `exec_hud` folder into your server `resources` directory.
2. Add the resource to `server.cfg`.

```cfg
ensure exec_hud
```

## Commands

- `/hudedit`
- `/hudreset`

## Exports

- `ShowHud`
- `HideHud`
- `SetHudVisible`
- `SetHudEnabled`

## Config File

- `config/config.lua`

## Full Description

- [`EXEC_HUD_BREAKDOWN.md`](../admin/exec_docs/EXEC_HUD_BREAKDOWN.md)
- [`EXEC_HUD_BREAKDOWN.html`](../admin/exec_docs/EXEC_HUD_BREAKDOWN.html)

## Logo Overlay

- Set `Config.LogoOverlay.asset` to the `.gif` or `.png` file you want to use in the HUD overlay
- Use `Config.LogoOverlay.enabled` to disable the overlay server-wide
- Players can toggle the overlay on or off in `/hudedit`, and that preference is saved
