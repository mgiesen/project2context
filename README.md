# Project2Context

Generates a structured overview of your project for AI context. The script scans your codebase and creates a single file containing your project's structure and content, making it easy to provide context to Large Language Models.

## Usage

1. Place `project2context.py` or `project2context.js` in your project's root directory
2. Run the script:

   ```bash
   # Python version
   python project2context.py

   # Node.js version
   node project2context.js
   ```

3. Find the generated `project-context.txt` in your project root

### Specifying Target Directory

You can limit processing to a specific subdirectory:

```bash
# Process only subdirectories
node project2context.js [target_directory]

# Examples
node project2context.js frontend
node project2context.js frontend/css
```

## Requirements

- Python 3.6+ or Node.js 12.0+
- No additional packages required

## Configuration

Edit these sets at the start of the script to customize:

- `EXCLUDED_DIRS`: Directories to skip (e.g., node_modules)
- `EXCLUDED_FILES`: Specific files to ignore
- `TEXT_EXTENSIONS`: File types to include
- `EXCLUDED_EXTENSIONS`: File types to skip

## Output

The script generates `project-context.txt` containing:

- Directory tree structure
- Content of all text files
