with open("js/08-items-equip.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

def print_function(name):
    found = False
    brace_count = 0
    for idx, line in enumerate(lines):
        if f"function {name}" in line or f"{name} = function" in line or f"{name}(" in line and "function" in line:
            found = True
            print(f"--- Found {name} at line {idx+1} ---")
        if found:
            print(line, end="")
            brace_count += line.count("{")
            brace_count -= line.count("}")
            if brace_count == 0 and idx > 0 and ("}" in line or ";" in line):
                # Check if we really ended
                if brace_count == 0:
                    found = False
                    print("\n--- End ---\n")

print_function("rollAffixesOld")
print_function("rollAffixesNew")
