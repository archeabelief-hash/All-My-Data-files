package com.esoglivetracker;

import net.runelite.client.RuneLite;
import net.runelite.client.externalplugins.ExternalPluginManager;

public class EsogLiveTrackerPluginTest
{
    public static void main(String[] args) throws Exception
    {
        ExternalPluginManager.loadBuiltin(EsogLiveTrackerPlugin.class);
        RuneLite.main(args);
    }
}
