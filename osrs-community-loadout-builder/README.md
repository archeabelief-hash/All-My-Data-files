# ESOG OSRS Loadout Builder

A community loadout planner for Old School RuneScape.

## Current capabilities

- Enter a RuneScape name and attempt to pull current stats.
- Manual stat correction if an external profile is stale or unavailable.
- Select anti-PK, PK, or PvM/bossing.
- Filter recommendations by current stat requirements.
- Show gear, inventory, access requirements, and fight notes.
- Current starter encounters: Revenants, Singles PK / Anti-PK, King Black Dragon, Crazy Archaeologist, Chaos Fanatic, Scorpia, and Barrows.

## Planned data model

The project is intended to grow into a full requirements-aware OSRS combat knowledge base. Each recommendation should eventually account for:

- Attack, Strength, Defence, Hitpoints, Ranged, Prayer, Magic, Slayer and combat level.
- Quest, diary, spellbook, region, minigame and item-unlock requirements.
- Weapon speed, max hit, accuracy, special-attack energy, ammo/rune costs and PvP restrictions.
- Magic damage %, Magic accuracy, elemental weaknesses and powered-staff rules.
- Ranged attack, Ranged strength, enchanted bolt effects and weapon/ammo compatibility.
- Food healing, overheal rules, combo eating, potion timing, stat drains, prayer restoration and effective HP per slot.
- Wilderness level, Tele Block, teleport limits, skulled/unskulled risk and protected items.
- Boss defence profile, attack styles, protection-prayer interactions, mechanics, travel route and death risk.
- Price/risk profiles so low-risk, balanced and maximum-performance presets can differ.

## Data quality rule

Do not recommend an item merely because it is strong. A recommendation must first pass account compatibility checks: stat requirement, quest/unlock requirement, combat-area legality, ammo/spell compatibility, and whether the relevant attack actually works in PvP/PvM.

## Stat lookup

The browser app currently attempts to read player data from the Wise Old Man public API. If a profile cannot be loaded or is stale, the manual stat fields remain authoritative.

## Hosting

This folder is a static HTML/CSS/JavaScript app and can be hosted with any static site host, including GitHub Pages once Pages is enabled for an appropriate branch/folder.

## Community goal

Build one place where a player can enter their character name, choose a target or activity, and receive a practical loadout plus everything they still need to unlock before attempting it.
