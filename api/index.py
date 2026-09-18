import sys
import os

# Tambahkan direktori root dan backend ke sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(root_dir, "backend")

for p in [root_dir, backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Impor FastAPI app dari backend.main
from backend.main import app  # noqa: E402
