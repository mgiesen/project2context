const fs = require('fs');
const path = require('path');

// Configuration
const EXCLUDED_DIRS = new Set([
    'node_modules',
    'venv',
    '.git',
    '__pycache__',
    'build',
    'dist'
]);

const EXCLUDED_FILES = new Set([
    'package-lock.json',
    'yarn.lock',
    'project-context.txt'
]);

const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.cpp', '.h',
    '.hpp', '.c', '.cs', '.java', '.html', '.css', '.scss', '.sass',
    '.json', '.yml', '.yaml', '.xml', '.env', '.config', '.dockerfile',
    '.sh', '.bat', '.ps1'
]);

const EXCLUDED_EXTENSIONS = new Set([
    '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip',
    '.tar', '.gz', '.rar', '.exe', '.dll', '.pdb', '.pyc'
]);

function getScriptName()
{
    /**
     * Returns the name of the currently executing script.
     */
    const scriptPath = process.argv[1];
    return path.basename(scriptPath);
}

function isTextFile(filePath)
{
    /**
     * Checks if a file is a text file by looking for null bytes.
     */
    try
    {
        const buffer = fs.readFileSync(filePath, { encoding: 'binary', flag: 'r' }).slice(0, 1024);
        return !buffer.includes('\0');
    } catch (error)
    {
        return false;
    }
}

function getFileEncoding(filePath)
{
    /**
     * Detects file encoding by checking for BOM markers.
     */
    try
    {
        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF)
        {
            return 'utf8';  // UTF-8 with BOM
        }
        if (buffer[0] === 0xFF && buffer[1] === 0xFE || buffer[0] === 0xFE && buffer[1] === 0xFF)
        {
            return 'utf16le';  // UTF-16
        }
        if ((buffer[0] === 0xFF && buffer[1] === 0xFE && buffer[2] === 0x00 && buffer[3] === 0x00) ||
            (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0xFE && buffer[3] === 0xFF))
        {
            return 'utf32le';  // UTF-32
        }
        return 'utf8';  // Default to UTF-8
    } catch (error)
    {
        return 'utf8';  // Default to UTF-8 on error
    }
}

function estimateTokens(text)
{
    /**
     * Rough estimation of token count based on word count + special characters.
     */
    const words = text.split(/\s+/).length;
    const specialChars = text.split('').filter(c => !(/[a-zA-Z0-9\s]/).test(c)).length;
    return words + specialChars + Math.floor(words / 4);
}

function shouldProcessFile(filePath)
{
    /**
     * Determines if a file should be processed based on configuration.
     */
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (fileName === getScriptName())
    {
        return false;
    }

    if (EXCLUDED_FILES.has(fileName))
    {
        return false;
    }

    if (EXCLUDED_EXTENSIONS.has(extension))
    {
        return false;
    }

    if (!(TEXT_EXTENSIONS.has(extension) || extension === ''))
    {
        return false;
    }

    return isTextFile(filePath);
}

function generateTree(startPath, outputFile, prefix = "")
{
    /**
     * Generates a directory tree structure.
     */
    const baseName = path.basename(startPath);

    if (EXCLUDED_DIRS.has(baseName))
    {
        return;
    }

    outputFile.write(`${prefix}${baseName}/\n`);

    let items;
    try
    {
        items = fs.readdirSync(startPath, { withFileTypes: true })
            .sort((a, b) =>
            {
                // Sort directories first, then alphabetically
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
    } catch (error)
    {
        outputFile.write(`${prefix}[ACCESS DENIED]\n`);
        return;
    }

    for (let i = 0; i < items.length; i++)
    {
        const item = items[i];
        const isLast = i === items.length - 1;
        const currentPrefix = prefix + (isLast ? "└─ " : "├─ ");
        const nextPrefix = prefix + (isLast ? "   " : "│  ");

        if (item.isDirectory())
        {
            if (!EXCLUDED_DIRS.has(item.name))
            {
                generateTree(path.join(startPath, item.name), outputFile, nextPrefix);
            }
        } else
        {
            const itemPath = path.join(startPath, item.name);
            if (shouldProcessFile(itemPath))
            {
                outputFile.write(`${currentPrefix}${item.name}\n`);
            }
        }
    }
}

function processDirectory(startPath, outputPath)
{
    /**
     * Main function for processing the project directory.
     */
    let totalLines = 0;
    let totalTokens = 0;
    let fileCount = 0;

    const outputFile = fs.createWriteStream(outputPath, { encoding: 'utf8' });

    outputFile.write("<project_overview>\n");
    outputFile.write(`<generated_at>${path.basename(startPath)}</generated_at>\n\n`);

    outputFile.write("<directory_structure>\n");
    generateTree(startPath, outputFile);
    outputFile.write("</directory_structure>\n\n");

    outputFile.write("<file_contents>\n");

    // Walk directory recursively
    function walkDir(dir)
    {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        // Process directories
        const dirs = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => !EXCLUDED_DIRS.has(entry.name))
            .map(entry => entry.name);

        // Process files
        const files = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        for (const file of files)
        {
            const filePath = path.join(dir, file);

            if (shouldProcessFile(filePath))
            {
                try
                {
                    const encoding = getFileEncoding(filePath);
                    const content = fs.readFileSync(filePath, { encoding });

                    const relPath = path.relative(startPath, filePath);
                    outputFile.write(`\n<file path="${relPath}">\n`);
                    outputFile.write(content);
                    outputFile.write("\n</file>\n");

                    totalLines += (content.match(/\n/g) || []).length + 1;
                    totalTokens += estimateTokens(content);
                    fileCount += 1;

                } catch (error)
                {
                    const relPath = path.relative(startPath, filePath);
                    outputFile.write(`\n<error file="${relPath}">${error.message}</error>\n`);
                }
            }
        }

        // Recursively process subdirectories
        for (const subdir of dirs)
        {
            walkDir(path.join(dir, subdir));
        }
    }

    walkDir(startPath);

    outputFile.write("</file_contents>\n");
    outputFile.write("</project_overview>");

    outputFile.end();

    return { fileCount, totalLines, totalTokens };
}

// Main execution
try
{
    const currentDir = process.cwd();
    const outputFile = "project-context.txt";
    const { fileCount, totalLines, totalTokens } = processDirectory(currentDir, outputFile);

    console.log("\nProject Context Generation Complete");
    console.log(`Output file: ${outputFile}`);
    console.log(`Files processed: ${fileCount}`);
    console.log(`Total lines: ${totalLines}`);
    console.log(`Estimated tokens: ${totalTokens}`);

} catch (error)
{
    console.error(`Error: ${error.message}`);
}