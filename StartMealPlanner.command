#!/bin/bash
echo "Starting Meal Planner..."
cd "/Users/Komal/Documents/meal-planner"
export PATH="/Users/Komal/.local/node/bin:$PATH"

# Prevent port conflicts by killing previous sessions if they exist
pkill -f "node server/server.js"
pkill -f "vite"
sleep 1

# Start the Node.js backend API
node server/server.js > /tmp/meal-planner-server.log 2>&1 &
SERVER_PID=$!

# Start the Vite React Frontend
npm run dev > /tmp/meal-planner-vite.log 2>&1 &
VITE_PID=$!

echo "Backend and Frontend are starting up!"
# Wait a brief moment to ensure Vite is up
sleep 2

# Open in the default web browser
open "http://localhost:5173"

echo "====================================="
echo "Meal Planner is now running!"
echo "Keep this window open to keep running."
echo "Press [Ctrl + C] to stop the servers."
echo "====================================="

# Catch the Ctrl+C signal and gracefully shut down the processes
trap "echo 'Shutting down servers...'; kill $SERVER_PID $VITE_PID; exit" INT TERM

# Wait indefinitely for the servers
wait
