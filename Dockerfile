
FROM python:3.12-slim
RUN pip install --no-cache-dir gpt-engineer fastapi uvicorn
WORKDIR /app
COPY server.py .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "80"]
