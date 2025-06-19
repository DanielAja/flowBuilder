#!/usr/bin/env python3
"""
Easy Silhouette Generator

A simple command-line wrapper for silhouette_generator.py with interactive prompts.
No GUI dependencies required.

Usage:
python silhouette_easy.py
"""

import os
import sys
import glob
from pathlib import Path
from silhouette_generator import create_silhouette, create_simple_silhouette

def get_input_file():
    """Get input file from user"""
    print("=== Silhouette Generator ===\n")
    
    while True:
        print("1. Enter file path manually")
        print("2. Select from current directory")
        print("3. Quit")
        
        choice = input("\nChoose option (1-3): ").strip()
        
        if choice == "1":
            file_path = input("Enter full path to image file: ").strip()
            # Remove quotes if present
            file_path = file_path.strip('"\'')
            
            if os.path.exists(file_path):
                return file_path
            else:
                print(f"File not found: {file_path}\n")
                continue
        
        elif choice == "2":
            # List image files in current directory
            image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.gif', '*.tiff', '*.webp']
            image_files = []
            
            for ext in image_extensions:
                image_files.extend(glob.glob(ext))
                image_files.extend(glob.glob(ext.upper()))
            
            if not image_files:
                print("No image files found in current directory.\n")
                continue
            
            print("\nImage files found:")
            for i, file in enumerate(image_files, 1):
                print(f"{i}. {file}")
            
            try:
                file_num = int(input(f"\nSelect file (1-{len(image_files)}): ")) - 1
                if 0 <= file_num < len(image_files):
                    return image_files[file_num]
                else:
                    print("Invalid selection.\n")
                    continue
            except ValueError:
                print("Please enter a valid number.\n")
                continue
        
        elif choice == "3":
            print("Goodbye!")
            sys.exit(0)
        
        else:
            print("Invalid choice. Please enter 1, 2, or 3.\n")

def get_output_settings(input_file):
    """Get output settings from user"""
    input_name = Path(input_file).stem
    
    # Get output filename
    print(f"\nInput file: {input_file}")
    default_output = f"{input_name}_silhouette.png"
    
    output_file = input(f"Output filename [{default_output}]: ").strip() or default_output
    
    # Ensure .png extension
    if not output_file.lower().endswith('.png'):
        output_file += '.png'
    
    # Get background preference
    print("\nBackground options:")
    print("1. White background (default)")
    print("2. Transparent background")
    
    bg_choice = input("Choose background (1 or 2): ").strip() or "1"
    transparent = bg_choice == "2"
    
    # Get method preference
    print("\nMethod options:")
    print("1. Auto (AI background removal - best quality)")
    print("2. Simple (threshold-based - faster)")
    
    method_choice = input("Choose method (1 or 2): ").strip() or "1"
    method = "auto" if method_choice == "1" else "simple"
    
    return output_file, transparent, method

def main():
    """Main function"""
    try:
        # Get input file
        input_file = get_input_file()
        
        # Get output settings
        output_file, transparent, method = get_output_settings(input_file)
        
        # Confirm settings
        print(f"\n=== Processing Settings ===")
        print(f"Input: {input_file}")
        print(f"Output: {output_file}")
        print(f"Background: {'Transparent' if transparent else 'White'}")
        print(f"Method: {method.title()}")
        
        confirm = input("\nProceed? (y/n): ").strip().lower()
        if confirm not in ['y', 'yes']:
            print("Cancelled.")
            return
        
        # Process the image
        print("\nProcessing...")
        
        background = 'transparent' if transparent else 'white'
        success = False
        
        try:
            if method == 'auto':
                success = create_silhouette(input_file, output_file, background)
            else:
                if transparent:
                    # For simple method with transparency, create temp file first
                    temp_file = output_file.replace('.png', '_temp.png')
                    success = create_simple_silhouette(input_file, temp_file)
                    
                    if success:
                        try:
                            from PIL import Image
                            # Convert white background to transparent
                            img = Image.open(temp_file).convert("RGBA")
                            datas = img.getdata()
                            
                            newData = []
                            for item in datas:
                                # Change white pixels to transparent
                                if item[0] > 200 and item[1] > 200 and item[2] > 200:
                                    newData.append((255, 255, 255, 0))  # Transparent
                                else:
                                    newData.append(item)
                            
                            img.putdata(newData)
                            img.save(output_file, "PNG")
                            os.remove(temp_file)  # Clean up
                            print("Made background transparent.")
                        except Exception as e:
                            print(f"Warning: Could not make background transparent: {e}")
                            if os.path.exists(temp_file):
                                os.rename(temp_file, output_file)
                else:
                    success = create_simple_silhouette(input_file, output_file)
            
            if success:
                print(f"\n✅ Success! Silhouette saved as: {output_file}")
                
                # Ask if user wants to process another image
                again = input("\nProcess another image? (y/n): ").strip().lower()
                if again in ['y', 'yes']:
                    print("\n" + "="*50 + "\n")
                    main()  # Recursive call for another image
            else:
                print("\n❌ Failed to create silhouette.")
                
        except ImportError as e:
            print(f"\n❌ Missing dependencies: {e}")
            print("Please install required packages:")
            print("pip install rembg pillow numpy")
        except Exception as e:
            print(f"\n❌ Error: {e}")
    
    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")

if __name__ == "__main__":
    main()