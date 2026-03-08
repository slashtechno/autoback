#!/bin/sh
# Name: Autoback Dashboard
# Author: Angad Behl

fmt_secs() {
    local secs=$1
    local d=$((secs/86400))
    local h=$(((secs%86400)/3600))
    local m=$(((secs%3600)/60))
    local s=$((secs%60))
    echo "${d}d ${h}h ${m}m ${s}s"
}

BASE_URL="http://localhost:5173"
DRIVE_ID="cmmhcuhgs0000m4ijf93iky5l" # Replace with actual drive ID
API_KEY="LjTXBbRgFTxKdutGPBaPZOPMjndzOrqNXFLamrHMycAEaizOGoaUwniadBFSgTTj"

# Endpoint with JSON response
url="$BASE_URL/drives/$DRIVE_ID/backup"

# Fetch the data
response=$(curl -s -X GET "$url" -H "x-api-key: $API_KEY")
# export type ResticEvent =
# 	| { message_type: 'status';  percent_done: number; total_files: number; files_done: number; to/tal_bytes: number; bytes_done: number }
# 	| { message_type: 'summary'; files_new: number; files_changed: number; data_added: number; [key: string]: unknown }
# 	| { message_type: 'error';   error: string };


# Use jq to parse JSON data
message_type=$(echo "$response" | jq -r '.message_type // empty')

# https://www.digitalocean.com/community/tutorials/if-else-in-shell-scripts
if [ "$message_type" = "status" ]; then
# {"message_type":"status","seconds_elapsed":8,"seconds_remaining":31,"percent_done":0.21547865648915082,"total_files":4,"files_done":3,"total_bytes":2147483693,"bytes_done":462736901,"current_files":[".../autoback/test-data/to-backup/large-file.bin"]}
  percent_done=$(echo "$response" | jq -r '.percent_done')
  percent_formatted=$(awk '{printf "%.1f%%\n", $1 * 100}' <<< "$percent_done")
  echo "Backup Progress: ${percent_formatted}"
  echo "Files Done: $(echo "$response" | jq -r '.files_done') / $(echo "$response" | jq -r '.total_files')"
  echo "Data Done: $(echo "$response" | jq -r '.bytes_done' | numfmt --to=iec) / $(echo "$response" | jq -r '.total_bytes' | numfmt --to=iec)"
  echo "Time Remaining: $(fmt_secs $(echo "$response" | jq -r '.seconds_remaining'))"
elif [ "$message_type" = "error" ]; then
  error_message=$(echo "$response" | jq -r '.error')
  echo "Error: $error_message"
elif [ "$message_type" = "summary" ]; then
  echo "Backup complete."
#   Full Response: {"message_type":"summary","files_new":4,"files_changed":0,"files_unmodified":0,"dirs_new":8,"dirs_changed":0,"dirs_unmodified":0,"data_blobs":4,"tree_blobs":9,"data_added":1902286,"data_added_packed":4426,"total_files_processed":4,"total_bytes_processed":10737418285,"total_duration":5.484627681,"backup_start":"2026-03-08T00:14:00.004346897-06:00","backup_end":"2026-03-08T00:14:05.488974548-06:00","snapshot_id":"6631ff825e6a3abb914d0570ae4395757f95a5c7d94a7b19a8736be12f54d1f7"}
  echo "Files New: $(echo "$response" | jq -r '.files_new')"
  echo "Data Added: $(echo "$response" | jq -r '.data_added' | numfmt --to=iec)"
  
#   echo "Full Response: $response"
else
  echo "Unexpected response format."
  echo "Full Response: $response"
fi

echo "-----------------------------------"
echo "Raw JSON Response:"
echo "$response"
