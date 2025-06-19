#!/usr/bin/env python3
"""
Image Silhouette Generator

This script extracts the main subject from an image and creates a black silhouette.
It uses the rembg library for background removal and PIL for image processing.

Requirements:
- pip install rembg pillow numpy

Usage:
python silhouette_generator.py input_image.jpg output_silhouette.png
"""

import sys
import os
import io
from PIL import Image, ImageOps, ImageFilter
import numpy as np
from rembg import remove
from scipy import ndimage
import argparse


def crop_to_subject(img, padding=10, min_size=50):
    """
    Crop image to the bounding box of the subject with optional padding.
    
    Args:
        img (PIL.Image): Input image (RGBA or RGB)
        padding (int): Pixels to add around the subject bounding box
        min_size (int): Minimum dimensions for the cropped image
    
    Returns:
        PIL.Image: Cropped image
    """
    try:
        # Convert to numpy array
        img_array = np.array(img)
        
        if img.mode == 'RGBA':
            # Use alpha channel for detection
            mask = img_array[:, :, 3] > 25  # Threshold for alpha
        else:
            # Use brightness for RGB images (detect non-white areas)
            gray = np.mean(img_array, axis=2)
            mask = gray < 240  # Detect darker areas (non-white/non-background)
        
        # Find bounding box of subject
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        
        if not np.any(rows) or not np.any(cols):
            # No subject found, return original image
            print("Warning: No subject detected for cropping, returning original image")
            return img
        
        # Get bounding box coordinates
        top, bottom = np.where(rows)[0][[0, -1]]
        left, right = np.where(cols)[0][[0, -1]]
        
        # Add padding
        height, width = img_array.shape[:2]
        top = max(0, top - padding)
        bottom = min(height - 1, bottom + padding)
        left = max(0, left - padding)
        right = min(width - 1, right + padding)
        
        # Ensure minimum size
        crop_width = right - left + 1
        crop_height = bottom - top + 1
        
        if crop_width < min_size:
            expand = (min_size - crop_width) // 2
            left = max(0, left - expand)
            right = min(width - 1, right + expand)
        
        if crop_height < min_size:
            expand = (min_size - crop_height) // 2
            top = max(0, top - expand)
            bottom = min(height - 1, bottom + expand)
        
        # Crop the image
        cropped = img.crop((left, top, right + 1, bottom + 1))
        
        print(f"Cropped from {width}x{height} to {cropped.width}x{cropped.height}")
        return cropped
        
    except Exception as e:
        print(f"Warning: Cropping failed ({str(e)}), returning original image")
        return img


