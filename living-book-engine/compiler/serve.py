#!/usr/bin/env python3
"""
Living Book Engine (LBE) — Local Dev Server
Serves compiled 3D books with CORS, zero-cache headers, correct MIME types, secure localhost default and optional Wi-Fi broadcast.
"""

import os
import sys
import socket
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler

MIME_TABLE = {
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
}

class LivingBookHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        _, ext = os.path.splitext(path.lower())
        if ext in MIME_TABLE:
            return MIME_TABLE[ext]
        return super().guess_type(path)

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.end_headers()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run_server(book_dir, host="127.0.0.1", port=8766):
    book_dir = os.path.abspath(book_dir)
    if not os.path.exists(os.path.join(book_dir, "index.html")):
        print(f"[!] Warning: index.html not found in {book_dir}. Make sure you built the book first.")
    
    os.chdir(book_dir)
    server_address = (host, port)
    httpd = HTTPServer(server_address, LivingBookHandler)
    
    local_ip = get_local_ip() if host == "0.0.0.0" else host
    print("=" * 66)
    print(" 📖 LIVING BOOK ENGINE — SERVIDOR LOCAL ATIVO")
    print("=" * 66)
    print(f" Diretório Servido : {book_dir}")
    print(f" Host / Bind       : {host}")
    print(f" Acesso Local (PC) : http://localhost:{port}/")
    if host == "0.0.0.0":
        print(f" Acesso Wi-Fi/Rede : http://{local_ip}:{port}/")
    else:
        print(f" Modo Seguro       : Localhost apenas (use --network para Wi-Fi)")
    print("=" * 66)
    print(" Pressione Ctrl+C para encerrar o servidor.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Servidor encerrado.")
        httpd.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Living Book Local HTTP Server")
    parser.add_argument("--book", default=".", help="Directory containing the compiled book (index.html)")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind to (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8766, help="Port to serve on (default: 8766)")
    parser.add_argument("--network", action="store_true", help="Bind to 0.0.0.0 to allow access from local Wi-Fi / devices")
    args = parser.parse_args()
    
    bind_host = "0.0.0.0" if args.network else args.host
    run_server(args.book, host=bind_host, port=args.port)
