#!/usr/bin/env python3
"""
Script to reverse the order of asanas in a yoga sequence JSON file.
"""

import json
import sys
from pathlib import Path

def reverse_yoga_sequence(input_file, output_file=None):
    """
    Reverse the order of asanas in a yoga sequence JSON file.
    
    Args:
        input_file (str): Path to the input JSON file
        output_file (str, optional): Path to the output JSON file. 
                                   If None, adds '_reversed' to the input filename.
    
    Returns:
        str: Path to the output file
    """
    # Read the input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in '{input_file}': {e}")
        return None
    
    # Check if the file has the expected structure
    if 'asanas' not in data:
        print("Error: JSON file does not contain 'asanas' key.")
        return None
    
    if not isinstance(data['asanas'], list):
        print("Error: 'asanas' is not a list.")
        return None
    
    # Reverse the asanas list
    original_count = len(data['asanas'])
    data['asanas'].reverse()
    
    # Update the name and description to indicate it's reversed
    if 'name' in data:
        data['name'] = data['name'] + " (Reversed)"
    
    if 'description' in data:
        data['description'] = data['description'] + " (Sequence reversed)"
    
    # Determine output filename
    if output_file is None:
        input_path = Path(input_file)
        output_file = input_path.parent / f"{input_path.stem}_reversed{input_path.suffix}"
    
    # Write the reversed data to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing to '{output_file}': {e}")
        return None
    
    print(f"Successfully reversed {original_count} asanas.")
    print(f"Original file: {input_file}")
    print(f"Reversed file: {output_file}")
    
    return str(output_file)

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python reverse_yoga.py <input_json_file> [output_json_file]")
        print("Example: python reverse_yoga.py my_flow.json")
        print("Example: python reverse_yoga.py my_flow.json my_flow_backwards.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = reverse_yoga_sequence(input_file, output_file)
    
    if result is None:
        sys.exit(1)

if __name__ == "__main__":
    main()

# Example usage if running as a module:
# from reverse_yoga import reverse_yoga_sequence
# reverse_yoga_sequence("my_flow.json", "my_flow_reversed.json")