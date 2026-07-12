import os
import urllib.request

base_url = "https://shines871.github.io/idle-lineage-class/"


files = [
    "js/00-data.js", "js/01-drops-config.js", "js/02-stats-recompute.js", "js/03-combat-core.js",
    "js/04-combat-attack.js", "js/05-kill-progression.js", "js/06-status-allies.js", "js/07-skills-cast.js",
    "js/08-items-equip.js", "js/09-vfx-render.js", "js/10-ui-tabs.js", "js/11-world-map.js",
    "js/12-npc-quests.js", "js/13-shop-save.js", "js/14-craft-pandora.js", "js/15-cards.js",
    "js/16-equip-book.js", "js/17-audio.js",
    "afk-offline.js", "afk-mobile.js", "afk-backnav.js", "afk-slotinfo.js", "afk-extradata.js",
    "afk-dex.js", "afk-wiki.js", "afk-fixes.js", "afk-sw.js", "afk-toast.js", "afk-statpts.js",
    "afk-syncinfo.js", "afk-ui.js", "afk-autobuy.js", "afk-pwa.js", "afk-storage.js", "afk-history.js",
    "afk-training.js", "afk-analytics.js", "afk-skin.js"
]

os.makedirs("js", exist_ok=True)

for file in files:
    url = base_url + file
    print(f"Downloading {url}...")
    try:
        urllib.request.urlretrieve(url, file)
    except Exception as e:
        print(f"Failed to download {file}: {e}")

print("Done!")
