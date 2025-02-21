import os
import sys
from pathlib import Path

# Configuration
EXCLUDED_DIRS = {
    'node_modules',
    'venv',
    '.git',
    '__pycache__',
    'build',
    'dist'
}

EXCLUDED_FILES = {
    'package-lock.json',
    'yarn.lock',
    'project-context.txt'
}

TEXT_EXTENSIONS = {
    '.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.cpp', '.h', 
    '.hpp', '.c', '.cs', '.java', '.html', '.css', '.scss', '.sass',
    '.json', '.yml', '.yaml', '.xml', '.env', '.config', '.dockerfile',
    '.sh', '.bat', '.ps1'
}

EXCLUDED_EXTENSIONS = {
    '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip',
    '.tar', '.gz', '.rar', '.exe', '.dll', '.pdb', '.pyc'
}

def get_script_name():
    """Returns the name of the currently executing script."""
    return os.path.basename(sys.argv[0]) if sys.argv[0].endswith('.py') else os.path.basename(__file__)

def is_text_file(file_path):
    """Checks if a file is a text file by looking for null bytes."""
    try:
        with open(file_path, 'rb') as file:
            chunk = file.read(1024)
            return b'\0' not in chunk
    except Exception:
        return False

def get_file_encoding(file_path):
    """Detects file encoding by checking for BOM markers."""
    with open(file_path, 'rb') as file:
        raw = file.read(4)
        if raw.startswith(b'\xef\xbb\xbf'):
            return 'utf-8-sig'
        if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
            return 'utf-16'
        if raw.startswith(b'\xff\xfe\x00\x00') or raw.startswith(b'\x00\x00\xfe\xff'):
            return 'utf-32'
        return 'utf-8'

def estimate_tokens(text):
    """Rough estimation of token count based on word count + special characters."""
    words = len(text.split())
    special_chars = len([c for c in text if not c.isalnum() and not c.isspace()])
    return words + special_chars + (words // 4)

def should_process_file(file_path):
    """Determines if a file should be processed based on configuration."""
    path = Path(file_path)
    
    if path.name == get_script_name():
        return False
        
    if path.name in EXCLUDED_FILES:
        return False
    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return False
    if not (path.suffix.lower() in TEXT_EXTENSIONS or path.suffix == ''):
        return False
    
    return is_text_file(file_path)

def generate_tree(start_path, output_file, prefix=""):
    """Generates a directory tree structure."""
    if os.path.basename(start_path) in EXCLUDED_DIRS:
        return

    output_file.write(f"{prefix}{os.path.basename(start_path)}/\n")
    
    try:
        items = sorted(os.scandir(start_path), key=lambda x: (not x.is_dir(), x.name.lower()))
    except PermissionError:
        output_file.write(f"{prefix}[ACCESS DENIED]\n")
        return
    
    for i, item in enumerate(items):
        is_last = i == len(items) - 1
        current_prefix = prefix + ("└─ " if is_last else "├─ ")
        next_prefix = prefix + ("   " if is_last else "│  ")
        
        if item.is_dir():
            if item.name not in EXCLUDED_DIRS:
                generate_tree(item.path, output_file, next_prefix)
        else:
            if should_process_file(item.path):
                output_file.write(f"{current_prefix}{item.name}\n")

def process_directory(start_path, output_path):
    """Main function for processing the project directory."""
    total_lines = 0
    total_tokens = 0
    file_count = 0
    
    with open(output_path, 'w', encoding='utf-8') as output_file:
        output_file.write("<project_overview>\n")
        output_file.write(f"<generated_at>{os.path.basename(start_path)}</generated_at>\n\n")
        
        output_file.write("<directory_structure>\n")
        generate_tree(start_path, output_file)
        output_file.write("</directory_structure>\n\n")
        
        output_file.write("<file_contents>\n")
        
        for root, dirs, files in os.walk(start_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
            
            for file in sorted(files, key=str.lower):
                file_path = os.path.join(root, file)
                
                if should_process_file(file_path):
                    try:
                        encoding = get_file_encoding(file_path)
                        with open(file_path, 'r', encoding=encoding) as f:
                            content = f.read()
                            
                        rel_path = os.path.relpath(file_path, start_path)
                        output_file.write(f"\n<file path=\"{rel_path}\">\n")
                        output_file.write(content)
                        output_file.write("\n</file>\n")
                        
                        total_lines += content.count('\n') + 1
                        total_tokens += estimate_tokens(content)
                        file_count += 1
                        
                    except Exception as e:
                        output_file.write(f"\n<error file=\"{rel_path}\">{str(e)}</error>\n")

        output_file.write("</file_contents>\n")
        output_file.write("</project_overview>")

    return file_count, total_lines, total_tokens

if __name__ == "__main__":
    try:
        current_dir = os.getcwd()
        output_file = "project-context.txt"
        files, lines, tokens = process_directory(current_dir, output_file)
        
        print(f"\nProject Context Generation Complete")
        print(f"Output file: {output_file}")
        print(f"Files processed: {files}")
        print(f"Total lines: {lines}")
        print(f"Estimated tokens: {tokens}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
