# Aether Stations: Feed Examples & Launch Catalog

This document details the XML feed schema for **PC2.0 musicL** (Music Loop/Live Station) and provides annotated examples for both Synced and On-Demand stations, alongside the launch catalog seed set.

---

## 1. PC2.0 musicL Feed Schema

The Aether Station specifications extend the Podcast 2.0 namespace. A station feed utilizes:
*   `<podcast:medium>musicL</podcast:medium>`: Identifies this feed as a looping music station rather than a standard episodic podcast.
*   `<podcast:liveItem>`: Declares active or recurring broadcast slots.
*   `syncEpoch` attribute: Absolute millisecond timestamp representing when the playout loop started.
*   `loopDuration` attribute: Total duration of the station playlist loop in milliseconds.

---

## 2. Annotated Synced Station Feed Example

This feed configuration represents a wall-clock synchronized station playing a continuous loop.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Synthesizer Horizons</title>
    <description>A 24/7 continuous stream of retro synthwave and cyberpunk soundtracks.</description>
    <link>https://aether.aegis.fm/stations/synthwave</link>
    <language>en-us</language>
    <!-- Declares this feed as a musicL loop station -->
    <podcast:medium>musicL</podcast:medium>
    
    <!-- Station-level default value split (10% operator cut, 5% curator cut) -->
    <podcast:value type="lightning" method="keysend" suggested="0.00000005">
      <!-- Aegis Node Operator Split (10%) -->
      <podcast:valueRecipient 
        name="Aegis Node Operator" 
        type="node" 
        address="035b1c5a...nodeaddress..." 
        split="10" 
      />
      <!-- Station Curator Split (5%) -->
      <podcast:valueRecipient 
        name="Lounge Curator" 
        type="node" 
        address="027d89a2...nodeaddress..." 
        split="5" 
      />
    </podcast:value>

    <!-- Synchronized Live Broadcast Definition -->
    <!-- syncEpoch: June 30, 2026 12:00:00 AM UTC. loopDuration: 12 minutes (720,000 ms) -->
    <podcast:liveItem 
      status="live" 
      start="2026-06-30T00:00:00Z" 
      syncEpoch="1782777600000" 
      loopDuration="720000"
      chat="https://aether.aegis.fm/chat/synthwave"
    >
      <title>Nightdrive Loop</title>
      <description>The standard nightdrive loop rotation.</description>
      <enclosure url="https://aether.aegis.fm/audio/synthwave_loop_v1.mp3" length="25920000" type="audio/mpeg" />
      
      <!-- Track components mapped inside the loop for client offset indexing -->
      <podcast:playlist>
        <podcast:track title="Neon Awakening" artist="Waveshaper" duration="180000" /> <!-- 3:00 -->
        <podcast:track title="Retro Grid" artist="Dynatron" duration="240000" />       <!-- 4:00 -->
        <podcast:track title="Aether Run" artist="Stelartronic" duration="300000" />   <!-- 5:00 -->
      </podcast:playlist>
    </podcast:liveItem>
  </channel>
</rss>
```

---

## 3. Annotated On-Demand Station Feed Example

This feed configuration represents an on-demand playlist where the client starts from the beginning of the queue upon joining.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Lo-Fi Chill Station</title>
    <description>Your personalized chilled hip-hop stream. Plays on-demand.</description>
    <link>https://aether.aegis.fm/stations/lofi</link>
    <podcast:medium>musicL</podcast:medium>
    
    <!-- Value splits (90% artist-level dynamic splits, 10% platform fee) -->
    <podcast:value type="lightning" method="keysend" suggested="0.00000010">
      <podcast:valueRecipient 
        name="Platform Fee" 
        type="node" 
        address="035b1c5a...nodeaddress..." 
        split="10" 
      />
    </podcast:value>

    <!-- On-Demand Station definition (indicated by status="ondemand" and absence of syncEpoch) -->
    <podcast:liveItem status="ondemand">
      <title>Chill Beats Study Set</title>
      <description>A curated select of lofi tracks for studying.</description>
      
      <podcast:playlist>
        <podcast:track title="Rainy Coffee" artist="Lofi Girl" duration="120000" src="https://aether.aegis.fm/tracks/rainy_coffee.mp3">
          <!-- Track-specific value split overrides feed-level distribution -->
          <podcast:value type="lightning" method="keysend" suggested="0.00000009">
            <podcast:valueRecipient name="Lofi Girl Artist" type="node" address="02ab821b...artist..." split="90" />
            <podcast:valueRecipient name="Coffee Producer" type="node" address="03bc712d...producer..." split="10" />
          </podcast:value>
        </podcast:track>
        
        <podcast:track title="Sleepy Streets" artist="Idealism" duration="150000" src="https://aether.aegis.fm/tracks/sleepy_streets.mp3">
          <podcast:value type="lightning" method="keysend" suggested="0.00000009">
            <podcast:valueRecipient name="Idealism Artist" type="node" address="03417fe2...artist..." split="100" />
          </podcast:value>
        </podcast:track>
      </podcast:playlist>
    </podcast:liveItem>
  </channel>
</rss>
```

---

## 4. Launch Catalog Seed Set

The following stations form the default directory catalog for the Aether launch:

| Station Name | Sync Type | Loop Duration | Primary Genre | Seed Tracks / Source | Value Split Setup | Description |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **Synthesizer Horizons** | Synced | 720,000 ms (12m) | Synthwave | Waveshaper, Dynatron, Lazerhawk | 85% Artist, 10% Host, 5% Curator | High-energy retro synthwave. |
| **Lo-Fi Chill Station** | On-Demand | N/A (Dynamic) | Lofi Hip-Hop | Lofi Girl, Idealism, Jinsang | 90% Artist, 10% Platform Cut | Relaxing background beats for studying. |
| **Aegis Core News** | Synced | 1,800,000 ms (30m) | News / Tech | Bot-generated news digests & updates | 80% Host, 20% Publisher Feed | Automatically compiled summaries of tech news. |
| **Akroasis Live Stage** | Synced | Real-time Playout | Talk / Panel | Live creator audio panel broadcasts | 70% Speaker Pool, 20% Host, 10% Curator | Interactive panels and roundtables. |
