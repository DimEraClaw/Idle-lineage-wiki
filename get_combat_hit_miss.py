with open("js/04-combat-attack.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("out.txt", "w", encoding="utf-8") as out:
    start = 649
    end = 700
    for idx in range(start, end):
        if idx < len(lines):
            out.write(f"{idx+1}: {lines[idx]}")
print("Done!")
