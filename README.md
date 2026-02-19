# Wotti - Modern Chat UI

A modern, modular chat application interface built with vanilla JavaScript following best practices for maintainability and scalability.

## Project Structure

```
Wotti/
├── index.html                 # Main HTML entry point
├── script.js                  # Application entry point
├── assets/                    # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
├── components/                # UI components
│   ├── contacts/
│   │   ├── ContactsSidebar.js
│   │   ├── ContactItem.js
│   │   └── contacts.css
│   ├── chat/
│   │   ├── ChatArea.js
│   │   ├── ChatPlaceholder.js
│   │   └── chat.css
│   └── menu/
│       ├── SideMenu.js
│       └── menu.css
├── services/                  # Business logic services
│   ├── contactService.js
│   └── messageService.js
├── utils/                     # Utility functions
│   ├── avatarUtils.js
│   ├── domUtils.js
│   └── timeUtils.js
├── config/                    # Configuration and constants
│   └── constants.js
├── styles/                    # Global styles
│   ├── main.css              # CSS variables and global styles
│   ├── utilities.css        # Utility classes
│   └── components.css       # Shared component styles
└── tests/                     # Test files
    ├── unit/
    └── integration/
```

## Architecture

The project follows a modular architecture with clear separation of concerns:

- **Components**: Reusable UI components with their own JavaScript and CSS
- **Services**: Business logic and data management
- **Utils**: Pure utility functions for common operations
- **Config**: Application constants and configuration
- **Styles**: Organized CSS with component-specific stylesheets

## Color Palette

The application uses a simplified 5-color palette defined in `styles/main.css`:

- White: `#ffffff`
- Light Grey: `#f5f5f5aa`
- Medium Grey: `#9ca3af`
- Dark Grey: `#1a1a1a`
- Green: `#10b981`

All colors are accessed via CSS variables: `var(--color-white)`, `var(--color-light-grey)`, etc.

## Development

The application uses ES6 modules. To run locally, serve the files through a web server (modules require HTTP/HTTPS protocol).

### Running Locally

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Code Style

- **Variables and functions**: camelCase
- **Components and classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Single responsibility**: Each module has one clear purpose
- **Separation of concerns**: Structure, styling, and logic are separated

## Deployment on VPS

To run Wotti on your VPS (e.g. 187.77.87.208) and pull the app from GitHub:

### First-time setup on the VPS

1. **SSH into the server:**
   ```bash
   ssh root@187.77.87.208
   ```

2. **Download and run the setup script** (installs Node, clones repo, npm install, PM2):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/depaxton/Wotti/main/scripts/setup-vps.sh -o setup-vps.sh
   chmod +x setup-vps.sh
   sudo ./setup-vps.sh
   ```
   Or, if you already have the repo cloned locally, copy the script to the server and run it:
   ```bash
   scp scripts/setup-vps.sh root@187.77.87.208:~/
   ssh root@187.77.87.208 "chmod +x ~/setup-vps.sh && ~/setup-vps.sh"
   ```

3. **Optional – CORS and Gemini on VPS:**  
   - So the browser can talk to the API from `http://187.77.87.208:5000`, set before starting:
     ```bash
     export PUBLIC_URL="http://187.77.87.208:5000"
     ```
     (You can add this to `~/.bashrc` or run PM2 with env, e.g. `PUBLIC_URL=... pm2 start ...`.)  
   - Create `config/gemini-config.json` on the server with your Gemini API key, or set `GEMINI_API_KEY` in the environment.

4. **Open in browser:**  
   `http://187.77.87.208:5000`

### Updating the app on the VPS

From your **local machine** (after pushing to GitHub), run:

```bash
./deploy.sh
```

This will SSH to the VPS, pull the latest code into `/root/Wotti`, and restart the app with PM2.

### Useful PM2 commands on the VPS

- `pm2 status` – see status  
- `pm2 logs whatsapp-bot` – view logs  
- `pm2 restart whatsapp-bot` – restart  
- `pm2 stop whatsapp-bot` / `pm2 start whatsapp-bot` – stop/start  

---

## Auto-Update System

Wotti includes an automatic update system that allows remote updates to all users. 

### How It Works

1. **Update Release**: Developer creates an update package and uploads it to a server
2. **Version Check**: Application checks for updates every 10 minutes (configurable)
3. **Automatic Download**: If update is available, it's downloaded automatically
4. **Automatic Installation**: Update is installed, npm dependencies updated, and app restarts

### Configuration

Edit `config/updateConfig.js` to configure:
- Update check URL (where `version.json` is hosted)
- Check interval (default: 10 minutes)
- Auto-update enabled/disabled
- Update notification settings

### For Developers

See `UPDATE-PROCESS.md` for detailed instructions on releasing updates.

When you want to release an update, simply say:
- "שחרר עדכון" / "Release update"
- "הכן עדכון" / "Prepare update"

The system will guide you through creating the update package.

## Future Enhancements

- Message sending and receiving functionality
- Real-time updates
- Contact search and filtering
- Message history persistence
- User authentication
- Update notification UI component