def apply_silhouette_filter(img, background_color='white', smooth_edges=True, blur_radius=1, vector_style=True):
    """
    Apply silhouette filter and edge smoothing to an image with transparent background.
    
    Args:
        img (PIL.Image): Input image (should be RGBA with transparent background)
        background_color (str): Background color ('white' or 'transparent')
        smooth_edges (bool): Whether to smooth the edges of the silhouette
        blur_radius (int): Radius for edge smoothing blur (1-8)
        vector_style (bool): Whether to create clean vector-like edges
    
    Returns:
        PIL.Image: Silhouette image
    """
    try:
        print("Applying silhouette filter...")
        
        # Convert image to numpy array for easier manipulation
        img_array = np.array(img)
        
        # Create mask from alpha channel
        alpha_channel = img_array[:, :, 3]
        
        if smooth_edges and not vector_style:
            print("Smoothing edges...")
            # Create a softer alpha mask with gradient edges
            alpha_mask = alpha_channel.astype(float) / 255.0
            
            # Apply multiple gaussian blur passes for ultra-smooth edges
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius)
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius/2)  # Second pass
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius/4)  # Third pass
        elif vector_style:
            print("Creating vector-style edges...")
            # Create clean, sharp edges for vector-like appearance
            alpha_mask = alpha_channel.astype(float) / 255.0
            
            # Apply morphological operations for clean edges (but preserve important gaps)
            from scipy.ndimage import binary_erosion, binary_dilation, binary_opening, binary_closing
            
            # Create binary mask with higher threshold to preserve details
            binary_mask = alpha_mask > 0.3
            
            # Use opening/closing instead of fill_holes to preserve arm gaps
            # Opening removes small noise, closing fills small gaps
            binary_mask = binary_opening(binary_mask, iterations=1)
            binary_mask = binary_closing(binary_mask, iterations=1)
            
            # Very minimal erosion/dilation to clean edges without losing details
            binary_mask = binary_erosion(binary_mask, iterations=1)
            binary_mask = binary_dilation(binary_mask, iterations=1)
            
            # Convert back to float mask
            alpha_mask = binary_mask.astype(float)
            
            # Apply minimal gaussian blur for anti-aliasing only
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=0.3)
        else:
            # Original hard-edge method
            alpha_mask = (alpha_channel > 0).astype(float)
        
        # Create silhouette based on background preference
        if background_color.lower() == 'transparent':
            # Keep transparent background with soft edges
            silhouette = np.zeros((img_array.shape[0], img_array.shape[1], 4), dtype=np.uint8)
            # Create gradient from transparent to black
            silhouette[:, :, 3] = (alpha_mask * 255).astype(np.uint8)  # Alpha channel
            # Black color where alpha > 0 (adjust threshold based on style)
            threshold = 0.05 if not vector_style else 0.1  # Lower threshold for vector style to preserve details
            black_mask = alpha_mask > threshold
            silhouette[black_mask, 0:3] = 0  # RGB to black
            silhouette_img = Image.fromarray(silhouette, 'RGBA')
        else:
            # White background with soft black silhouette
            silhouette = np.ones((img_array.shape[0], img_array.shape[1], 3), dtype=np.uint8) * 255
            # Apply gradient blend from white to black
            for i in range(3):  # RGB channels
                silhouette[:, :, i] = (255 * (1 - alpha_mask)).astype(np.uint8)
            silhouette_img = Image.fromarray(silhouette, 'RGB')
        
        # Additional smoothing with PIL filters if requested
        if smooth_edges and blur_radius > 0 and not vector_style:
            if background_color.lower() == 'transparent':
                # Apply multiple blur passes for even smoother edges
                silhouette_img = silhouette_img.filter(ImageFilter.GaussianBlur(radius=1.5))
                silhouette_img = silhouette_img.filter(ImageFilter.GaussianBlur(radius=0.8))
            else:
                # Apply multiple anti-aliasing filters
                silhouette_img = silhouette_img.filter(ImageFilter.SMOOTH_MORE)
                silhouette_img = silhouette_img.filter(ImageFilter.SMOOTH)
        elif vector_style:
            # Minimal anti-aliasing for vector-style edges
            if background_color.lower() != 'transparent':
                silhouette_img = silhouette_img.filter(ImageFilter.SMOOTH)
        
        return silhouette_img
        
    except Exception as e:
        print(f"Error applying silhouette filter: {str(e)}")
        return img


def create_silhouette(input_path, output_path, background_color='white', smooth_edges=True, blur_radius=1, vector_style=True, crop_to_subject_flag=False, padding=10):
    """
    Create a smooth black silhouette from an input image.
    
    Args:
        input_path (str): Path to input image
        output_path (str): Path to save the silhouette
        background_color (str): Background color ('white' or 'transparent')
        smooth_edges (bool): Whether to smooth the edges of the silhouette
        blur_radius (int): Radius for edge smoothing blur (1-8)
        vector_style (bool): Whether to create clean vector-like edges
        crop_to_subject_flag (bool): Whether to crop image to subject bounds
        padding (int): Padding around subject when cropping
    """
    try:
        # Step 1: Load the input image
        print(f"Step 1: Loading image: {input_path}")
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()
        
        # Step 2: Remove background using rembg
        print("Step 2: Removing background...")
        output_data = remove(input_data)
        
        # Convert to PIL Image with transparent background
        img_with_transparent_bg = Image.open(io.BytesIO(output_data)).convert("RGBA")
        print("Background removal completed")
        
        # Step 3: Apply silhouette filter and edge smoothing
        print("Step 3: Applying silhouette filter and edge smoothing...")
        silhouette_img = apply_silhouette_filter(
            img_with_transparent_bg, 
            background_color=background_color,
            smooth_edges=smooth_edges,
            blur_radius=blur_radius,
            vector_style=vector_style
        )
        
        # Step 4: Crop to subject if requested
        if crop_to_subject_flag:
            print("Step 4: Cropping to subject...")
            silhouette_img = crop_to_subject(silhouette_img, padding=padding)
        
        # Step 5: Save the result
        print(f"Step 5: Saving silhouette: {output_path}")
        silhouette_img.save(output_path)
        print("Silhouette created successfully!")
        
        return True
        
    except Exception as e:
        print(f"Error creating silhouette: {str(e)}")
        return False


