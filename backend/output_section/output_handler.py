import sys
import os
import json
import importlib

# Setup Paths to include the 'scripts' folder
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Arguments from Node.js
dataset_path = sys.argv[1]
model_path = sys.argv[2]
requested_outputs_json = sys.argv[3]

requested_outputs = json.loads(requested_outputs_json)
output_map_path = os.path.join(current_dir, "output_options.json")

# Load mapping
with open(output_map_path, 'r') as f:
    options = json.load(f)

final_results = {}
print(f"[Output Handler] Processing {len(requested_outputs)} requests...")

for out_id in requested_outputs:
    # Find script name for this ID (e.g., "o1" -> "scatter_plot")
    option = next((o for o in options if o["id"] == out_id), None)
    
    if not option:
        continue
        
    script_name = option["name"]
    print(f"   -> Running {script_name}...")

    try:
        # Dynamic Import: scripts.scatter_plot
        module = importlib.import_module(f"scripts.{script_name}")
        
        # Run the script
        result = module.run(dataset_path, model_path)
        final_results[out_id] = result
        
    except Exception as e:
        print(f"[ERROR] {script_name} failed: {e}")
        import traceback
        traceback.print_exc()
        final_results[out_id] = {"error": str(e)}

# Return JSON to Node.js
print("\n__JSON_START__")
print(json.dumps(final_results))
print("__JSON_END__")