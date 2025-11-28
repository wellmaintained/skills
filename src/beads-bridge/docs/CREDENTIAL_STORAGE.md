# Credential Storage

## Overview

The beads-bridge plugin stores user credentials (GitHub and Shortcut tokens) in a stable, user-specific location that persists across plugin updates.

## Storage Location

**Default path**: `~/.config/beads-bridge/credentials.json`

This path is:
- **User-specific**: Located in the user's home directory
- **Persistent**: Survives plugin updates, reinstalls, and system upgrades
- **Standard**: Follows XDG Base Directory Specification on Linux/macOS

## Security

Credentials are encrypted using AES-256-GCM with:
- Machine-specific encryption key derived from `homedir():beads-bridge`
- Unique salt and IV per encryption
- Authentication tag for integrity verification

## CRITICAL: Environment Variable Policy

### ❌ NEVER SET CREDENTIAL_STORE_PATH

The `CREDENTIAL_STORE_PATH` environment variable should **NEVER** be set during:
- Plugin installation
- Plugin updates
- Build processes
- CI/CD pipelines
- User workflows

**Why?** Setting this variable could point credentials to:
- Plugin installation directories (which get replaced during updates)
- Temporary directories (which get cleaned up)
- Non-persistent locations (causing credential loss)

### Path Resolution Order

The CredentialStore constructor resolves the storage path in this order:

1. Constructor parameter (for testing only)
2. `process.env.CREDENTIAL_STORE_PATH` (runtime override - use with caution)
3. **Default**: `~/.config/beads-bridge/credentials.json` ← **RECOMMENDED**

```typescript
constructor(filePath?: string) {
  this.filePath = filePath ||
                  process.env.CREDENTIAL_STORE_PATH ||
                  join(homedir(), '.config', 'beads-bridge', 'credentials.json');
}
```

### Validation

The CredentialStore validates that paths:
- Are NOT within plugin installation directories
- Are NOT relative paths that could resolve to plugin directories
- Point to safe, persistent locations

Invalid paths will throw an error during construction.

## Installation Process

### What Happens During Install

The installation script (`scripts/install-beads-bridge.sh`):
1. Downloads binary from GitHub releases
2. Installs to user bin directory (`~/.local/bin` or similar)
3. Makes binary executable
4. **Does NOT set any environment variables**
5. **Does NOT create or modify credential files**

### What Happens During First Use

On first authentication (`beads-bridge auth github` or `beads-bridge auth shortcut`):
1. CredentialStore is instantiated with default path
2. Directory `~/.config/beads-bridge/` is created if needed
3. Credentials are encrypted and saved to default location

### What Happens During Updates

When updating beads-bridge:
1. New binary replaces old binary in `~/.local/bin`
2. Credential file at `~/.config/beads-bridge/credentials.json` is **untouched**
3. User remains authenticated after update

## Testing Credentials

For testing purposes, you can override the credential path:

```typescript
// In tests only
const store = new CredentialStore('/tmp/test-credentials.json');
```

**Never** use environment variables for testing:
```bash
# ❌ BAD - affects global state
export CREDENTIAL_STORE_PATH=/tmp/test-creds.json
beads-bridge auth github

# ✅ GOOD - use dependency injection in tests
const store = new CredentialStore('/tmp/test-creds.json');
```

## Troubleshooting

### Credentials Lost After Update

If users lose credentials after an update, check:

1. **Was CREDENTIAL_STORE_PATH set?**
   ```bash
   echo $CREDENTIAL_STORE_PATH
   # Should be empty
   ```

2. **Does the default path exist?**
   ```bash
   ls -la ~/.config/beads-bridge/credentials.json
   # Should show encrypted file
   ```

3. **Was the plugin directory in a non-standard location?**
   - If plugin was installed in a temporary or custom directory, credentials should still be in `~/.config/beads-bridge/`

### Re-authentication

If credentials are truly lost, simply re-authenticate:

```bash
beads-bridge auth github
beads-bridge auth shortcut
```

Credentials will be saved to the correct persistent location.

## Developer Guidelines

### When Adding New Environment Variables

Before adding any new environment variable to beads-bridge:

1. **Ask**: Could this variable affect credential storage paths?
2. **Validate**: Does it pass through CredentialStore path resolution?
3. **Document**: Add to this file if it touches credentials
4. **Test**: Verify it doesn't break persistence across updates

### When Modifying Installation Scripts

Before modifying `scripts/install-beads-bridge.sh` or build scripts:

1. **Never** set `CREDENTIAL_STORE_PATH`
2. **Never** create credential files during install
3. **Never** modify `~/.config/beads-bridge/` during install
4. **Always** test that credentials survive updates

### Code Review Checklist

- [ ] No `export CREDENTIAL_STORE_PATH` in any scripts
- [ ] No hardcoded paths to plugin directories in CredentialStore
- [ ] Installation scripts don't touch `~/.config/beads-bridge/`
- [ ] Tests use constructor injection, not environment variables
- [ ] Documentation updated if credential storage changes

## See Also

- [Installation Guide](./INSTALLATION.md) - Plugin installation process
- [Architecture](./ARCHITECTURE.md) - System design overview
- `src/auth/credential-store.ts` - Implementation
