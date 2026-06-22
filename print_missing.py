import os

file_path = "/Users/matheusjardim/.gemini/antigravity-ide/brain/e2f662ca-e1aa-4b90-8df9-3592aee0f37a/scratch/recovered_conversations/6dcbc02a-6dea-402c-bbc5-563ff9e85075_recovered.jsx"

if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if 783 <= line_num <= 1484:
            if "MISSING LINE" in line:
                print(f"Line {line_num} is missing!")
else:
    print("Recovered file not found!")
