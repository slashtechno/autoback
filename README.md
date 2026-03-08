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
docker compose pull && docker compose up -d
```

The container includes Restic and runs migrations automatically on startup. The app runs on port 8433.

### Updating

```bash
docker compose pull && docker compose up -d
```

Migrations run automatically on startup, so no manual database steps are needed.

### Path handling

The host filesystem is mounted at `/host` and `PUBLIC_HOST_PREFIX=/host` is set in `compose.yaml`. Enter paths as they appear on the host (e.g. `/mnt/usb`) — the app prepends `/host` automatically. The UI shows a note when this is active.

To restrict access to specific directories, narrow the volume mount in `compose.yaml`:
```yaml
volumes:
  - /mnt:/host/mnt
```
Or remove `PUBLIC_HOST_PREFIX` entirely to disable prefix behaviour.

## Auto-mounting a USB Drive on plug-in (Linux)

If you're on a CLI-only system, drives may not be automatically mounted when plugged in. Autoback detects drives by watching for the mount-point directory to appear and disappear, so the mount point must not exist when the drive is absent. **Do not use fstab or `x-systemd.automount`** — both leave a permanent stub directory at the mount point, which prevents drive detection from working.

Instead, use a udev rule so the OS mounts the drive (and creates the directory) on plug-in, and unmounts it (and removes the directory) on unplug.

### Easy setup with the included script

```bash
sudo ./manage-udev.sh
```

The script provides a simple menu to add and remove rules. It will show you available drives and their UUIDs, then write the udev rules automatically.

### Manual setup

1. Find the UUID of your drive:
   ```bash
   lsblk -o NAME,SIZE,FSTYPE,UUID,LABEL
   ```

2. Create `/etc/udev/rules.d/99-autoback.rules` with the following, substituting your UUID, mount point, and filesystem type:
   ```
   ACTION=="add",    SUBSYSTEM=="block", ENV{ID_FS_UUID}=="YOUR-UUID", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'mkdir -p /mnt/backup && mount -t ext4 /dev/disk/by-uuid/YOUR-UUID /mnt/backup'"
   ACTION=="remove", SUBSYSTEM=="block", ENV{ID_FS_UUID}=="YOUR-UUID", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'umount -l /mnt/backup; rmdir /mnt/backup'"
   ```

3. Reload udev rules:
   ```bash
   sudo udevadm control --reload-rules
   ```

Plug in the drive — it will be mounted automatically. Configure the same path (`/mnt/backup` in the example) in the Autoback web UI.
