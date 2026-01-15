# Discord Music Bot 🎵

A feature-rich Discord music bot with slash commands, queue management, and YouTube support.

## Features

- 🎵 Play music from YouTube (URL or search)
- 📋 Queue management
- ⏯️ Pause, resume, skip controls
- 🔊 Volume control
- 📊 Now playing display

## Commands

| Command | Description |
|---------|-------------|
| `/play <query>` | Play a song (YouTube URL or search) |
| `/skip` | Skip the current song |
| `/stop` | Stop and clear queue |
| `/queue` | View the queue |
| `/pause` | Pause playback |
| `/resume` | Resume playback |
| `/nowplaying` | Show current song |
| `/volume <1-100>` | Set volume |

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Bot" section → Click "Add Bot"
4. Copy the **Token** (you'll need this)
5. Go to "OAuth2" → "General" and copy the **Client ID**
6. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent

### 2. Invite Bot to Server

Use this URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3145728&scope=bot%20applications.commands
```

### 3. Deploy to Koyeb

1. Push code to GitHub repository
2. Create new app on [Koyeb](https://koyeb.com)
3. Connect your GitHub repo
4. Set environment variables:
   - `DISCORD_TOKEN` = Your bot token
   - `CLIENT_ID` = Your application client ID
5. Set build command: `npm install`
6. Set run command: `npm start`
7. Deploy!

## Environment Variables

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export DISCORD_TOKEN=your_token
export CLIENT_ID=your_client_id

# Run bot
npm start
```

## Requirements

- Node.js 18+
- FFmpeg (usually pre-installed on Koyeb)

## Troubleshooting

**Bot not responding?**
- Check if bot has proper permissions
- Ensure slash commands are registered (wait 1 hour for global commands)

**Audio issues?**
- Ensure FFmpeg is installed
- Check voice channel permissions

## License

MIT License
