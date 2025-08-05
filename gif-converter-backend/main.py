import io
import os
import requests
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
GIPHY_API_KEY = os.getenv("GIPHY_API_KEY")

app = FastAPI(
    title="GIF to ASCII Converter API",
    description="An API that converts GIFs from URLs, uploads, or GIPHY search into animated ASCII art.",
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ASCII_CHARS = " .:-=+*#%@"
MAX_WIDTH = 150

def image_to_ascii(image: Image.Image) -> str:
    """Converts a single image frame to an ASCII string."""
    width, height = image.size
    aspect_ratio = height / width
    new_height = int(aspect_ratio * MAX_WIDTH * 0.55)
    resized_image = image.resize((MAX_WIDTH, new_height))
    grayscale_image = resized_image.convert("L")
    pixels = grayscale_image.getdata()
    ascii_str = "".join([ASCII_CHARS[int(pixel_value / 255 * (len(ASCII_CHARS) - 1))] for pixel_value in pixels])
    ascii_lines = [ascii_str[i : i + MAX_WIDTH] for i in range(0, len(ascii_str), MAX_WIDTH)]
    return "\n".join(ascii_lines)

def process_animated_image(image_bytes: bytes):
    """Processes animated image bytes (GIF or WebP) and returns ASCII frames and duration."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            if not getattr(img, "is_animated", False) or img.n_frames <= 1:
                # Handle static images by creating a single frame
                rgb_frame = img.convert("RGB")
                ascii_frame = image_to_ascii(rgb_frame)
                return {"frames": [ascii_frame], "duration": 2000} 

            frames = []
            duration = img.info.get("duration", 100) 

            for i in range(img.n_frames):
                img.seek(i)
                rgb_frame = img.convert("RGB")
                ascii_frame = image_to_ascii(rgb_frame)
                frames.append(ascii_frame)
            
            return {"frames": frames, "duration": duration}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Welcome to the GIF to ASCII Converter API!"}

@app.get("/api/search-giphy")
async def search_giphy(query: str, limit: int = 12):
    """Searches the GIPHY API for GIFs."""
    if not GIPHY_API_KEY:
        raise HTTPException(status_code=500, detail="GIPHY_API_KEY is not configured on the server.")
    
    url = f"https://api.giphy.com/v1/gifs/search"
    params = { "api_key": GIPHY_API_KEY, "q": query, "limit": limit, "offset": 0, "rating": "g", "lang": "en" }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        results = [
            {
                "id": item["id"],
                "title": item["title"],
                "url": item["images"]["original"]["url"],
                "thumbnail_url": item["images"]["fixed_width"]["url"]
            }
            for item in data["data"]
        ]
        return results
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with GIPHY API: {e}")

@app.post("/api/convert-from-url")
async def convert_gif_from_url(gif_url: str = Form(...)):
    """Fetches an image from a URL and converts it."""
    try:
        response = requests.get(gif_url, stream=True)
        response.raise_for_status()
        image_bytes = response.content
        return process_animated_image(image_bytes)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch image from URL: {e}")

@app.post("/api/convert-from-upload")
async def convert_gif_from_upload(file: UploadFile = File(...)):
    """Accepts an uploaded image file and converts it."""
    if file.content_type not in ["image/gif", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a GIF or WebP file.")
    
    image_bytes = await file.read()
    return process_animated_image(image_bytes)
