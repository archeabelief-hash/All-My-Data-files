# ESOG Live Tracker

Read-only Old School RuneScape session telemetry for the ESOG community.

## What it tracks

- Character name
- Session duration
- XP gained by skill
- XP per hour by skill
- NPC loot events
- Player loot events
- Grand Exchange-estimated loot value
- Estimated supply consumption cost from inventory decreases
- Net profit estimate
- Profit per hour estimate
- Latest loot source and item quantities
- Multi-character live dashboard support

The system does **not** click, move, fight, pray, eat, bank, trade, or automate gameplay.

## Architecture

RuneLite development plugin -> local companion server -> phone/mobile dashboard

The RuneLite plugin posts read-only telemetry to `http://127.0.0.1:8765/api/telemetry` by default. The companion server stores the current session in memory and serves the mobile dashboard on port 8765.

## Local testing on Windows

### Companion server

1. Install Node.js LTS.
2. Open `companion-server`.
3. Double-click `start-windows.bat`.
4. Windows Firewall may ask whether Node.js may accept local-network connections. Allow **Private networks** if you want to view the dashboard from your phone.
5. On the PC, open `http://127.0.0.1:8765`.
6. On a phone connected to the same Wi-Fi, open `http://YOUR-PC-IP:8765`.

Find the PC's IPv4 address with `ipconfig` and use the address shown for the active Wi-Fi/Ethernet adapter.

### RuneLite plugin

This plugin follows RuneLite's current external-plugin development structure. RuneLite recommends Java 11 and IntelliJ IDEA for Plugin Hub development.

Run the Gradle `run` task from the plugin root to launch a RuneLite development client with ESOG Live Tracker side-loaded. For Jagex Accounts, use RuneLite's current development-client/Jagex-account login instructions.

The plugin configuration contains:

- Dashboard endpoint
- Send live telemetry
- Estimated supply cost tracking

## Accuracy notes

XP and loot telemetry come from RuneLite events and should be treated as authoritative for the local session once verified in-game.

The current supply-cost figure is deliberately labelled **estimated**. It watches inventory decreases and values them at RuneLite's item-price data. Inventory movement that is not consumption can therefore affect the estimate. Before public release, this should be upgraded to classify known consumables and suppress banking/trading/equipment-transfer cases.

`npcLootEvents` is a loot-event count, not a universal guaranteed boss-kill counter. Some encounters generate loot differently. Dedicated encounter adapters should be added for exact kill counts where required.

## Public Plugin Hub path

RuneLite's current Plugin Hub process requires the plugin source repository to be public, use the external-plugin template structure, pass CI, and undergo RuneLite review. Plugins communicating with third-party servers must provide the required disclosure warning and make third-party telemetry opt-in for public distribution.

This project already includes the required warning field in the telemetry configuration. For a public release, default telemetry should be changed to disabled until the user explicitly opts in, and the backend should use HTTPS with per-user authentication rather than an unauthenticated LAN endpoint.

## Planned production modules

- Persistent session database
- Historical XP/hr and GP/hr charts
- Exact boss kill adapters
- Revenant trip analytics
- PK kill/death analytics
- Death-loss-adjusted profit
- Consumable-specific supply accounting
- Gear snapshotting
- Loadout-builder integration
- Boss/PK preset comparison
- Personal records
- Clan/community leaderboards
- Remote HTTPS dashboard
- Per-player authentication tokens
- Session export

## Source references

Built against RuneLite's external-plugin guidance and event model. Before Plugin Hub submission, pin and test against the then-current RuneLite release rather than relying on `latest.release` indefinitely.
