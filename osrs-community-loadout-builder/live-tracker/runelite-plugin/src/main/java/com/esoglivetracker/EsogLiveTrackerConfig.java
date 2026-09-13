package com.esoglivetracker;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("esog-live-tracker")
public interface EsogLiveTrackerConfig extends Config
{
    @ConfigItem(
        keyName = "endpoint",
        name = "Dashboard endpoint",
        description = "Local ESOG companion server endpoint"
    )
    default String endpoint()
    {
        return "http://127.0.0.1:8765/api/telemetry";
    }

    @ConfigItem(
        keyName = "sendTelemetry",
        name = "Send live telemetry",
        description = "Send read-only gameplay telemetry to the configured endpoint",
        warning = "This feature submits your IP address to a 3rd-party server not controlled or verified by RuneLite developers"
    )
    default boolean sendTelemetry()
    {
        return true;
    }

    @ConfigItem(
        keyName = "includeInventoryExpenseEstimate",
        name = "Estimate supply cost",
        description = "Estimate supply cost from inventory decreases while not banking"
    )
    default boolean includeInventoryExpenseEstimate()
    {
        return true;
    }
}
