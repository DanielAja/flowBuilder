#!/usr/bin/env python3
"""
Web-based Silhouette Generator

A simple web interface for creating silhouettes from images.
Features drag-and-drop, transparent background toggle, and file downloads.

Requirements:
- pip install flask werkzeug
- All dependencies from silhouette_generator.py

Usage:
python silhouette_web.py
Then open http://localhost:5000 in your browser
"""

import os
import sys
import tempfile
import uuid
from pathlib import Path
from flask import Flask, render_template_string, request, jsonify, send_file, redirect, url_for
from werkzeug.utils import secure_filename
import threading
import webbrowser

# Import silhouette functions
try:
    from silhouette_generator import create_silhouette, create_simple_silhouette
    from PIL import Image
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Some dependencies not available: {e}")
    DEPENDENCIES_AVAILABLE = False

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Store processing results temporarily
results = {}

# HTML template
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silhouette Generator</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        h1 {
            text-align: center;
            color: #5a5a5a;
            margin-bottom: 30px;
            font-weight: 300;
        }
        
        .drop-zone {
            border: 3px dashed #ccc;
            border-radius: 10px;
            padding: 50px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 20px;
            background: #fafafa;
        }
        
        .drop-zone:hover, .drop-zone.dragover {
            border-color: #667eea;
            background: #f0f4ff;
        }
        
        .drop-zone.processing {
            border-color: #7c3aed;
            background: #f5f3ff;
        }
        
        .drop-text {
            font-size: 18px;
            color: #666;
            margin-bottom: 10px;
        }
        
        .drop-subtext {
            font-size: 14px;
            color: #999;
        }
        
        .options {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .option-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        label {
            font-weight: 500;
            color: #555;
        }
        
        input[type="checkbox"] {
            transform: scale(1.2);
        }
        
        select {
            padding: 8px 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .progress {
            display: none;
            margin: 20px 0;
            text-align: center;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .result {
            display: none;
            margin: 20px 0;
            padding: 20px;
            background: #e8f5e8;
            border: 2px solid #4caf50;
            border-radius: 8px;
            text-align: center;
        }
        
        .result.error {
            background: #ffe8e8;
            border-color: #f44336;
        }
        
        .download-btn {
            display: inline-block;
            padding: 12px 24px;
            background: #4caf50;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 10px;
            transition: background 0.3s;
        }
        
        .download-btn:hover {
            background: #45a049;
        }
        
        .preview {
            max-width: 200px;
            max-height: 200px;
            border-radius: 8px;
            margin: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎭 Silhouette Generator</h1>
        
        <div id="dropZone" class="drop-zone">
            <div class="drop-text">Drop your image here</div>
            <div class="drop-subtext">or click to select a file</div>
            <input type="file" id="fileInput" accept="image/*" class="hidden">
        </div>
        
        <div class="options">
            <div class="option-group">
                <input type="checkbox" id="transparentBg">
                <label for="transparentBg">Transparent Background</label>
            </div>
            
            <div class="option-group">
                <label for="method">Method:</label>
                <select id="method">
                    <option value="auto">Auto (AI Removal)</option>
                    <option value="simple">Simple (Threshold)</option>
                </select>
            </div>
        </div>
        
        <div id="progress" class="progress">
            <div>Processing your image...</div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </div>
        
        <div id="result" class="result">
            <div id="resultMessage"></div>
            <div id="resultContent"></div>
        </div>
        
        <div class="footer">
            Supports JPG, PNG, BMP, GIF, TIFF, WebP formats
        </div>
    </div>

    <script>
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const progress = document.getElementById('progress');
        const result = document.getElementById('result');
        const resultMessage = document.getElementById('resultMessage');
        const resultContent = document.getElementById('resultContent');
        
        // Click to select file
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // File selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });
        
        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
        
        function handleFile(file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/gif', 'image/tiff', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                showResult('Please select a valid image file.', true);
                return;
            }
            
            // Show processing state
            dropZone.classList.add('processing');
            progress.style.display = 'block';
            result.style.display = 'none';
            
            // Create form data
            const formData = new FormData();
            formData.append('image', file);
            formData.append('transparent', document.getElementById('transparentBg').checked);
            formData.append('method', document.getElementById('method').value);
            
            // Upload and process
            fetch('/process', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                dropZone.classList.remove('processing');
                progress.style.display = 'none';
                
                if (data.success) {
                    showResult('Silhouette created successfully! 🎉', false, data.result_id);
                } else {
                    showResult('Error: ' + data.error, true);
                }
            })
            .catch(error => {
                dropZone.classList.remove('processing');
                progress.style.display = 'none';
                showResult('Network error: ' + error.message, true);
            });
        }
        
        function showResult(message, isError, resultId = null) {
            result.style.display = 'block';
            result.className = isError ? 'result error' : 'result';
            resultMessage.textContent = message;
            
            if (resultId) {
                resultContent.innerHTML = `
                    <a href="/download/${resultId}" class="download-btn" download>
                        📥 Download Silhouette
                    </a>
                    <br>
                    <img src="/preview/${resultId}" class="preview" alt="Silhouette preview">
                `;
            } else {
                resultContent.innerHTML = '';
            }
        }
        
        // Animate progress bar
        setInterval(() => {
            const progressFill = document.querySelector('.progress-fill');
            if (progress.style.display !== 'none') {
                const currentWidth = parseInt(progressFill.style.width) || 0;
                progressFill.style.width = ((currentWidth + 5) % 100) + '%';
            }
        }, 200);
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/process', methods=['POST'])
def process_image():
    try:
        if not DEPENDENCIES_AVAILABLE:
            return jsonify({'success': False, 'error': 'Required dependencies not installed'})
        
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'})
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'})
        
        # Get options
        transparent = request.form.get('transparent') == 'true'
        method = request.form.get('method', 'auto')
        
        # Generate unique ID for this processing job
        result_id = str(uuid.uuid4())
        
        # Save uploaded file temporarily
        temp_dir = tempfile.gettempdir()
        input_path = os.path.join(temp_dir, f"input_{result_id}.{file.filename.split('.')[-1]}")
        output_path = os.path.join(temp_dir, f"silhouette_{result_id}.png")
        
        file.save(input_path)
        
        # Process the image
        background = 'transparent' if transparent else 'white'
        success = False
        
        if method == 'auto':
            success = create_silhouette(input_path, output_path, background, smooth_edges=True, blur_radius=1, vector_style=True, crop_to_subject_flag=True, padding=10)
        else:
            if transparent:
                # For simple method with transparency
                temp_path = output_path.replace('.png', '_temp.png')
                success = create_simple_silhouette(input_path, temp_path, smooth_edges=True, blur_radius=1, vector_style=True, crop_to_subject_flag=True, padding=10, background_color='white')
                
                if success:
                    try:
                        # Convert white background to transparent
                        img = Image.open(temp_path).convert("RGBA")
                        datas = img.getdata()
                        
                        newData = []
                        for item in datas:
                            if item[0] > 200 and item[1] > 200 and item[2] > 200:
                                newData.append((255, 255, 255, 0))  # Transparent
                            else:
                                newData.append(item)
                        
                        img.putdata(newData)
                        img.save(output_path, "PNG")
                        os.remove(temp_path)
                    except Exception as e:
                        if os.path.exists(temp_path):
                            os.rename(temp_path, output_path)
            else:
                success = create_simple_silhouette(input_path, output_path, smooth_edges=True, blur_radius=1, vector_style=True, crop_to_subject_flag=True, padding=10, background_color=background)
        
        # Clean up input file
        os.remove(input_path)
        
        if success and os.path.exists(output_path):
            # Store result info
            results[result_id] = {
                'path': output_path,
                'timestamp': os.path.getmtime(output_path)
            }
            
            return jsonify({'success': True, 'result_id': result_id})
        else:
            return jsonify({'success': False, 'error': 'Failed to create silhouette'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/download/<result_id>')
def download_result(result_id):
    if result_id not in results:
        return "Result not found", 404
    
    file_path = results[result_id]['path']
    if not os.path.exists(file_path):
        return "File not found", 404
    
    return send_file(file_path, as_attachment=True, download_name=f'silhouette_{result_id}.png')

@app.route('/preview/<result_id>')
def preview_result(result_id):
    if result_id not in results:
        return "Result not found", 404
    
    file_path = results[result_id]['path']
    if not os.path.exists(file_path):
        return "File not found", 404
    
    return send_file(file_path)

def cleanup_old_results():
    """Clean up old temporary files"""
    import time
    current_time = time.time()
    to_remove = []
    
    for result_id, info in results.items():
        # Remove files older than 1 hour
        if current_time - info['timestamp'] > 3600:
            try:
                if os.path.exists(info['path']):
                    os.remove(info['path'])
                to_remove.append(result_id)
            except:
                pass
    
    for result_id in to_remove:
        del results[result_id]

def open_browser():
    """Open browser after a short delay"""
    import time
    time.sleep(1.5)
    webbrowser.open('http://localhost:8080')

if __name__ == '__main__':
    if not DEPENDENCIES_AVAILABLE:
        print("Error: Required dependencies not available.")
        print("Please install them with:")
        print("pip install rembg pillow numpy onnxruntime flask werkzeug")
        sys.exit(1)
    
    print("Starting Silhouette Generator Web Interface...")
    print("Open your browser to: http://localhost:8080")
    print("Press Ctrl+C to stop the server")
    
    # Start browser opener in separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start cleanup timer
    def periodic_cleanup():
        while True:
            import time
            time.sleep(300)  # Clean up every 5 minutes
            cleanup_old_results()
    
    threading.Thread(target=periodic_cleanup, daemon=True).start()
    
    # Start the web server
    app.run(debug=False, host='localhost', port=8080)