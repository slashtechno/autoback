# Autoback

A utility to automatically back up specific drives, when plugged in, using snapshots. Scans `/media`/`/mnt` (or any other dir) for a specific drive name (using the folder name), and when attached, backs up the drive using Restic. If the drive is unplugged during backup, the backup will be abandoned, but because of Restic's design, this isn't horrible, as the next backup still only needs to back up changed files.

The goal of this project is to be able to plug in the portable SSD that I work off of into my Raspberry Pi and have it automatically back up without me needing to initiate anything. A web UI provides a dashboard to view backup status, logs, and manage backup settings. A SQLite database is used and BetterAuth handles authentication. In addition to configuration, the web UI allows for snapshot management (restore, download, delete).

## To get started:

1. Clone the repository and navigate to the project directory.
   a. `git clone https://github.com/slashtechno/autoback`
   b. `cd autoback`
2. Install dependencies (bun is preferred, but npm/pnpm should also work).
   a. `bun install`
3. Copy `.env.example` to `.env` and fill in the required environment variables.
   a. `cp .env.example .env`

## Running in Production

```bash
docker compose up -d --build
```

The container includes Restic and runs migrations automatically on startup. The app runs on port 8433.

### Path handling

The host filesystem is mounted at `/host` and `PUBLIC_HOST_PREFIX=/host` is set in `compose.yaml`. Enter paths as they appear on the host (e.g. `/mnt/usb`) — the app prepends `/host` automatically. The UI shows a note when this is active.

To restrict access to specific directories, narrow the volume mount in `compose.yaml`:
```yaml
volumes:
  - /mnt:/host/mnt
```
Or remove `PUBLIC_HOST_PREFIX` entirely to disable prefix behaviour.

## Mounting a USB Drive on boot (Linux)

If you're on a CLI-only system, drives may not be automatically mounted when plugged in. Here's how to set up auto-mounting for a drive on boot:

1. Run `lsblk` to identify the drive and partition you want to back up (e.g., `/dev/sda1`).  
   a. `lsblk -o NAME,SIZE,TYPE,FSTYPE,VENDOR,MODEL,SERIAL,TRAN,UUID,MOUNTPOINTS # Get more detailed info, including UUIDs. Look for the drive by its name, size, or other identifying info.`.
   - If it already has a mountpoint, you can use that, but for the purposes of this guide, we'll assume it doesn't and we need to set it up to auto-mount on boot.

2. Create a mount point for the drive (e.g., `/mnt/drive-to-backup`).  
   a. `sudo mkdir /mnt/drive-to-backup`.

3. Try mounting a drive temporarily, then unmount it (when we set up fstab it'll get mounted again).
   a. `sudo mount /dev/sda1 /mnt/drive-to-backup`  
   b. `ls /mnt/drive-to-backup # Check that the drive is mounted and you can see its contents`  
   c. `sudo umount /mnt/drive-to-backup`

4. Edit `/etc/fstab` to add an entry for the drive so it mounts on boot.  
   a. `sudo nano /etc/fstab` (or use your preferred text editor).
   b. Add the following line, replacing the uuid with the actual UUID of drive and the file system type (e.g., `ext4`, `exfat`, etc.):
   ```
   UUID=your-drive-uuid /mnt/drive-to-backup your-filesystem-type defaults,nofail 0 0
   ```
   c. Save and exit the editor
5. Test the fstab entry without rebooting:  
   a. `sudo mount -a`  
   b. If this command runs and you can see the drive's contents at `/mnt/drive-to-backup`, then it's set up correctly. If you get an error, double-check the UUID, file system type, and syntax in your fstab entry.

6. Reboot your system to confirm that the drive mounts automatically on boot
