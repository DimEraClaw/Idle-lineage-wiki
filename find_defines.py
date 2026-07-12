import os

target_names = ["dualWieldOffhandAttack", "titanThreshold", "applyBleed", "castSkill"]


with open("out.txt", "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.endswith(".js"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines):
                        for name in target_names:
                            if name in line and ("function" in line or "=" in line):
                                out.write(f"Found {name} in {path}:{idx+1}:\n")
                                # Print around it
                                start = max(0, idx - 2)
                                end = min(len(lines), idx + 40)
                                for j in range(start, end):
                                    out.write(f"{j+1}: {lines[j]}")
                                out.write("\n" + "="*50 + "\n")
                except Exception as e:
                    out.write(f"Error reading {path}: {e}\n")
print("Done!")
