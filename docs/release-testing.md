# Release Testing Guide

This document describes how to validate the auto-update flow end-to-end.

## Prerequisites

1. GitHub repository with secrets configured:
   - `APPLE_CERT_P12_BASE64` - Base64-encoded .p12 certificate
   - `APPLE_CERT_P12_PASSWORD` - Certificate password
   - `APPLE_ID` - Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password for notarization
   - `APPLE_TEAM_ID` - Apple Developer Team ID

2. At least two releases published to GitHub Releases

## Two-Release Upgrade Test

### Step 1: Create Initial Release

1. Ensure `package.json` has initial version (e.g., `1.0.0`)
2. Push a commit with conventional commit message:
   ```bash
   git commit -m "feat: initial release with auto-updates"
   git push origin main
   ```
3. Wait for GitHub Actions to complete
4. Download the DMG from GitHub Releases
5. Install to `/Applications`

### Step 2: Create Second Release

1. Make a small change
2. Push another commit:
   ```bash
   git commit -m "feat: add new feature"
   git push origin main
   ```
3. Wait for GitHub Actions to complete and new release to publish

### Step 3: Validate Update Flow

1. Launch the installed app (older version)
2. Go to Settings → About Screencap
3. Click "Check for Updates"
4. Verify:
   - [ ] Status shows "Update available: vX.X.X"
   - [ ] Version number matches the new release
5. Click "Download Update"
6. Verify:
   - [ ] Progress bar appears
   - [ ] Download completes
7. Click "Restart to Update"
8. Verify:
   - [ ] App quits completely (does not hide to tray)
   - [ ] App relaunches
   - [ ] Version in About shows the new version

## Troubleshooting

### Update check returns "not available" but release exists

- Ensure the release has `latest-mac.yml` artifact
- Check that the release is not a draft or prerelease
- Verify `electron-builder.yml` has correct GitHub publish config

### App hides to tray instead of quitting

- Check that `setIsQuitting(true)` is called before `quitAndInstall()`
- Review `UpdateService.ts` → `restartAndInstall()` function

### Download fails

- Check console logs for network errors
- Verify the zip artifact exists in the GitHub Release
- Ensure the app is code-signed (unsigned apps may have issues)

## Local Development Testing

In development mode (`npm run dev`), updates are disabled. The About section will show:
- Version from `package.json`
- "Updates disabled in development mode" behavior

To test the UI without actual updates:
1. Modify `UpdateService.ts` temporarily to simulate states
2. Or use `dev-app-update.yml` with a test repository
