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


def create_silhouette(input_path, output_path, background_color='white', smooth_edges=True, blur_radius=4):
    """
    Create a smooth black silhouette from an input image.
    
    Args:
        input_path (str): Path to input image
        output_path (str): Path to save the silhouette
        background_color (str): Background color ('white' or 'transparent')
        smooth_edges (bool): Whether to smooth the edges of the silhouette
        blur_radius (int): Radius for edge smoothing blur (1-8)
    """
    try:
        # Load the input image
        print(f"Loading image: {input_path}")
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()
        
        # Remove background using rembg
        print("Removing background...")
        output_data = remove(input_data)
        
        # Convert to PIL Image
        img = Image.open(io.BytesIO(output_data)).convert("RGBA")
        
        # Create silhouette
        print("Creating silhouette...")
        
        # Convert image to numpy array for easier manipulation
        img_array = np.array(img)
        
        # Create mask from alpha channel with gradient for smoother edges
        alpha_channel = img_array[:, :, 3]
        
        if smooth_edges:
            print("Smoothing edges...")
            # Create a softer alpha mask with gradient edges
            alpha_mask = alpha_channel.astype(float) / 255.0
            
            # Apply multiple gaussian blur passes for ultra-smooth edges
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius)
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius/2)  # Second pass
            alpha_mask = ndimage.gaussian_filter(alpha_mask, sigma=blur_radius/4)  # Third pass
            
            # Create gradient silhouette for smoother appearance
            if background_color.lower() == 'transparent':
                # Keep transparent background with soft edges
                silhouette = np.zeros((img_array.shape[0], img_array.shape[1], 4), dtype=np.uint8)
                # Create gradient from transparent to black
                silhouette[:, :, 3] = (alpha_mask * 255).astype(np.uint8)  # Alpha channel
                # Black color where alpha > 0 (reduced threshold for gentler transition)
                black_mask = alpha_mask > 0.05
                silhouette[black_mask, 0:3] = 0  # RGB to black
                silhouette_img = Image.fromarray(silhouette, 'RGBA')
            else:
                # White background with soft black silhouette
                silhouette = np.ones((img_array.shape[0], img_array.shape[1], 3), dtype=np.uint8) * 255
                # Apply gradient blend from white to black
                for i in range(3):  # RGB channels
                    silhouette[:, :, i] = (255 * (1 - alpha_mask)).astype(np.uint8)
                silhouette_img = Image.fromarray(silhouette, 'RGB')
        else:
            # Original hard-edge method
            alpha_mask = alpha_channel > 0
            
            if background_color.lower() == 'transparent':
                # Keep transparent background
                silhouette = np.zeros_like(img_array)
                silhouette[alpha_mask] = [0, 0, 0, 255]  # Black with full alpha
                silhouette_img = Image.fromarray(silhouette, 'RGBA')
            else:
                # White background with black silhouette
                silhouette = np.ones((img_array.shape[0], img_array.shape[1], 3), dtype=np.uint8) * 255
                silhouette[alpha_mask] = [0, 0, 0]  # Black silhouette
                silhouette_img = Image.fromarray(silhouette, 'RGB')
        
        # Additional smoothing with PIL filters if requested
        if smooth_edges and blur_radius > 0:
            if background_color.lower() == 'transparent':
                # Apply multiple blur passes for even smoother edges
                silhouette_img = silhouette_img.filter(ImageFilter.GaussianBlur(radius=1.5))
                silhouette_img = silhouette_img.filter(ImageFilter.GaussianBlur(radius=0.8))
            else:
                # Apply multiple anti-aliasing filters
                silhouette_img = silhouette_img.filter(ImageFilter.SMOOTH_MORE)
                silhouette_img = silhouette_img.filter(ImageFilter.SMOOTH)
        
        # Save the result
        print(f"Saving silhouette: {output_path}")
        silhouette_img.save(output_path)
        print("Silhouette created successfully!")
        
        return True
        
    except Exception as e:
        print(f"Error creating silhouette: {str(e)}")
        return False


def create_simple_silhouette(input_path, output_path, threshold=128, smooth_edges=True, blur_radius=4):
    """
    Alternative method using simple thresholding with edge smoothing.
    
    Args:
        input_path (str): Path to input image
        output_path (str): Path to save the silhouette
        threshold (int): Brightness threshold for creating silhouette
        smooth_edges (bool): Whether to smooth the edges
        blur_radius (int): Radius for edge smoothing
    """
    try:
        print(f"Loading image: {input_path}")
        img = Image.open(input_path)
        
        # Convert to grayscale
        gray_img = img.convert('L')
        
        if smooth_edges:
            print("Creating smooth silhouette...")
            # Apply gaussian blur before thresholding for smoother edges
            gray_img = gray_img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
            
            # Create gradient threshold instead of hard binary
            gray_array = np.array(gray_img)
            
            # Create soft transition around threshold (increased for smoother gradient)
            transition_width = 60
            lower_thresh = max(0, threshold - transition_width//2)
            upper_thresh = min(255, threshold + transition_width//2)
            
            # Create gradient mask
            silhouette_array = np.ones_like(gray_array, dtype=np.uint8) * 255
            
            # Hard black for dark areas
            silhouette_array[gray_array < lower_thresh] = 0
            
            # Gradient transition
            transition_mask = (gray_array >= lower_thresh) & (gray_array <= upper_thresh)
            if np.any(transition_mask):
                gradient_values = (gray_array[transition_mask] - lower_thresh) / transition_width * 255
                silhouette_array[transition_mask] = gradient_values.astype(np.uint8)
            
            silhouette = Image.fromarray(silhouette_array, 'L')
            
            # Apply additional smoothing with multiple passes
            silhouette = silhouette.filter(ImageFilter.SMOOTH_MORE)
            silhouette = silhouette.filter(ImageFilter.SMOOTH)
            silhouette = silhouette.filter(ImageFilter.GaussianBlur(radius=0.5))
        else:
            # Original hard-edge method
            # Apply threshold to create binary image
            binary_img = gray_img.point(lambda x: 0 if x < threshold else 255, '1')
            
            # Invert to make subject black
            silhouette = ImageOps.invert(binary_img)
        
        # Convert back to RGB
        silhouette_rgb = silhouette.convert('RGB')
        
        # Save the result
        print(f"Saving silhouette: {output_path}")
        silhouette_rgb.save(output_path)
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
    parser.add_argument('--blur-radius', type=int, default=4,
                       help='Blur radius for edge smoothing (1-8)')
    
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
    
    if args.method == 'auto':
        try:
            success = create_silhouette(args.input, args.output, args.background, smooth_edges, blur_radius)
        except ImportError:
            print("rembg library not found. Install with: pip install rembg")
            print("Falling back to simple method...")
            success = create_simple_silhouette(args.input, args.output, args.threshold, smooth_edges, blur_radius)
    else:
        success = create_simple_silhouette(args.input, args.output, args.threshold, smooth_edges, blur_radius)
    
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