from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import bcrypt
from jose import jwt, JWTError
from .users import SessionLocal, User, create_user, get_user_by_email, get_users, delete_user, set_admin, get_user_by_id
import re
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import logging
import socketio
import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from .env file
from dotenv import load_dotenv
import pathlib

# Get the backend directory path (parent of app directory)
backend_dir = pathlib.Path(__file__).parent.parent
env_path = backend_dir / '.env'
load_dotenv(env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

# Add rate limiting exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000', 'http://localhost:5173']
)

# Create an ASGI app that wraps the FastAPI app and Socket.IO server
socket_app = socketio.ASGIApp(sio, app)

# Add CORS middleware with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections and events
active_connections: Dict[str, WebSocket] = {}
events: Dict[str, dict] = {}

@sio.on('connect')
async def connect(sid, environ):
    logger.info(f'Client connected: {sid}')

@sio.on('disconnect')
async def disconnect(sid):
    logger.info(f'Client disconnected: {sid}')

@sio.on('client.session.create')
async def handle_create_session(sid, data):
    logger.info(f'Creating session for {sid} with data: {data}')
    # Add your session creation logic here
    await sio.emit('server.session.created', {'session': data}, room=sid)

@sio.on('client.session.join')
async def handle_join_session(sid, data):
    logger.info(f'Client {sid} joining session: {data}')
    # Add your session join logic here
    await sio.emit('server.session.joined', {'session': data}, room=sid)

@sio.on('client.vote')
async def handle_vote(sid, data):
    logger.info(f'Vote from {sid}: {data}')
    # Add your voting logic here
    await sio.emit('server.vote.registered', {'vote': data}, room=sid)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.events: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast_to_event(self, message: dict, event_id: str):
        if event_id in self.events:
            event = self.events[event_id]
            for participant in event['participants']:
                if participant['id'] in self.active_connections:
                    await self.active_connections[participant['id']].send_json(message)

    def create_event(self, event_id: str, name: str, host_id: str, host_name: str):
        self.events[event_id] = {
            'id': event_id,
            'name': name,
            'createdAt': datetime.utcnow().isoformat(),
            'hostId': host_id,
            'participants': [{'id': host_id, 'name': host_name, 'isHost': True}],
            'tickets': [],
            'currentTicketIndex': 0,
            'status': 'active'
        }

    def join_event(self, event_id: str, user_id: str, user_name: str):
        if event_id in self.events:
            self.events[event_id]['participants'].append({
                'id': user_id,
                'name': user_name,
                'isHost': False
            })

    def leave_event(self, event_id: str, user_id: str):
        if event_id in self.events:
            event = self.events[event_id]
            event['participants'] = [p for p in event['participants'] if p['id'] != user_id]
            if not event['participants']:
                del self.events[event_id]

manager = ConnectionManager()

SECRET_KEY = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET or SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password_policy(password: str) -> bool:
    logger.info(f"Checking password length: {len(password)} characters")
    if len(password) < 8:
        logger.info("Password length check failed")
        return False
        
    logger.info("Checking for uppercase letter")
    if not re.search(r"[A-Z]", password):
        logger.info("Uppercase letter check failed")
        return False
        
    logger.info("Checking for number")
    if not re.search(r"[0-9]", password):
        logger.info("Number check failed")
        return False
        
    logger.info("Checking for special character")
    # Define special characters including +
    if not re.search("[!@#$%^&*(),.?\":{}|<>+]", password):
        logger.info("Special character check failed")
        return False
        
    logger.info("All password policy checks passed")
    return True

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str

