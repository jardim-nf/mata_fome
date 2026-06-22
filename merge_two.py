import os

conv_a = "/Users/matheusjardim/.gemini/antigravity-ide/brain/e2f662ca-e1aa-4b90-8df9-3592aee0f37a/scratch/recovered_conversations/8bf7510d-c9ee-4a55-a677-df18aeeb02ff_recovered.jsx"
conv_b = "/Users/matheusjardim/.gemini/antigravity-ide/brain/e2f662ca-e1aa-4b90-8df9-3592aee0f37a/scratch/recovered_conversations/6dcbc02a-6dea-402c-bbc5-563ff9e85075_recovered.jsx"
target_file = "/Users/matheusjardim/Documents/matafome-landing-atualizado/src/pages/admin/SquadMeeting3D.jsx"

# Load A
with open(conv_a, 'r', encoding='utf-8') as f:
    lines_a = f.readlines()

# Load B
with open(conv_b, 'r', encoding='utf-8') as f:
    lines_b = f.readlines()

merged_lines = []
resolved_count = 0

max_len = max(len(lines_a), len(lines_b))

for i in range(max_len):
    line_num = i + 1
    line_a = lines_a[i] if i < len(lines_a) else None
    line_b = lines_b[i] if i < len(lines_b) else None
    
    if line_a and "MISSING LINE" not in line_a:
        merged_lines.append(line_a.rstrip('\n'))
    elif line_b and "MISSING LINE" not in line_b:
        merged_lines.append(line_b.rstrip('\n'))
        resolved_count += 1
    else:
        # Fallback/Error placeholder if both are missing
        merged_lines.append(f"// BOTH MISSING LINE {line_num}")

# Verify if there are any BOTH MISSING LINE elements in range 783 to 1484
missing_in_range = []
for idx, line in enumerate(merged_lines):
    line_num = idx + 1
    if 783 <= line_num <= 1484:
        if "BOTH MISSING" in line:
            missing_in_range.append(line_num)

print(f"Merged successfully. Resolved {resolved_count} lines.")
print(f"Missing lines in target range (783-1484) after merge: {len(missing_in_range)}")
if len(missing_in_range) > 0:
    print(f"Still missing: {missing_in_range}")
else:
    # Save the merged block
    avatar_block = "\n".join(merged_lines[782:1484]) + "\n"
    animate_block = "\n".join(merged_lines[1643:1751]) + "\n"
    accessory_block = "\n".join(merged_lines[1959:1984]) + "\n"
    
    # Apply to SquadMeeting3D.jsx
    with open(target_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    import re
    # 1. Replace avatar block
    pattern_avatar = r'    agentsArray\.forEach\(\(agentId, idx\) => \{.*?    \}\);\s+let zoomVal = 4\.5;'
    content = re.sub(pattern_avatar, avatar_block + "    let zoomVal = 4.5;", content, flags=re.DOTALL)

    # 2. Replace animate block
    pattern_animate = r'    const animate = \(\) => \{.*?      const active = stateRef\.current\.activeAgent;'
    # Fix const spotlight.color typo if any
    fixed_animate_block = animate_block.replace("const spotlight.color.setHex", "spotlight.color.setHex")
    content = re.sub(pattern_animate, fixed_animate_block + "      const active = stateRef.current.activeAgent;", content, flags=re.DOTALL)

    # 3. Replace accessory block
    pattern_acc = r'        // 11\..*?        // 13\. Active speaker'
    content = re.sub(pattern_acc, accessory_block + "        // 13. Active speaker", content, flags=re.DOTALL)
    
    # Also apply the light setup fix on line 695 and 768
    # Accent light fix
    content = content.replace("const accentLight = new THREE.PointLight(0x6366f1, 1.5, 12);\n    accentLight.position.set(0, 2.5, 0);\n    scene.add(accentLight);",
                              "const accentLight = new THREE.PointLight(0x6366f1, 1.5, 12);\n    accentLight.position.set(0, 2.5, 0);\n    scene.add(accentLight);")
    
    # Write to target_file
    with open(target_file, 'w', encoding='utf-8') as out:
        out.write(content)
        
    print("SquadMeeting3D.jsx has been restored successfully with original Habbo elements!")
