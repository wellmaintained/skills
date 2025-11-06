# Authentication Guide

## Overview

beads-bridge v2.0 uses direct API authentication instead of CLI tools:
- **GitHub**: OAuth 2.0 device flow (no browser required)
- **Shortcut**: API token from user settings

## GitHub Authentication

### First-Time Setup

Run the interactive authentication command:

```bash
beads-bridge auth github
```

This will:
1. Request a device code from GitHub
2. Display a verification URL and code
3. Wait for you to authorize the app in your browser
4. Save the access token securely

### Required Scopes

The default scopes are:
- `repo` - Access repositories
- `read:org` - Read organization data
- `read:project` - Access GitHub Projects v2

### Re-authentication

If your token expires or you need different scopes:

```bash
beads-bridge auth github --scopes "repo,read:org,read:project,write:project"
```

## Shortcut Authentication

### Setup

Get your API token from Shortcut settings:
1. Go to https://app.shortcut.com/settings/account/api-tokens
2. Create a new API token
3. Run:

```bash
beads-bridge auth shortcut
```

4. Enter your token when prompted

Or provide token directly:

```bash
beads-bridge auth shortcut --token YOUR_TOKEN_HERE
```

## Managing Credentials

### Check Authentication Status

```bash
beads-bridge auth status
```

Shows which services are authenticated and what scopes are available.

### Clear Credentials

```bash
beads-bridge auth clear
```

Removes all stored credentials. Use `--confirm` to skip the confirmation prompt.

## Security

**Credential Storage:**
- Location: `~/.config/beads-bridge/credentials.json`
- Encryption: AES-256-GCM with machine-specific key derivation
- Key derivation: scrypt with salt using homedir as password base

**Best Practices:**
- Never commit credentials to git
- Use minimal required scopes
- Rotate tokens periodically
- Clear credentials on shared machines

## Troubleshooting

### "Authentication failed"

Check that you completed the GitHub device flow in your browser.

### "Token expired"

Re-authenticate:

```bash
beads-bridge auth github
```

### "Permission denied"

Your token might need additional scopes:

```bash
beads-bridge auth github --scopes "repo,read:org,read:project,write:project"
```

### "Cannot find credentials file"

This is normal for first-time setup. Run:

```bash
beads-bridge auth status
```

To see what needs authentication.
