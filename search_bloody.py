import os

keywords = ["嗜血者", "鎖鏈劍", "sherineSetEligible"]
files = ["js/00-data.js", "js/08-items-equip.js", "js/01-drops-config.js"]

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
