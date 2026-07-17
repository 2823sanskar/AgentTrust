FROM python:3.11-slim

WORKDIR /app

COPY agent.py .

# Enforce immediate output flushing for transparent logs capturing
ENV PYTHONUNBUFFERED=1

CMD ["python", "agent.py"]
