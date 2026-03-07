#!/usr/bin/env bash
# manage-udev.sh — manage autoback hot-plug mount rules
# Must be run as root (sudo ./manage-udev.sh)

RULES_FILE="/etc/udev/rules.d/99-autoback.rules"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root: sudo $0"
    exit 1
fi

list_rules() {
    echo "Current rules:"
    if [[ ! -f "$RULES_FILE" ]] || ! grep -q 'ID_FS_UUID' "$RULES_FILE" 2>/dev/null; then
        echo "  (none)"
        return
    fi
    # Each UUID has two lines (add + remove); extract UUID→mountpoint pairs from the add line
    grep 'ACTION=="add"' "$RULES_FILE" | while IFS= read -r line; do
        uuid=$(echo "$line" | grep -oP 'ID_FS_UUID=="[^"]*"' | grep -oP '"[^"]*"' | tr -d '"')
        mount=$(echo "$line" | grep -oP "mkdir -p \S+" | awk '{print $3}')
        echo "  UUID: $uuid  →  $mount"
    done
}

add_rule() {
    echo ""
    echo "Available block devices:"
    lsblk -o NAME,SIZE,FSTYPE,UUID,LABEL,MOUNTPOINT | grep -v loop
    echo ""

    read -rp "UUID of drive to watch: " uuid
    [[ -z "$uuid" ]] && echo "Cancelled." && return

    read -rp "Mount point (e.g. /mnt/backup): " mount
    [[ -z "$mount" ]] && echo "Cancelled." && return

    read -rp "Filesystem type (e.g. ext4, exfat, vfat) [ext4]: " fstype
    fstype="${fstype:-ext4}"

    if [[ -f "$RULES_FILE" ]] && grep -q "ID_FS_UUID==\"$uuid\"" "$RULES_FILE"; then
        echo "A rule for UUID $uuid already exists."
        return
    fi

    cat >> "$RULES_FILE" <<EOF
ACTION=="add",    SUBSYSTEM=="block", ENV{ID_FS_UUID}=="$uuid", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'mkdir -p $mount && mount -t $fstype /dev/disk/by-uuid/$uuid $mount'"
ACTION=="remove", SUBSYSTEM=="block", ENV{ID_FS_UUID}=="$uuid", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'umount -l $mount; rmdir $mount'"
EOF

    udevadm control --reload-rules
    echo "Rule added for UUID $uuid → $mount (udev reloaded)."
}

remove_rule() {
    if [[ ! -f "$RULES_FILE" ]] || ! grep -q 'ID_FS_UUID' "$RULES_FILE" 2>/dev/null; then
        echo "No rules to remove."
        return
    fi

    echo ""
    mapfile -t uuids < <(grep 'ACTION=="add"' "$RULES_FILE" | grep -oP 'ID_FS_UUID=="[^"]*"' | grep -oP '"[^"]*"' | tr -d '"')

    for i in "${!uuids[@]}"; do
        mount=$(grep "ACTION==\"add\".*ID_FS_UUID==\"${uuids[$i]}\"" "$RULES_FILE" | grep -oP "mkdir -p \S+" | awk '{print $3}')
        echo "  $((i + 1)). UUID: ${uuids[$i]}  →  $mount"
    done
    echo ""

    read -rp "Number to remove (or q to cancel): " choice
    [[ "$choice" == "q" || -z "$choice" ]] && return

    if [[ "$choice" =~ ^[0-9]+$ ]] && ((choice >= 1 && choice <= ${#uuids[@]})); then
        uuid="${uuids[$((choice - 1))]}"
        sed -i "/ID_FS_UUID==\"$uuid\"/d" "$RULES_FILE"
        udevadm control --reload-rules
        echo "Rule for UUID $uuid removed (udev reloaded)."
    else
        echo "Invalid choice."
    fi
}

while true; do
    echo ""
    echo "=== Autoback udev Rule Manager ==="
    list_rules
    echo ""
    echo "1. Add a rule"
    echo "2. Remove a rule"
    echo "3. Reload udev rules"
    echo "4. Exit"
    echo ""
    read -rp "Choice: " choice

    case "$choice" in
        1) add_rule ;;
        2) remove_rule ;;
        3) udevadm control --reload-rules && echo "udev rules reloaded." ;;
        4) exit 0 ;;
        *) echo "Invalid choice." ;;
    esac
done
