#!/bin/bash

# Silhouette Generator Wrapper Script
# Usage: ./make_silhouette.sh input_image.jpg [output_name] [transparent]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if virtual environment exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo -e "${RED}Error: Virtual environment not found.${NC}"
    echo "Please run the following commands first:"
    echo "  cd $SCRIPT_DIR"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install rembg pillow numpy onnxruntime"
    exit 1
fi

# Function to show usage
show_usage() {
    echo -e "${BLUE}Silhouette Generator${NC}"
    echo ""
    echo "Usage:"
    echo "  $0 input_image.jpg                           # Smooth white background"
    echo "  $0 input_image.jpg my_silhouette             # Custom name, smooth white background"
    echo "  $0 input_image.jpg my_silhouette transparent # Custom name, smooth transparent background"
    echo "  $0 input_image.jpg my_silhouette sharp       # Sharp edges (no smoothing)"
    echo ""
    echo "Examples:"
    echo "  $0 photo.jpg"
    echo "  $0 photo.jpg yoga_pose"
    echo "  $0 photo.jpg yoga_pose transparent"
    echo "  $0 photo.jpg yoga_pose sharp              # For sharp, non-smoothed edges"
    echo ""
    echo -e "${YELLOW}Note: Drag and drop the image file into the terminal after typing the command${NC}"
}

# Check arguments
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

INPUT_FILE="$1"

# Remove quotes if present (from drag and drop)
INPUT_FILE="${INPUT_FILE%\"}"
INPUT_FILE="${INPUT_FILE#\"}"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}Error: Input file '$INPUT_FILE' not found.${NC}"
    echo ""
    show_usage
    exit 1
fi

# Get file extension and basename
INPUT_DIR=$(dirname "$INPUT_FILE")
INPUT_NAME=$(basename "$INPUT_FILE" | cut -d. -f1)

# Determine output filename
if [ -n "$2" ]; then
    OUTPUT_NAME="$2"
else
    OUTPUT_NAME="${INPUT_NAME}_silhouette"
fi

# Ensure output has .png extension
if [[ "$OUTPUT_NAME" != *.png ]]; then
    OUTPUT_NAME="${OUTPUT_NAME}.png"
fi

# If output name doesn't contain a path, put it in the same directory as input
if [[ "$OUTPUT_NAME" != *"/"* ]]; then
    OUTPUT_FILE="$INPUT_DIR/$OUTPUT_NAME"
else
    OUTPUT_FILE="$OUTPUT_NAME"
fi

# Determine background type and smoothing
BACKGROUND="white"
SMOOTH_OPTIONS=""
EDGE_TYPE="smooth"

if [ "$3" = "transparent" ] || [ "$3" = "trans" ] || [ "$3" = "t" ]; then
    BACKGROUND="transparent"
elif [ "$3" = "sharp" ] || [ "$3" = "hard" ]; then
    SMOOTH_OPTIONS="--no-smooth"
    EDGE_TYPE="sharp"
fi

# Check if 4th argument is for edge type when 3rd is transparent
if [ "$3" = "transparent" ] && ([ "$4" = "sharp" ] || [ "$4" = "hard" ]); then
    SMOOTH_OPTIONS="--no-smooth"
    EDGE_TYPE="sharp"
fi

# Show what we're doing
echo -e "${BLUE}=== Silhouette Generator ===${NC}"
echo "Input:      $INPUT_FILE"
echo "Output:     $OUTPUT_FILE"
echo "Background: $BACKGROUND"
echo "Edges:      $EDGE_TYPE"
echo ""

# Activate virtual environment and run the generator
echo -e "${YELLOW}Processing...${NC}"
cd "$SCRIPT_DIR"
source venv/bin/activate

python silhouette_generator.py "$INPUT_FILE" "$OUTPUT_FILE" --background "$BACKGROUND" $SMOOTH_OPTIONS

# Check if successful
if [ $? -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo -e "${GREEN}✅ Success! Silhouette saved as:${NC}"
    echo "   $OUTPUT_FILE"
    
    # Ask if user wants to open the file
    echo ""
    read -p "Open the result? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            open "$OUTPUT_FILE"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            xdg-open "$OUTPUT_FILE"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            # Windows
            start "$OUTPUT_FILE"
        fi
    fi
else
    echo ""
    echo -e "${RED}❌ Failed to create silhouette.${NC}"
    exit 1
fi