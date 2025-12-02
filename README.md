# zyBAuto — zyBooks userscript

zyBAuto is a single-file userscript that automates repetitive, time-consuming interactions on zyBooks (e.g., the "play and watch" style activities). This repository now contains and maintains the userscript itself so you can install or review the script directly from this project.

Important: use this tool only in accordance with your institution's academic integrity policies. Automating coursework may violate rules where you study.

## What changed
- The userscript is now the canonical file in this repository (no upstream external install URL).
- Installation and updates can be done from the raw userscript file in this repo.
- The README and links have been updated to point to this repository as the source of truth.

## Compatibility
- Browser extensions supported: Tampermonkey (Chrome, Edge, others), Greasemonkey (Firefox), Violentmonkey.
- Modern desktop browsers. Mobile browser support is not guaranteed.

## Installation

1. Install a userscript manager:
   - Tampermonkey (recommended) — Chrome, Edge, Firefox, Safari, etc.
   - Greasemonkey — Firefox.
   - Violentmonkey — alternative userscript manager.

2. Install the script:
   - Option A — Install directly from the raw file:
     - Open the userscript manager and choose the "Install" option or click the raw userscript URL for your browser.
     - Raw URL:  
       [Click Me](https://github.com/RobThePCGuy/zyBooks-Autocomplete/raw/refs/heads/master/zyBAuto.user.js)
     - If you prefer a specific commit or tag, replace `master` with the commit SHA or tag name.
   - Option B — Manual:
     - Download the userscript file (zyBAuto.user.js) from this repository and open it in the userscript manager to install.

3. After installation:
   - Visit your zyBooks course page.
   - If you do not see the "Automate!" button, refresh the page (Ctrl+F5).
   - Click "Automate!" once to start automation for the session.

## Usage & Controls
- Press the "Automate!" button on zyBooks to start.
- Open Developer Tools (F12) → Console to see logs and actions the script performs.
- To temporarily disable: refresh the zyBooks page (Ctrl+F5). To completely uninstall, remove the script from your userscript manager.
- The userscript may include metadata to support automatic updates via your userscript manager; check the manager settings for update frequency.

## Current Features
- Automates "play and watch" style activities where repeated Play clicks and timers are required.
- Self-updating metadata so the userscript can be updated through your userscript manager (depends on manager settings).

## Planned / Possible Future Features
- Automate multiple-choice questions (where safe and feasible).
- Automate "Check Answer" style interactions.
- Automate drag-and-drop style exercises.
- More granular configuration options (timeouts, logging levels, enable/disable specific activity types).

## Configuration & Debugging
- Logs: open the browser console (F12) to view what the script is doing.
- If the script stops working after a zyBooks update, please open an issue with a short description and a link to the affected zyBooks page (if allowed).
- When reporting issues include browser, userscript manager and script version (shown in the userscript manager).

## Safety & Ethics
- This script performs automated interactions on websites. Use responsibly and only where permitted.
- Do not use automation to cheat on graded coursework if doing so would violate rules or policies.

## Contributing
- Bug reports, feature requests and pull requests are welcome.
- Please open an issue describing the problem or the enhancement you want.
- When submitting PRs, prefer small, focused changes and include notes about how you tested them.

## License
- Check the repository for an explicit LICENSE file. If none is present, contact the repository owner for licensing details.

## Where to find the userscript
- The userscript file (zyBAuto.user.js) is included in this repository. Use the raw file URL from this repo to install or inspect the script.
- Credit to the original script from Evanito @ [Evanito](https://github.com/Evanito/zyBAuto/)
