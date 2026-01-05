#!/bin/bash
# Reset all social/sharing related local data
rm -f ~/Library/Application\ Support/screencap/social-account.json && \
sqlite3 ~/Library/Application\ Support/screencap/screencap.db "DELETE FROM project_shares; DELETE FROM project_room_links; DELETE FROM room_keys_cache; DELETE FROM social_account; DELETE FROM friends_cache; DELETE FROM room_memberships; DELETE FROM room_events_cache; DELETE FROM room_day_wrapped_cache; DELETE FROM room_members_cache; DELETE FROM chat_threads_cache; DELETE FROM chat_messages_cache; DELETE FROM chat_unread_state; DELETE FROM room_invites_sent;" && \
security delete-generic-password -s "Screencal Safe Storage" 2>/dev/null; \
echo "Sharing data cleared (including social-account.json)"
