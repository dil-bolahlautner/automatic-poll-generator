from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import uuid
from datetime import datetime
from pydantic import BaseModel

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections and events
active_connections: Dict[str, WebSocket] = {}
events: Dict[str, dict] = {}

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

# Keep your existing REST endpoints below 