# Under test-data/ (gitignored) create the following directory structure:
# to-backup/
# ├── file1.txt
# ├── file2.txt
# ├── large-file.bin (2GB sparse file)
# └── subdir/
#     └── file3.txt
# restic-backup-repo/

# Simulate drive unplug: only remove the source directory, not its parent.
# In real usage the parent (/Volumes, /media/user, etc.) always exists — only the
# mount point itself disappears. Deleting the parent would cause chokidar to lose
# its polling anchor and never re-detect the re-creation.
rm -rf test-data/to-backup
# Wait so the watcher can process the deletion before we recreate
sleep 2
# Create the backup repo dir if it doesn't exist (represents local backup storage,
# which persists across drive plug/unplug cycles).
mkdir -p test-data/restic-backup-repo
# Simulate drive re-plug
mkdir -p test-data/to-backup/subdir
# Create the files
echo "This is file1." > test-data/to-backup/file1.txt
echo "This is file2." > test-data/to-backup/file2.txt
echo "This is file3." > test-data/to-backup/subdir/file3.txt
# Create a 10GB sparse file for testing large file backups
truncate -s 10G test-data/to-backup/large-file.bin