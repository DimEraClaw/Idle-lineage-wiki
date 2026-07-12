import os

keywords = ["ER", "evasion", "avoid", "shadow", "迴避", "暗影", "recover", "heal"]
files = ["js/03-combat-core.js", "js/04-combat-attack.js"]

with open("out.txt", "w", encoding="utf-8") as out:
    for file in files:
        if os.path.exists(file):
            out.write(f"=== File: {file} ===\n")
            with open(file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            for idx, line in enumerate(lines):
                for kw in keywords:
                    if kw in line:
                        out.write(f"{idx+1}: {line.strip()}\n")
                        break
print("Done!")
