# Backend

Backend service code lives in this directory.


#start code

cd backend
source .venv/bin/activate
pip install motor pymongo
docker run -d --name dsa-mongo -p 27017:27017 mongo:latest
uvicorn main:app --reload --host 0.0.0.0 --port 8000
