#!/bin/bash

# Reverse Yoga Sequence Script
# Reverses the order of asanas in a yoga sequence JSON file

set -e  # Exit on any error

# Function to display usage
usage() {
    echo "Usage: $0 <input_json_file> [output_json_file]"
    echo ""
    echo "Examples:"
    echo "  $0 corepower_c1.json"
    echo "  $0 corepower_c1.json corepower_c1_backwards.json"
    echo ""
    echo "This script reverses the order of asanas in a yoga sequence JSON file."
    echo "Requires jq to be installed for JSON processing."
    exit 1
}

# Function to check if jq is installed
check_jq() {
    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required but not installed."
        echo "Please install jq:"
        echo "  Ubuntu/Debian: sudo apt-get install jq"
        echo "  macOS: brew install jq"
        echo "  CentOS/RHEL: sudo yum install jq"
        exit 1
    fi
}

# Function to reverse the yoga sequence
reverse_yoga_sequence() {
    local input_file="$1"
    local output_file="$2"
    
    # Check if input file exists
    if [[ ! -f "$input_file" ]]; then
        echo "Error: Input file '$input_file' not found."
        exit 1
    fi
    
    # Validate JSON structure
    if ! jq -e '.asanas' "$input_file" &> /dev/null; then
        echo "Error: Input file does not contain a valid 'asanas' array."
        exit 1
    fi
    
    # Count original asanas
    local original_count
    original_count=$(jq '.asanas | length' "$input_file")
    
    # Create reversed sequence with updated metadata
    jq '
        .asanas |= reverse |
        .name = (.name // "Yoga Sequence") + " (Reversed)" |
        .description = (.description // "Yoga sequence") + " (Sequence reversed)"
    ' "$input_file" > "$output_file"
    
    # Verify the operation was successful
    if [[ $? -eq 0 ]] && [[ -f "$output_file" ]]; then
        local new_count
        new_count=$(jq '.asanas | length' "$output_file")
        
        echo "✅ Successfully reversed $original_count asanas."
        echo "📁 Original file: $input_file"
        echo "📁 Reversed file: $output_file"
        
        # Show first and last asana names for verification
        local first_original last_original first_reversed last_reversed
        first_original=$(jq -r '.asanas[0].english // .asanas[0].name // "Unknown"' "$input_file")
        last_original=$(jq -r '.asanas[-1].english // .asanas[-1].name // "Unknown"' "$input_file")
        first_reversed=$(jq -r '.asanas[0].english // .asanas[0].name // "Unknown"' "$output_file")
        last_reversed=$(jq -r '.asanas[-1].english // .asanas[-1].name // "Unknown"' "$output_file")
        
        echo ""
        echo "🔄 Verification:"
        echo "   Original: $first_original → $last_original"
        echo "   Reversed: $first_reversed → $last_reversed"
    else
        echo "❌ Error: Failed to create reversed sequence."
        exit 1
    fi
}

# Main script logic
main() {
    # Check command line arguments
    if [[ $# -lt 1 ]]; then
        usage
    fi
    
    # Check if jq is available
    check_jq
    
    local input_file="$1"
    local output_file="$2"
    
    # Generate output filename if not provided
    if [[ -z "$output_file" ]]; then
        local base_name="${input_file%.*}"
        local extension="${input_file##*.}"
        output_file="${base_name}_reversed.${extension}"
    fi
    
    # Check if output file already exists
    if [[ -f "$output_file" ]]; then
        read -p "⚠️  Output file '$output_file' already exists. Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Operation cancelled."
            exit 0
        fi
    fi
    
    echo "🧘 Reversing yoga sequence..."
    echo "📖 Reading: $input_file"
    echo "💾 Writing: $output_file"
    echo ""
    
    # Perform the reversal
    reverse_yoga_sequence "$input_file" "$output_file"
}

# Run the main function with all arguments
main "$@"