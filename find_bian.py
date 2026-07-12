with open("js/11-world-map.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("out.txt", "w", encoding="utf-8") as out:
    start = 900
    end = 970
    for idx in range(start, end):
        if idx < len(lines):
            out.write(f"{idx+1}: {lines[idx]}")
print("Done!")
