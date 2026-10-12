import uvicorn

if __name__ == "__main__":
    uvicorn.run("music_service.app:create_app", factory=True, host="127.0.0.1", port=8090, workers=1)
