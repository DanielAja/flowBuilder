#!/usr/bin/env python3
"""
GUI Wrapper for Silhouette Generator

A drag-and-drop interface for creating silhouettes from images.
Features:
- Drag and drop image files
- Toggle for transparent background
- Output filename dialog
- Progress feedback

Requirements:
- pip install tkinter (usually included with Python)
- All dependencies from silhouette_generator.py
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import os
import sys
import threading
from pathlib import Path
import subprocess
import tempfile

# Import the silhouette generator functions
try:
    from silhouette_generator import create_silhouette, create_simple_silhouette
    import io
    from PIL import Image
    REMBG_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Some dependencies not available: {e}")
    REMBG_AVAILABLE = False


class SilhouetteGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Silhouette Generator")
        self.root.geometry("500x400")
        self.root.configure(bg='#f0f0f0')
        
        # Variables
        self.transparent_bg = tk.BooleanVar(value=False)
        self.processing = False
        
        self.setup_ui()
        self.setup_drag_drop()
    
    def setup_ui(self):
        """Setup the user interface"""
        # Title
        title_label = tk.Label(
            self.root, 
            text="Silhouette Generator", 
            font=("Arial", 16, "bold"),
            bg='#f0f0f0'
        )
        title_label.pack(pady=10)
        
        # Drag and drop area
        self.drop_frame = tk.Frame(
            self.root,
            width=400,
            height=200,
            bg='#e8e8e8',
            relief='dashed',
            bd=2
        )
        self.drop_frame.pack(pady=20, padx=20, fill='both', expand=True)
        self.drop_frame.pack_propagate(False)
        
        # Drop area label
        self.drop_label = tk.Label(
            self.drop_frame,
            text="Drag & Drop Image Here\n\nOr Click to Browse",
            font=("Arial", 12),
            bg='#e8e8e8',
            fg='#666666'
        )
        self.drop_label.pack(expand=True)
        
        # Make drop area clickable
        self.drop_frame.bind("<Button-1>", self.browse_file)
        self.drop_label.bind("<Button-1>", self.browse_file)
        
        # Options frame
        options_frame = tk.Frame(self.root, bg='#f0f0f0')
        options_frame.pack(pady=10)
        
        # Transparent background checkbox
        self.transparent_checkbox = tk.Checkbutton(
            options_frame,
            text="Transparent Background",
            variable=self.transparent_bg,
            font=("Arial", 10),
            bg='#f0f0f0'
        )
        self.transparent_checkbox.pack(side='left', padx=10)
        
        # Method selection
        method_label = tk.Label(
            options_frame, 
            text="Method:", 
            font=("Arial", 10),
            bg='#f0f0f0'
        )
        method_label.pack(side='left', padx=(20, 5))
        
        self.method_var = tk.StringVar(value="auto" if REMBG_AVAILABLE else "simple")
        method_combo = ttk.Combobox(
            options_frame,
            textvariable=self.method_var,
            values=["auto", "simple"] if REMBG_AVAILABLE else ["simple"],
            state="readonly",
            width=8
        )
        method_combo.pack(side='left', padx=5)
        
        # Progress bar
        self.progress_frame = tk.Frame(self.root, bg='#f0f0f0')
        
        self.progress_label = tk.Label(
            self.progress_frame,
            text="",
            font=("Arial", 9),
            bg='#f0f0f0'
        )
        self.progress_label.pack(pady=5)
        
        self.progress_bar = ttk.Progressbar(
            self.progress_frame,
            mode='indeterminate',
            length=300
        )
        self.progress_bar.pack(pady=5)
        
        # Status label
        self.status_label = tk.Label(
            self.root,
            text="Ready to process images",
            font=("Arial", 9),
            bg='#f0f0f0',
            fg='#666666'
        )
        self.status_label.pack(pady=5)
    
    def setup_drag_drop(self):
        """Setup drag and drop functionality"""
        # Register the drop target
        self.drop_frame.drop_target_register('DND_Files')
        self.drop_frame.dnd_bind('<<Drop>>', self.handle_drop)
        
        # For systems without tkinterdnd2, we'll use a simpler approach
        try:
            import tkinterdnd2
            self.root = tkinterdnd2.TkinterDnD.Tk()
            self.root.drop_target_register(tkinterdnd2.DND_FILES)
            self.root.dnd_bind('<<Drop>>', self.handle_drop)
        except ImportError:
            # Fallback: just use click to browse
            pass
    
    def browse_file(self, event=None):
        """Open file browser dialog"""
        filetypes = [
            ("Image files", "*.jpg *.jpeg *.png *.bmp *.gif *.tiff *.webp"),
            ("All files", "*.*")
        ]
        
        filename = filedialog.askopenfilename(
            title="Select Image File",
            filetypes=filetypes
        )
        
        if filename:
            self.process_image(filename)
    
    def handle_drop(self, event):
        """Handle dropped files"""
        try:
            # Get the dropped file path
            files = event.data.split()
            if files:
                file_path = files[0].strip('{}')  # Remove curly braces if present
                self.process_image(file_path)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to handle dropped file: {str(e)}")
    
    def get_output_filename(self, input_path):
        """Get output filename from user"""
        input_name = Path(input_path).stem
        default_name = f"{input_name}_silhouette"
        
        # Ask for output filename
        output_name = simpledialog.askstring(
            "Output Filename",
            "Enter output filename (without extension):",
            initialvalue=default_name
        )
        
        if not output_name:
            return None
        
        # Add appropriate extension
        extension = ".png"
        if not output_name.endswith(extension):
            output_name += extension
        
        # Ask for save location
        output_path = filedialog.asksavefilename(
            title="Save Silhouette As",
            defaultextension=extension,
            initialvalue=output_name,
            filetypes=[("PNG files", "*.png"), ("All files", "*.*")]
        )
        
        return output_path
    
    def update_status(self, message):
        """Update status label"""
        self.status_label.config(text=message)
        self.root.update()
    
    def show_progress(self, show=True, message="Processing..."):
        """Show/hide progress bar"""
        if show:
            self.progress_label.config(text=message)
            self.progress_frame.pack(pady=10)
            self.progress_bar.start(10)
        else:
            self.progress_bar.stop()
            self.progress_frame.pack_forget()
        self.root.update()
    
    def process_image(self, input_path):
        """Process the image in a separate thread"""
        if self.processing:
            messagebox.showwarning("Processing", "Already processing an image. Please wait.")
            return
        
        # Validate input file
        if not os.path.exists(input_path):
            messagebox.showerror("Error", f"File not found: {input_path}")
            return
        
        # Check if it's an image file
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'}
        if Path(input_path).suffix.lower() not in valid_extensions:
            messagebox.showerror("Error", "Please select a valid image file.")
            return
        
        # Get output filename
        output_path = self.get_output_filename(input_path)
        if not output_path:
            return
        
        # Start processing in separate thread
        thread = threading.Thread(
            target=self._process_image_thread,
            args=(input_path, output_path)
        )
        thread.daemon = True
        thread.start()
    
    def _process_image_thread(self, input_path, output_path):
        """Process image in background thread"""
        try:
            self.processing = True
            self.show_progress(True, "Creating silhouette...")
            self.update_status("Processing image...")
            
            # Determine background type
            background = 'transparent' if self.transparent_bg.get() else 'white'
            
            # Process based on selected method
            success = False
            method = self.method_var.get()
            
            if method == 'auto' and REMBG_AVAILABLE:
                success = create_silhouette(input_path, output_path, background)
            else:
                # Use simple method
                if background == 'transparent':
                    # For simple method, we'll create with white background
                    # and then make white pixels transparent
                    temp_path = output_path.replace('.png', '_temp.png')
                    success = create_simple_silhouette(input_path, temp_path)
                    
                    if success:
                        try:
                            # Convert white background to transparent
                            img = Image.open(temp_path).convert("RGBA")
                            datas = img.getdata()
                            
                            newData = []
                            for item in datas:
                                # Change white pixels to transparent
                                if item[0] > 200 and item[1] > 200 and item[2] > 200:
                                    newData.append((255, 255, 255, 0))  # Transparent
                                else:
                                    newData.append(item)
                            
                            img.putdata(newData)
                            img.save(output_path, "PNG")
                            os.remove(temp_path)  # Clean up temp file
                        except Exception as e:
                            print(f"Error making background transparent: {e}")
                            # Fall back to original file
                            if os.path.exists(temp_path):
                                os.rename(temp_path, output_path)
                else:
                    success = create_simple_silhouette(input_path, output_path)
            
            # Update UI in main thread
            self.root.after(0, self._processing_complete, success, output_path)
            
        except Exception as e:
            error_msg = f"Error processing image: {str(e)}"
            self.root.after(0, self._processing_error, error_msg)
    
    def _processing_complete(self, success, output_path):
        """Called when processing is complete"""
        self.processing = False
        self.show_progress(False)
        
        if success:
            self.update_status(f"Silhouette saved: {os.path.basename(output_path)}")
            
            # Ask if user wants to open the result
            result = messagebox.askyesno(
                "Success",
                f"Silhouette created successfully!\n\nSaved as: {output_path}\n\nWould you like to open the result?"
            )
            
            if result:
                # Open the file with default system application
                try:
                    if sys.platform.startswith('darwin'):  # macOS
                        subprocess.run(['open', output_path])
                    elif sys.platform.startswith('win'):  # Windows
                        os.startfile(output_path)
                    else:  # Linux
                        subprocess.run(['xdg-open', output_path])
                except Exception as e:
                    print(f"Could not open file: {e}")
        else:
            self.update_status("Failed to create silhouette")
            messagebox.showerror("Error", "Failed to create silhouette. Please try again.")
    
    def _processing_error(self, error_msg):
        """Called when processing encounters an error"""
        self.processing = False
        self.show_progress(False)
        self.update_status("Error occurred")
        messagebox.showerror("Error", error_msg)


def main():
    """Main function to run the GUI"""
    try:
        # Try to use tkinterdnd2 for better drag and drop support
        import tkinterdnd2
        root = tkinterdnd2.Tk()
    except ImportError:
        # Fall back to regular tkinter
        root = tk.Tk()
        print("Note: Install tkinterdnd2 for better drag-and-drop support: pip install tkinterdnd2")
    
    app = SilhouetteGUI(root)
    
    # Center the window
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')
    
    # Start the GUI
    root.mainloop()


if __name__ == "__main__":
    main()