#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Automatic Poll Generator...${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to kill processes using specific ports
kill_port_processes() {
    local port=$1
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Killing existing processes on port $port...${NC}"
        echo $pids | xargs kill -9
        sleep 2
    fi
}

# Function to check if backend is running
check_backend() {
    curl -s http://localhost:3001/docs > /dev/null 2>&1
}

# Check for required commands
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Kill any existing processes on our ports
kill_port_processes 3001
kill_port_processes 3002
kill_port_processes 3000

# Remove existing virtual environment
if [ -d "backend/venv" ]; then
    echo -e "${GREEN}Removing existing virtual environment...${NC}"
    rm -rf backend/venv
fi

# Create new Python virtual environment
echo -e "${GREEN}Creating Python virtual environment...${NC}"
python3 -m venv backend/venv

# Activate Python virtual environment
echo -e "${GREEN}Activating Python virtual environment...${NC}"
source backend/venv/bin/activate

# Upgrade pip and install wheel
echo -e "${GREEN}Upgrading pip and installing wheel...${NC}"
pip install --upgrade pip
pip install wheel setuptools

# Install Python dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
cd backend
if pip install -r requirements.txt; then
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
else
    echo -e "${RED}Error installing dependencies. Exiting...${NC}"
    exit 1
fi
cd ..

# Start Node.js backend server
echo -e "${GREEN}Starting Node.js backend server...${NC}"
cd backend
npm run dev > ../backend.log 2>&1 &
NODEJS_BACKEND_PID=$!
cd ..

# Wait for Node.js backend to be ready
echo -e "${YELLOW}Waiting for Node.js backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3001/api/jira/tickets > /dev/null 2>&1; then
        echo -e "${GREEN}Node.js backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Node.js backend failed to start. Check backend.log for details.${NC}"
        echo -e "${YELLOW}Backend log:${NC}"
        cat backend.log
        exit 1
    fi
    echo -n "."
    sleep 1
done

echo -e "${GREEN}Node.js backend started successfully on http://localhost:3001${NC}"

# Start Python backend server
echo -e "${GREEN}Starting Python backend server...${NC}"
cd backend
venv/bin/python -m uvicorn app.main:app --reload --port 3002 --host 0.0.0.0 > ../python_backend.log 2>&1 &
PYTHON_BACKEND_PID=$!
cd ..

# Wait for Python backend to be ready
echo -e "${YELLOW}Waiting for Python backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3002/docs > /dev/null 2>&1; then
        echo -e "${GREEN}Python backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Python backend failed to start. Check python_backend.log for details.${NC}"
        echo -e "${YELLOW}Python backend log:${NC}"
        cat python_backend.log
        exit 1
    fi
    echo -n "."
    sleep 1
done

echo -e "${GREEN}Python backend started successfully on http://localhost:3002${NC}"
echo -e "${BLUE}Python API Documentation: http://localhost:3002/docs${NC}"

# Start frontend
echo -e "${GREEN}Starting frontend application...${NC}"
echo -e "${YELLOW}Note: Frontend will clear the console. Backend logs are in backend.log${NC}"
sleep 2

cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Function to handle script termination
cleanup() {
    echo -e "${BLUE}Shutting down services...${NC}"
    kill $NODEJS_BACKEND_PID 2>/dev/null
    kill $PYTHON_BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    deactivate
    exit 0
}

# Set up trap for cleanup on script termination
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}All services are running!${NC}"
echo -e "${BLUE}Node.js Backend: http://localhost:3001${NC}"
echo -e "${BLUE}Python Backend: http://localhost:3002${NC}"
echo -e "${BLUE}Frontend: http://localhost:3000${NC}"
echo -e "${YELLOW}Node.js Backend logs: tail -f backend.log${NC}"
echo -e "${YELLOW}Python Backend logs: tail -f python_backend.log${NC}"
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait 