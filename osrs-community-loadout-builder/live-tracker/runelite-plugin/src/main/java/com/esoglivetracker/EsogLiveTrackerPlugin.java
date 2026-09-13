package com.esoglivetracker;

import com.google.gson.Gson;
import com.google.inject.Provides;
import java.time.Instant;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import javax.inject.Inject;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.Item;
import net.runelite.api.ItemContainer;
import net.runelite.api.Skill;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.ItemContainerChanged;
import net.runelite.api.events.StatChanged;
import net.runelite.api.gameval.InventoryID;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.events.NpcLootReceived;
import net.runelite.client.events.PlayerLootReceived;
import net.runelite.client.game.ItemManager;
import net.runelite.client.game.ItemStack;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;

@Slf4j
@PluginDescriptor(
    name = "ESOG Live Tracker",
    description = "Read-only live XP, loot and profit telemetry for the ESOG dashboard",
    tags = {"xp", "loot", "profit", "tracker", "session", "esog"}
)
public class EsogLiveTrackerPlugin extends Plugin
{
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    @Inject private Client client;
    @Inject private EsogLiveTrackerConfig config;
    @Inject private OkHttpClient http;
    @Inject private Gson gson;
    @Inject private ItemManager itemManager;

    private final Map<Skill, Integer> startXp = new EnumMap<>(Skill.class);
    private final Map<Integer, Integer> previousInventory = new HashMap<>();
    private final AtomicLong lootGp = new AtomicLong();
    private final AtomicLong estimatedSupplyGp = new AtomicLong();
    private long startedAtMs;
    private int npcLootEvents;
    private int playerLootEvents;

