with open("js/08-items-equip.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("out.txt", "w", encoding="utf-8") as out:
    for idx, line in enumerate(lines):
        if "rollAffix" in line or "roll_affix" in line or "rollaffix" in line or "Affix" in line or "affix" in line:
            out.write(f"{idx+1}: {line.strip()}\n")
