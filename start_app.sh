#!/bin/bash

# Set working directory to the script's location
cd "$(dirname "$0")"

# Open Terminal and run the start script
osascript -e 'tell application "Terminal"
    activate
    do script "cd \"'$(pwd)'\" && ./start.sh"
end tell'

# Wait a few seconds for services to start
sleep 5

# Open the application in the default browser
open "http://localhost:3000" 