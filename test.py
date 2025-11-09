import requests
import json

# Worker URL（替换成你的实际 Worker URL）
WORKER_URL = "http://secret-post.3ns76ymur.workers.dev"

# 要发送的消息
message = {
    "content": "Hello World",
    "expireDate": "2025-12-10",
    "burnAfterRead": False
}

# 1️⃣ POST 消息
post_resp = requests.post(
    WORKER_URL,
    headers={"Content-Type": "application/json"},
    data=json.dumps(message)
)

if post_resp.status_code == 200:
    key = post_resp.text
    print(f"Message stored with key: {key}")
else:
    print(f"POST failed: {post_resp.status_code}, {post_resp.text}")
    exit(1)

# 2️⃣ GET 消息
get_resp = requests.get(f"{WORKER_URL}/{key}")

if get_resp.status_code == 200:
    data = get_resp.json()
    print("Retrieved message:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
elif get_resp.status_code == 404:
    print("Message not found")
else:
    print(f"GET failed: {get_resp.status_code}, {get_resp.text}")
