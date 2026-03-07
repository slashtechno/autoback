#!/usr/bin/env bash
# manage-udev.sh — manage autoback hot-plug mount rules
# Must be run as root (sudo ./manage-udev.sh)

RULES_FILE="/etc/udev/rules.d/99-autoback.rules"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root: sudo $0"
    exit 1
fi

hr() { printf '%.0s─' $(seq 1 "${COLUMNS:-72}"); echo; }

# ── list configured rules ──────────────────────────────────────────────────────

list_rules() {
    hr
    printf '  %-36s  %s\n' "UUID" "Mount point"
    hr
    if [[ ! -f "$RULES_FILE" ]] || ! grep -q 'ACTION=="add"' "$RULES_FILE" 2>/dev/null; then
        echo "  (no rules configured)"
    else
        local i=1
        while IFS= read -r line; do
            local uuid mount
            uuid=$(echo "$line" | grep -oP 'ID_FS_UUID=="[^"]*"' | tr -d 'ID_FS_UUID="')
            mount=$(echo "$line" | grep -oP "mkdir -p \S+" | awk '{print $3}')
            printf '  %d.  %-36s  %s\n' "$i" "$uuid" "$mount"
            ((i++))
        done < <(grep 'ACTION=="add"' "$RULES_FILE")
    fi
    hr
}

# ── build a selectable list of partitions from lsblk ──────────────────────────
# Partitions don't carry VENDOR/MODEL/SERIAL — those live on the parent disk row.
# We track the current disk's metadata and stamp it on each child partition.

build_partition_list() {
    part_names=()
    part_uuids=()
    part_fstypes=()
    part_labels=()
    part_mounts=()
    part_infos=()   # "Vendor Model  S/N: SERIAL" inherited from parent disk

    local cur_vendor="" cur_model="" cur_serial=""

    while IFS= read -r line; do
        # Declare locals to avoid leaking between iterations
        local NAME="" TYPE="" VENDOR="" MODEL="" SERIAL="" FSTYPE="" LABEL="" UUID="" MOUNTPOINT=""
        eval "$line"

        if [[ "$TYPE" == "disk" ]]; then
            # Trim Samsung's space-padded vendor string
            cur_vendor="${VENDOR//[[:space:]]/}"
            cur_model="$MODEL"
            cur_serial="$SERIAL"
        fi

        if [[ -n "$UUID" ]]; then
            part_names+=("$NAME")
            part_uuids+=("$UUID")
            part_fstypes+=("$FSTYPE")
            part_labels+=("$LABEL")
            part_mounts+=("$MOUNTPOINT")
            local info="${cur_vendor:+$cur_vendor }${cur_model:+$cur_model}${cur_serial:+  S/N: $cur_serial}"
            part_infos+=("$info")
        fi
    done < <(lsblk --exclude 7 -P -o NAME,TYPE,VENDOR,MODEL,SERIAL,FSTYPE,LABEL,UUID,MOUNTPOINT)
}

# ── add a rule ─────────────────────────────────────────────────────────────────