    @Provides
    EsogLiveTrackerConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(EsogLiveTrackerConfig.class);
    }

    @Override
    protected void startUp()
    {
        resetSession();
    }

    @Override
    protected void shutDown()
    {
        startXp.clear();
        previousInventory.clear();
    }

    private void resetSession()
    {
        startedAtMs = System.currentTimeMillis();
        lootGp.set(0);
        estimatedSupplyGp.set(0);
        npcLootEvents = 0;
        playerLootEvents = 0;
        startXp.clear();
        previousInventory.clear();
        if (client.getGameState() == GameState.LOGGED_IN)
        {
            for (Skill skill : Skill.values())
            {
                startXp.put(skill, client.getSkillExperience(skill));
            }
            snapshotInventory();
            publish("session_start", null);
        }
    }

    @Subscribe
    public void onGameStateChanged(GameStateChanged event)
    {
        if (event.getGameState() == GameState.LOGGED_IN && startXp.isEmpty())
        {
            resetSession();
        }
        else if (event.getGameState() == GameState.LOGIN_SCREEN)
        {
            publish("session_end", null);
            startXp.clear();
            previousInventory.clear();
        }
    }

    @Subscribe
    public void onStatChanged(StatChanged event)
    {
        if (!startXp.containsKey(event.getSkill()))
        {
            startXp.put(event.getSkill(), event.getXp());
        }
        Map<String, Object> extra = new HashMap<>();
        extra.put("skill", event.getSkill().getName());
        extra.put("xp", event.getXp());
        extra.put("xpGained", Math.max(0, event.getXp() - startXp.getOrDefault(event.getSkill(), event.getXp())));
        publish("xp", extra);
    }

    @Subscribe
    public void onNpcLootReceived(NpcLootReceived event)
    {
        npcLootEvents++;
        publishLoot(event.getNpc() == null ? "NPC" : event.getNpc().getName(), event.getItems(), false);
    }

    @Subscribe
    public void onPlayerLootReceived(PlayerLootReceived event)
    {
        playerLootEvents++;
        publishLoot(event.getPlayer() == null ? "Player" : event.getPlayer().getName(), event.getItems(), true);
    }

    private void publishLoot(String source, Collection<ItemStack> items, boolean pvp)
    {
        long eventValue = 0;
        Map<String, Integer> itemMap = new HashMap<>();
        for (ItemStack item : items)
        {
            int id = item.getId();
            int qty = item.getQuantity();
            long value = (long) itemManager.getItemPrice(id) * qty;
            eventValue += Math.max(0, value);
            String name = itemManager.getItemComposition(id).getName();
            itemMap.merge(name, qty, Integer::sum);
        }
        lootGp.addAndGet(eventValue);
        Map<String, Object> extra = new HashMap<>();
        extra.put("source", source);
        extra.put("pvp", pvp);
        extra.put("valueGp", eventValue);
        extra.put("items", itemMap);
        publish("loot", extra);
    }

    @Subscribe
    public void onItemContainerChanged(ItemContainerChanged event)
    {
        if (!config.includeInventoryExpenseEstimate() || event.getContainerId() != InventoryID.INV)
        {
            return;
        }

        ItemContainer container = event.getItemContainer();
        if (container == null)
        {
            return;
        }

        Map<Integer, Integer> now = new HashMap<>();
        for (Item item : container.getItems())
        {
            if (item.getId() > 0 && item.getQuantity() > 0)
            {
                now.merge(item.getId(), item.getQuantity(), Integer::sum);
            }
        }

        if (!previousInventory.isEmpty())
        {
            long deltaCost = 0;
            for (Map.Entry<Integer, Integer> old : previousInventory.entrySet())
            {
                int decrease = old.getValue() - now.getOrDefault(old.getKey(), 0);
                if (decrease > 0)
                {
                    deltaCost += (long) itemManager.getItemPrice(old.getKey()) * decrease;
                }
            }
            if (deltaCost > 0)
            {
                estimatedSupplyGp.addAndGet(deltaCost);
            }
        }

        previousInventory.clear();
        previousInventory.putAll(now);
    }

    private void snapshotInventory()
    {
        ItemContainer inventory = client.getItemContainer(InventoryID.INV);
        if (inventory == null)
        {
            return;
        }
        previousInventory.clear();
        for (Item item : inventory.getItems())
        {
            if (item.getId() > 0 && item.getQuantity() > 0)
            {
                previousInventory.merge(item.getId(), item.getQuantity(), Integer::sum);
            }
        }
    }

    private void publish(String type, Map<String, Object> extra)
    {
        if (!config.sendTelemetry() || client.getLocalPlayer() == null)
        {
            return;
        }

        long now = System.currentTimeMillis();
        long elapsedMs = Math.max(1, now - startedAtMs);
        long netGp = lootGp.get() - estimatedSupplyGp.get();

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("timestamp", Instant.ofEpochMilli(now).toString());
        payload.put("rsn", client.getLocalPlayer().getName());
        payload.put("elapsedMs", elapsedMs);
        payload.put("lootGp", lootGp.get());
        payload.put("estimatedSupplyGp", estimatedSupplyGp.get());
        payload.put("netGp", netGp);
        payload.put("profitPerHourGp", Math.round(netGp * 3600000.0 / elapsedMs));
        payload.put("npcLootEvents", npcLootEvents);
        payload.put("playerLootEvents", playerLootEvents);

        Map<String, Integer> xpGained = new HashMap<>();
        Map<String, Long> xpPerHour = new HashMap<>();
        for (Skill skill : Skill.values())
        {
            int start = startXp.getOrDefault(skill, client.getSkillExperience(skill));
            int current = client.getSkillExperience(skill);
            int gained = Math.max(0, current - start);
            xpGained.put(skill.getName(), gained);
            xpPerHour.put(skill.getName(), Math.round(gained * 3600000.0 / elapsedMs));
        }
        payload.put("xpGained", xpGained);
        payload.put("xpPerHour", xpPerHour);
        if (extra != null)
        {
            payload.put("event", extra);
        }

        Request request = new Request.Builder()
            .url(config.endpoint())
            .post(RequestBody.create(JSON, gson.toJson(payload)))
            .build();

        http.newCall(request).enqueue(new okhttp3.Callback()
        {
            @Override public void onFailure(okhttp3.Call call, java.io.IOException e)
            {
                log.debug("ESOG telemetry unavailable: {}", e.getMessage());
            }

            @Override public void onResponse(okhttp3.Call call, okhttp3.Response response)
            {
                response.close();
            }
        });
    }
}
