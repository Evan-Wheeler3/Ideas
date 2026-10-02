"""Start the export helper.

    python -m shotboard_server --port 0 --token SECRET

Binds 127.0.0.1 (port 0 = pick a free one) and prints one line the app waits for:
    SHOTBOARD_READY {"port": 51234}
"""

import argparse
import json
import os
import secrets
import socket
import sys

import uvicorn

from .app import create_app


def main() -> None:
    parser = argparse.ArgumentParser(prog="shotboard_server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("SHOTBOARD_PORT", "0")))
    parser.add_argument("--token", default=os.environ.get("SHOTBOARD_TOKEN"))
    args = parser.parse_args()
    token = args.token or secrets.token_urlsafe(24)

    # Bind and listen first, so the port is known and connections queue up while uvicorn starts.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", args.port))
    sock.listen(64)
    port = sock.getsockname()[1]
    print("SHOTBOARD_READY " + json.dumps({"port": port, **({} if args.token else {"token": token})}), flush=True)

    config = uvicorn.Config(create_app(token), log_level="warning")
    uvicorn.Server(config).run(sockets=[sock])


if __name__ == "__main__":
    sys.exit(main())
