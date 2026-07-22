"""WebSocket de streaming: ponte Redis Streams → clientes, com heartbeat e throttle."""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.collectors.adsb_collector import POSITIONS_KEY as ADSB_POSITIONS
from backend.app.collectors.ais_collector import POSITIONS_KEY as AIS_POSITIONS
from backend.app.queue.redis_queue import STREAM_ALERTS, STREAM_TRIAGED

logger = logging.getLogger("argus.ws")

router = APIRouter()

HEARTBEAT_SECONDS = 30
POSITION_THROTTLE_SECONDS = 1.0  # max. 1 broadcast/s por camada de posicoes


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.connections.discard(ws)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Envio tolerante: conexao morta e removida sem afetar as demais."""
        dead: list[WebSocket] = []
        payload = json.dumps(message, ensure_ascii=False, default=str)
        for ws in list(self.connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


async def redis_bridge(redis: Any, stop_event: asyncio.Event | None = None) -> None:
    """Assina stream:triaged_data e stream:alerts e retransmite; posicoes com throttle."""
    last_ids = {STREAM_TRIAGED: "$", STREAM_ALERTS: "$"}
    last_positions_broadcast = 0.0
    while stop_event is None or not stop_event.is_set():
        try:
            response = await redis.xread(last_ids, count=50, block=1000)
            for stream_name, messages in response or []:
                for message_id, fields in messages:
                    last_ids[stream_name] = message_id
                    kind = "alert" if stream_name == STREAM_ALERTS else "event"
                    await manager.broadcast(
                        {"type": kind, "data": json.loads(fields["payload"])}
                    )
            now = time.monotonic()
            if now - last_positions_broadcast >= POSITION_THROTTLE_SECONDS:
                last_positions_broadcast = now
                for layer, key in (("adsb", ADSB_POSITIONS), ("ais", AIS_POSITIONS)):
                    positions = await redis.hgetall(key)
                    if positions:
                        await manager.broadcast(
                            {"type": f"positions:{layer}",
                             "data": {k: json.loads(v) for k, v in positions.items()}}
                        )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("ponte redis→ws: %r", exc)
            await asyncio.sleep(1.0)


@router.websocket("/api/v1/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    bridge_task: asyncio.Task | None = None
    if len(manager.connections) == 1:  # primeira conexao liga a ponte
        bridge_task = asyncio.create_task(redis_bridge(ws.app.state.redis))
        ws.app.state.ws_bridge = bridge_task
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
        if not manager.connections:
            task = getattr(ws.app.state, "ws_bridge", None)
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
                ws.app.state.ws_bridge = None