add_rule() {
    build_partition_list

    if [[ ${#part_uuids[@]} -eq 0 ]]; then
        echo "  No partitions with UUIDs found. Is the drive plugged in?"
        return
    fi

    echo ""
    hr
    printf '  %-5s  %-6s  %-8s  %-36s  %-20s  %s\n' \
        "No." "Name" "FS" "UUID" "Drive" "Label / Mount"
    hr
    for i in "${!part_uuids[@]}"; do
        local label_or_mount=""
        [[ -n "${part_labels[$i]}" ]]  && label_or_mount="${part_labels[$i]}"
        [[ -n "${part_mounts[$i]}" ]]  && label_or_mount+=" [${part_mounts[$i]}]"
        printf '  %-5s  %-6s  %-8s  %-36s  %-20s  %s\n' \
            "$((i + 1))." \
            "${part_names[$i]}" \
            "${part_fstypes[$i]:-—}" \
            "${part_uuids[$i]}" \
            "${part_infos[$i]}" \
            "$label_or_mount"
    done
    hr
    echo ""

    read -rp "  Select partition number (or q to cancel): " choice
    [[ "$choice" == "q" || -z "$choice" ]] && return
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || ((choice < 1 || choice > ${#part_uuids[@]})); then
        echo "  Invalid choice."
        return
    fi

    local idx=$((choice - 1))
    local uuid="${part_uuids[$idx]}"
    local fstype="${part_fstypes[$idx]}"
    local label="${part_labels[$idx]}"

    if [[ -f "$RULES_FILE" ]] && grep -q "ID_FS_UUID==\"$uuid\"" "$RULES_FILE"; then
        echo "  A rule for that UUID already exists."
        return
    fi

    local suggested_mount="/mnt/${label:-backup}"
    read -rp "  Mount point [$suggested_mount]: " mount
    mount="${mount:-$suggested_mount}"

    read -rp "  Filesystem type [${fstype:-ext4}]: " fstype_in
    fstype="${fstype_in:-${fstype:-ext4}}"

    cat >> "$RULES_FILE" <<EOF
ACTION=="add",    SUBSYSTEM=="block", ENV{ID_FS_UUID}=="$uuid", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'mkdir -p $mount && mount -t $fstype /dev/disk/by-uuid/$uuid $mount'"
ACTION=="remove", SUBSYSTEM=="block", ENV{ID_FS_UUID}=="$uuid", RUN+="/usr/bin/systemd-run --no-block /bin/sh -c 'umount -l $mount; rmdir $mount'"
EOF

    udevadm control --reload-rules
    echo ""
    echo "  Rule added: $uuid → $mount (udev reloaded)"
}

# ── remove a rule ──────────────────────────────────────────────────────────────

remove_rule() {
    if [[ ! -f "$RULES_FILE" ]] || ! grep -q 'ACTION=="add"' "$RULES_FILE" 2>/dev/null; then
        echo "  No rules to remove."
        return
    fi

    echo ""
    mapfile -t add_lines < <(grep 'ACTION=="add"' "$RULES_FILE")
    for i in "${!add_lines[@]}"; do
        local uuid mount
        uuid=$(echo "${add_lines[$i]}" | grep -oP 'ID_FS_UUID=="[^"]*"' | tr -d 'ID_FS_UUID="')
        mount=$(echo "${add_lines[$i]}" | grep -oP "mkdir -p \S+" | awk '{print $3}')
        printf '  %d.  %-36s  %s\n' "$((i + 1))" "$uuid" "$mount"
    done
    echo ""

    read -rp "  Number to remove (or q to cancel): " choice
    [[ "$choice" == "q" || -z "$choice" ]] && return
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || ((choice < 1 || choice > ${#add_lines[@]})); then
        echo "  Invalid choice."
        return
    fi

    local idx=$((choice - 1))
    local uuid
    uuid=$(echo "${add_lines[$idx]}" | grep -oP 'ID_FS_UUID=="[^"]*"' | tr -d 'ID_FS_UUID="')
    sed -i "/ID_FS_UUID==\"$uuid\"/d" "$RULES_FILE"
    udevadm control --reload-rules
    echo "  Removed rule for $uuid (udev reloaded)."
}

# ── main loop ──────────────────────────────────────────────────────────────────

while true; do
    echo ""
    echo "  Autoback — udev Rule Manager"
    list_rules
    echo "  1. Add a rule"
    echo "  2. Remove a rule"
    echo "  3. Reload udev rules"
    echo "  4. Exit"
    echo ""
    read -rp "  Choice: " choice
    echo ""
    case "$choice" in
        1) add_rule ;;
        2) remove_rule ;;
        3) udevadm control --reload-rules && echo "  udev rules reloaded." ;;
        4) exit 0 ;;
        *) echo "  Invalid choice." ;;
    esac
done
