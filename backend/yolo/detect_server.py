"""
WheelWash YOLO26 truck-detection sidecar.

A small FastAPI service that holds a warm YOLO26 model and exposes a /detect
endpoint. The Node backend POSTs a base64 camera frame and receives the detected
objects (class, confidence, bounding box) back.

COCO classes of interest:
  - 7  = truck   -> counted (+1)
  - 0  = person  -> ignored (human/pedestrian filter)

The sidecar returns ALL detections; the Node backend decides what to count.
Run:  python detect_server.py   (listens on http://127.0.0.1:5002)
"""
import base64
import io
import os
import threading
import time
from typing import List, Optional

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_default_model = os.path.join(BASE_DIR, "yolo26n.pt")
MODEL_NAME = os.getenv("YOLO_MODEL", _default_model)
if not os.path.isabs(MODEL_NAME):
    MODEL_NAME = os.path.join(BASE_DIR, MODEL_NAME)

DEFAULT_CONF = float(os.getenv("YOLO_CONF", "0.25"))
PORT = int(os.getenv("PORT", "5002"))
HOST = os.getenv("HOST", "127.0.0.1")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI(title="WheelWash YOLO26 Detector")
infer_lock = threading.Lock()

print(f"[yolo] loading {MODEL_NAME} on {DEVICE} ...", flush=True)
model = YOLO(MODEL_NAME)
try:
    model.to(DEVICE)
except Exception as exc:  # older ultralytics may not expose .to()
    print(f"[yolo] model.to({DEVICE}) skipped: {exc}", flush=True)

# Warm up the model with a tiny image so the first real request is fast.
try:
    with infer_lock:
        model(Image.new("RGB", (64, 64)), verbose=False)
except Exception:
    pass
print(f"[yolo] ready on {DEVICE}", flush=True)


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] in pixels


class DetectRequest(BaseModel):
    image: str  # raw base64 or a data URL
    conf: Optional[float] = None


class DetectResponse(BaseModel):
    detections: List[Detection]
    inference_ms: float
    width: int
    height: int


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": DEVICE}


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    img_b64 = req.image
    if not img_b64:
        raise HTTPException(status_code=400, detail="Empty image payload")

    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]

    try:
        raw = base64.b64decode(img_b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {exc}")

    width, height = img.size
    conf = req.conf if req.conf is not None else DEFAULT_CONF

    t0 = time.time()
    with infer_lock:
        results = model(img, conf=conf, verbose=False)
    dt = (time.time() - t0) * 1000.0

    detections: List[Detection] = []
    for r in results:
        names = r.names
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            continue
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            confv = float(boxes.conf[i].item())
            x1, y1, x2, y2 = boxes.xyxy[i].tolist()
            detections.append(
                Detection(
                    class_id=cls_id,
                    class_name=str(names.get(cls_id, cls_id)),
                    confidence=round(confv, 4),
                    bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                )
            )
    return DetectResponse(
        detections=detections, inference_ms=round(dt, 1), width=width, height=height
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