class UserExists(BaseModel):
    exists: bool
    email: EmailStr

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    logger.info(f"get_current_user called with token: {token[:30]}...")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"JWT payload: {payload}")
    except JWTError as e:
        logger.warning(f"JWTError: {e}")
        raise credentials_exception
    user_id: int = payload.get("sub")
    if user_id is None:
        logger.warning("JWT payload missing 'sub'")
        raise credentials_exception
    user = get_user_by_id(db, user_id)
    if user is None:
        logger.warning(f"No user found with id {user_id}")
        raise credentials_exception
    # Debug log for last_active
    now = datetime.utcnow()
    logger.info(f"User {user.email} last_active: {user.last_active}, now: {now}")
    if user.last_active is not None and (now - user.last_active).total_seconds() > 3600:
        logger.warning(f"Session expired for user {user.email}. last_active: {user.last_active}, now: {now}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    # Update last_active
    user.last_active = now
    db.commit()
    db.refresh(user)
    logger.info(f"User {user.email} last_active updated to: {user.last_active}")
    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user

@app.post("/register", response_model=UserOut)
@limiter.limit("3/minute")
def register(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    logger.info(f"Received registration request for email: {user.email}")
    logger.info(f"Password length: {len(user.password)}")
    logger.info(f"Password characters: {[char for char in user.password]}")
    logger.info(f"Has uppercase: {bool(re.search(r'[A-Z]', user.password))}")
    logger.info(f"Has number: {bool(re.search(r'[0-9]', user.password))}")
    
    # Use the same pattern as in verify_password_policy
    special_chars = "[!@#$%^&*(),.?\":{}|<>+]"
    special_char_match = re.search(special_chars, user.password)
    logger.info(f"Special chars in password: {[char for char in user.password if re.search(special_chars, char)]}")
    logger.info(f"Has special char: {bool(special_char_match)}")
    
    if not verify_password_policy(user.password):
        logger.warning("Password policy check failed")
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters, include 1 capital, 1 number, and 1 special character (one of: !@#$%^&*(),.?\":{}|<>+).")
    
    db_user = get_user_by_email(db, user.email)
    if db_user:
        logger.warning(f"Email already registered: {user.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hash_password(user.password)
    new_user = create_user(db, user.email, hashed_pw)
    logger.info(f"Successfully registered user: {user.email}")
    return UserOut.model_validate(new_user)

@app.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    logger.info(f"Login attempt for user: {form_data.username}")
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for user: {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    # Update last_active on login
    user.last_active = datetime.utcnow()
    db.commit()
    db.refresh(user)
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "is_admin": user.is_admin})
    logger.info(f"Successful login for user: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return get_users(db, skip, limit)

@app.delete("/users/{user_id}", response_model=UserOut)
def remove_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = delete_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/{user_id}/set_admin", response_model=UserOut)
def promote_user(user_id: int, is_admin: bool, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = set_admin(db, user_id, is_admin)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.websocket("/ws/estimation")
async def websocket_endpoint(
    websocket: WebSocket,
    userId: str = Query(...),
    isHost: bool = Query(False)
):
    await manager.connect(websocket, userId)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data['type'] == 'REGISTER_USER':
                # Handle user registration
                pass

            elif data['type'] == 'CREATE_EVENT':
                event_id = str(uuid.uuid4())
                manager.create_event(
                    event_id,
                    data['payload']['name'],
                    userId,
                    data['payload'].get('name', 'Anonymous')
                )
                await manager.send_personal_message({
                    'type': 'EVENT_CREATED',
                    'payload': {
                        'event': manager.events[event_id],
                        'eventId': event_id
                    }
                }, userId)

            elif data['type'] == 'JOIN_EVENT':
                event_id = data['payload']['eventId']
                if event_id in manager.events:
                    manager.join_event(
                        event_id,
                        userId,
                        data['payload'].get('name', 'Anonymous')
                    )
                    await manager.broadcast_to_event({
                        'type': 'EVENT_UPDATED',
                        'payload': {
                            'event': manager.events[event_id]
                        }
                    }, event_id)
                else:
                    await manager.send_personal_message({
                        'type': 'ERROR',
                        'payload': {
                            'message': 'Event not found'
                        }
                    }, userId)

            elif data['type'] == 'LEAVE_EVENT':
                event_id = data['payload']['eventId']
                manager.leave_event(event_id, userId)
                await manager.broadcast_to_event({
                    'type': 'EVENT_UPDATED',
                    'payload': {
                        'event': manager.events.get(event_id)
                    }
                }, event_id)

            elif data['type'] == 'VOTE':
                event_id = data['payload']['eventId']
                ticket_key = data['payload']['ticketKey']
                vote = data['payload']['vote']
                
                if event_id in manager.events:
                    event = manager.events[event_id]
                    for ticket in event['tickets']:
                        if ticket['key'] == ticket_key:
                            ticket['votes'][userId] = vote
                            break
                    
                    await manager.broadcast_to_event({
                        'type': 'VOTE_RECEIVED',
                        'payload': {
                            'event': event,
                            'ticketKey': ticket_key,
                            'userId': userId,
                            'vote': vote
                        }
                    }, event_id)

    except WebSocketDisconnect:
        manager.disconnect(userId)
        # Notify other participants about the disconnection
        for event_id, event in manager.events.items():
            if any(p['id'] == userId for p in event['participants']):
                manager.leave_event(event_id, userId)
                await manager.broadcast_to_event({
                    'type': 'PARTICIPANT_LEFT',
                    'payload': {
                        'userId': userId,
                        'event': manager.events.get(event_id)
                    }
                }, event_id)

@app.get("/check-user/{email}", response_model=UserExists)
def check_user_exists(email: EmailStr, db: Session = Depends(get_db)):
    logger.info(f"Checking if user exists: {email}")
    user = get_user_by_email(db, email)
    return {"exists": user is not None, "email": email}

@app.get("/api/jira/tickets")
async def get_jira_tickets():
    try:
        # Itt implementáld a JIRA jegyek lekérését
        tickets = [
            {
                "id": "JIRA-123",
                "title": "Example Ticket 1",
                "status": "To Do",
                "type": "Story"
            },
            {
                "id": "JIRA-124",
                "title": "Example Ticket 2",
                "status": "In Progress",
                "type": "Bug"
            }
        ]
        return {"tickets": tickets, "total": len(tickets)}
    except Exception as e:
        logger.error(f"Error fetching JIRA tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jira/fix-versions")
async def get_fix_versions():
    try:
        # Itt implementáld a fix verziók lekérését
        versions = [
            {
                "id": "1.0.0",
                "name": "Version 1.0.0",
                "releaseDate": "2024-03-20"
            },
            {
                "id": "1.1.0",
                "name": "Version 1.1.0",
                "releaseDate": "2024-04-20"
            }
        ]
        return versions
    except Exception as e:
        logger.error(f"Error fetching fix versions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jira/sprints/search")
async def search_sprints(name: Optional[str] = None):
    try:
        # Itt implementáld a sprintek keresését
        sprints = [
            {
                "id": 1,
                "name": "Sprint 1",
                "startDate": "2024-03-01",
                "endDate": "2024-03-15"
            },
            {
                "id": 2,
                "name": "Sprint 2",
                "startDate": "2024-03-16",
                "endDate": "2024-03-31"
            }
        ]
        if name:
            sprints = [s for s in sprints if name.lower() in s["name"].lower()]
        return sprints
    except Exception as e:
        logger.error(f"Error searching sprints: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jira/sprints/{sprint_id}/tickets")
async def get_sprint_tickets(sprint_id: str):
    try:
        # Itt implementáld a sprint jegyeinek lekérését
        tickets = [
            {
                "id": "JIRA-125",
                "title": f"Sprint {sprint_id} Ticket 1",
                "status": "To Do",
                "type": "Story"
            },
            {
                "id": "JIRA-126",
                "title": f"Sprint {sprint_id} Ticket 2",
                "status": "In Progress",
                "type": "Bug"
            }
        ]
        return tickets
    except Exception as e:
        logger.error(f"Error fetching sprint tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/keep-alive")
def keep_alive(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    print("=== KEEP ALIVE ENDPOINT HIT ===")
    # last_active is already updated in get_current_user
    return {"status": "ok"}

# Keep your existing REST endpoints below 