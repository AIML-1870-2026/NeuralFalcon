# claude always remember
never do anything outside of the speeralam/scottAIclass folder. alkways ask for permission when doing anything in command line or creating/editing a file
# AIML 1870 - The Royal Decree

## Configuration
UserGamertag: "NeuralFalcon"
Organization: "AIML-1870-2026"

## Project Structure
This folder is your entire AIML 1870 portfolio. It is a single git repository
containing all your assignments as subfolders.

Structure:
- Root folder = Your Gamertag (this IS the git repo)
- Each assignment = A subfolder (NOT a separate repo)
- CLAUDE.md = Lives at the root, governs everything

## Commands

### Deploy
When I say "Deploy":

1. **Verify Location**
   - Confirm we're inside the Gamertag folder (or a subfolder of it)
   - Check that .git exists at the root level

2. **Pre-Deploy Check**
   - Remind the user to check "web doctor", then push immediately without waiting for confirmation.

3. **Stage and Commit**
   - `git add .`
   - `git commit -m "Update: [describe what changed]"`

4. **Push**
   - `git push origin main`

5. **Report Success**
   - Confirm the push succeeded
   - Remind me of my live URL: https://aiml-1870-2026.github.io/[Gamertag]/

### New Assignment
When I say "Start [AssignmentName]":

1. Create a folder called `[AssignmentName]` directly inside `NeuralFalcon/` (NOT in the root)
2. Create a starter `index.html` inside it
3. Create a `CLAUDE.md` inside the new folder containing exactly: `@../CLAUDE.md` — this ensures the root instructions apply when the subfolder is opened as a workspace
4. Update `NeuralFalcon/index.html` with a link to the new project
5. Tell me the folder is ready

**All new projects must be created inside `NeuralFalcon/` so they are part of the GitHub Pages portfolio.**

**Always deploy automatically after finishing a project or adding it to NeuralFalcon. Do not ask — just deploy. Remind the user to check "web doctor" but push immediately without waiting.**

### Show My URLs
When I say "Show my URLs" or "Where's my stuff?":

1. List all subfolders that contain an index.html
2. For each, show the live URL pattern

## Coding Standards
- All projects must be split into separate files: `index.html`, `style.css`, and `game.js` (or appropriate `.js` name)
- No personally identifiable information in code or comments
- Use descriptive folder names (e.g., "Julia-Set-Explorer" not "assignment3")
- **Always consider color theory when designing UIs and visuals.** Choose complementary, analogous, or triadic color schemes. Ensure good contrast, visual harmony, and accessibility (WCAG contrast ratios).

## File Naming
- Main file: `index.html`
- Assets: lowercase, hyphens (e.g., `particle-system.js`)
- Assignment folders: Descriptive names or `Assignment-XX`
- **Never use spaces or underscores in folder/file names that appear in URLs.** Use hyphens instead (e.g., `Julia-Set-Explorer` not `Julia Set Explorer` or `Julia_Set_Explorer`)

## Adding Projects to GitHub Pages Portfolio

The portfolio repo is located at: `/Users/speeralam/scottAIClass/NeuralFalcon/`
Remote: `https://github.com/AIML-1870-2026/NeuralFalcon.git`

### Steps to Add a Project:

1. **Check for nested .git folders**
   - If the project folder has its own `.git` folder, remove it first:
   - `rm -rf "/path/to/project/.git"`

2. **Copy project to NeuralFalcon folder**
   - Use hyphenated folder names (no spaces) for clean URLs
   - Example: `cp -r "/path/to/project" "/Users/speeralam/scottAIClass/NeuralFalcon/project-name"`

3. **Verify files copied correctly**
   - Ensure `index.html` exists in the project folder

4. **Update root index.html**
   - Add a link to the new project in `/Users/speeralam/scottAIClass/NeuralFalcon/index.html`
   - Example: `<li><a href="project-name/">Project Name</a></li>`

5. **Push to GitHub**
   ```bash
   cd /Users/speeralam/scottAIClass/NeuralFalcon
   git add .
   git commit -m "Add [project name]"
   git push origin main
   ```

6. **Wait for GitHub Pages to rebuild** (1-2 minutes)

### Live URLs
- Portfolio home: https://aiml-1870-2026.github.io/NeuralFalcon/
- Projects: https://aiml-1870-2026.github.io/NeuralFalcon/[folder-name]/

## Finding YouTube Video IDs Quickly
When you need a YouTube video ID:
1. Use WebFetch on `https://www.youtube.com/results?search_query=SEARCH+TERMS` and extract video IDs from the response
2. Or ask the user to paste the YouTube URL — the ID is the `v=` parameter (e.g. `youtube.com/watch?v=XXXXXXXXXXX` → ID is `XXXXXXXXXXX`)
3. Don't waste time doing dozens of web searches — just ask the user if the first attempt fails
