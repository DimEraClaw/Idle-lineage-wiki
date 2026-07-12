import os
import re

keywords = ["詞綴", "affix", "prefix", "詛咒", "cursed", "bless"]

for root, dirs, files in os.walk("."):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.readlines()
                for idx, line in enumerate(content):
                    for kw in keywords:
                        if kw in line:
                            print(f"{path}:{idx+1}: {line.strip()}")
            except Exception as e:
                pass
