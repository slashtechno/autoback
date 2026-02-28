# Under test-data/ (gitignored) create the following directory structure:
# to-backup/
# ├── file1.txt
# ├── file2.txt
# ├── large-file.bin (2GB sparse file)
# └── subdir/
#     └── file3.txt
# restic-backup-repo/

# Create the directories
mkdir -p test-data/to-backup/subdir
mkdir -p test-data/restic-backup-repo
# Create the files
echo "This is file1." > test-data/to-backup/file1.txt
echo "This is file2." > test-data/to-backup/file2.txt
echo "This is file3." > test-data/to-backup/subdir/file3.txt
# Create a 2GB sparse file for testing large file backups
truncate -s 2G test-data/to-backup/large-file.bin