def create_simple_silhouette(input_path, output_path, threshold=128, smooth_edges=True, blur_radius=1, vector_style=True, crop_to_subject_flag=False, padding=10, background_color='white'):
    """
    Alternative method using simple thresholding with edge smoothing.
    
    Args:
        input_path (str): Path to input image
        output_path (str): Path to save the silhouette
        threshold (int): Brightness threshold for creating silhouette
        smooth_edges (bool): Whether to smooth the edges
        blur_radius (int): Radius for edge smoothing
        vector_style (bool): Whether to create clean vector-like edges
        crop_to_subject_flag (bool): Whether to crop image to subject bounds
        padding (int): Padding around subject when cropping
        background_color (str): Background color ('white' or 'transparent')
    """
    try:
        # Step 1: Load the input image
        print(f"Step 1: Loading image: {input_path}")
        img = Image.open(input_path)
        
        # Step 2: Remove background using threshold method
        print("Step 2: Removing background using threshold...")
        gray_img = img.convert('L')
        
        # Apply threshold to create binary mask
        binary_img = gray_img.point(lambda x: 0 if x < threshold else 255, '1')
        
        # Create RGBA image with transparent background
        img_rgba = img.convert('RGBA')
        img_array = np.array(img_rgba)
        binary_array = np.array(binary_img)
        
        # Set alpha channel based on threshold
        img_array[:, :, 3] = np.where(binary_array, 0, 255)  # Transparent where binary is white (background)
        
        img_with_transparent_bg = Image.fromarray(img_array, 'RGBA')
        print("Background removal completed")
        
        # Step 3: Apply silhouette filter and edge smoothing
        print("Step 3: Applying silhouette filter and edge smoothing...")
        silhouette_img = apply_silhouette_filter(
            img_with_transparent_bg,
            background_color=background_color,
            smooth_edges=smooth_edges,
            blur_radius=blur_radius,
            vector_style=vector_style
        )
        
        # Step 4: Crop to subject if requested
        if crop_to_subject_flag:
            print("Step 4: Cropping to subject...")
            silhouette_img = crop_to_subject(silhouette_img, padding=padding)
        
        # Step 5: Save the result
        print(f"Step 5: Saving silhouette: {output_path}")
        silhouette_img.save(output_path)
        print("Simple silhouette created successfully!")
        
        return True
        
    except Exception as e:
        print(f"Error creating simple silhouette: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Create black silhouettes from images')
    parser.add_argument('input', help='Input image path')
    parser.add_argument('output', help='Output silhouette path')
    parser.add_argument('--method', choices=['auto', 'simple'], default='auto',
                       help='Method to use: auto (rembg) or simple (threshold)')
    parser.add_argument('--background', choices=['white', 'transparent'], default='white',
                       help='Background color for silhouette')
    parser.add_argument('--threshold', type=int, default=128,
                       help='Threshold value for simple method (0-255)')
    parser.add_argument('--no-smooth', action='store_true',
                       help='Disable edge smoothing for sharp edges')
    parser.add_argument('--blur-radius', type=int, default=1,
                       help='Blur radius for edge smoothing (1-8)')
    parser.add_argument('--no-vector', action='store_true',
                       help='Disable vector-style edges for softer appearance')
    parser.add_argument('--crop', action='store_true',
                       help='Crop image to subject bounds (removes excess background)')
    parser.add_argument('--padding', type=int, default=10,
                       help='Padding around subject when cropping (default: 10)')
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found.")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    success = False
    
    # Edge smoothing settings
    smooth_edges = not args.no_smooth
    blur_radius = max(1, min(8, args.blur_radius))
    vector_style = not args.no_vector
    
    # Cropping settings
    crop_to_subject_flag = args.crop
    padding = max(0, args.padding)
    
    if args.method == 'auto':
        try:
            success = create_silhouette(args.input, args.output, args.background, smooth_edges, blur_radius, vector_style, crop_to_subject_flag, padding)
        except ImportError:
            print("rembg library not found. Install with: pip install rembg")
            print("Falling back to simple method...")
            success = create_simple_silhouette(args.input, args.output, args.threshold, smooth_edges, blur_radius, vector_style, crop_to_subject_flag, padding, args.background)
    else:
        success = create_simple_silhouette(args.input, args.output, args.threshold, smooth_edges, blur_radius, vector_style, crop_to_subject_flag, padding, args.background)
    
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    # Example usage if run without arguments
    if len(sys.argv) == 1:
        print("Image Silhouette Generator")
        print("\nUsage examples:")
        print("python silhouette_generator.py input.jpg output.png")
        print("python silhouette_generator.py input.jpg output.png --method simple")
        print("python silhouette_generator.py input.jpg output.png --background transparent")
        print("\nInstall requirements:")
        print("pip install rembg pillow numpy")
        sys.exit(0)
    
    main()