"""
Vendor-neutral queue abstraction for the blur worker (ADR 0027).
Supports Redis Streams (default/dev), AWS SQS, and Azure Storage Queue.
Selected by BLUR_QUEUE_TYPE env var: redis | sqs | azure.
"""
import json
import logging
import os
import time
import uuid
from abc import ABC, abstractmethod
from typing import Optional

log = logging.getLogger(__name__)

REQUEST_QUEUE = os.environ.get("BLUR_REQUEST_QUEUE", "blur-requests")
COMPLETION_QUEUE = os.environ.get("BLUR_COMPLETION_QUEUE", "blur-completions")


class BlurQueue(ABC):
    """Abstract queue interface for blur request/completion messages."""

    @abstractmethod
    def pull_request(self, timeout_s: int = 5) -> Optional[dict]:
        """Pull one blur request from the request queue. Returns None if empty."""

    @abstractmethod
    def ack_request(self, receipt: str) -> None:
        """Acknowledge a pulled request so it is not redelivered."""

    @abstractmethod
    def push_completion(self, message: dict) -> None:
        """Push a completion message to the completion queue."""

    @abstractmethod
    def pull_completion(self, timeout_s: int = 5) -> Optional[dict]:
        """Pull one completion message (used by the Java backend poller)."""

    @abstractmethod
    def ack_completion(self, receipt: str) -> None:
        """Acknowledge a pulled completion."""

    @abstractmethod
    def push_request(self, message: dict) -> None:
        """Push a blur request (used by the Java backend adapter via CLI)."""

    @abstractmethod
    def healthy(self) -> bool:
        """Return True if the queue backend is reachable."""


class RedisQueue(BlurQueue):
    """Redis Streams implementation — good for local dev and self-hosted."""

    def __init__(self):
        import redis as _redis
        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self._r = _redis.from_url(url, decode_responses=True)
        self._group = "blur-workers"
        self._consumer = f"worker-{uuid.uuid4().hex[:8]}"
        for q in (REQUEST_QUEUE, COMPLETION_QUEUE):
            try:
                self._r.xgroup_create(q, self._group, id="0", mkstream=True)
            except _redis.exceptions.ResponseError:
                pass  # group already exists

    def pull_request(self, timeout_s=5):
        return self._pull(REQUEST_QUEUE, timeout_s)

    def ack_request(self, receipt):
        self._r.xack(REQUEST_QUEUE, self._group, receipt)

    def push_completion(self, message):
        self._r.xadd(COMPLETION_QUEUE, {"data": json.dumps(message)})

    def pull_completion(self, timeout_s=5):
        return self._pull(COMPLETION_QUEUE, timeout_s)

    def ack_completion(self, receipt):
        self._r.xack(COMPLETION_QUEUE, self._group, receipt)

    def push_request(self, message):
        self._r.xadd(REQUEST_QUEUE, {"data": json.dumps(message)})

    def healthy(self):
        try:
            return self._r.ping()
        except Exception:
            return False

    def _pull(self, stream, timeout_s):
        result = self._r.xreadgroup(
            self._group, self._consumer,
            {stream: ">"}, count=1, block=timeout_s * 1000
        )
        if not result:
            return None
        stream_name, messages = result[0]
        msg_id, fields = messages[0]
        data = json.loads(fields["data"])
        data["_receipt"] = msg_id
        return data


class SqsQueue(BlurQueue):
    """AWS SQS implementation."""

    def __init__(self):
        import boto3
        region = os.environ.get("AWS_REGION", "ap-southeast-2")
        self._sqs = boto3.client("sqs", region_name=region)
        self._req_url = os.environ["BLUR_SQS_REQUEST_URL"]
        self._comp_url = os.environ["BLUR_SQS_COMPLETION_URL"]

    def pull_request(self, timeout_s=5):
        return self._pull(self._req_url, timeout_s)

    def ack_request(self, receipt):
        self._sqs.delete_message(QueueUrl=self._req_url, ReceiptHandle=receipt)

    def push_completion(self, message):
        self._sqs.send_message(QueueUrl=self._comp_url, MessageBody=json.dumps(message))

    def pull_completion(self, timeout_s=5):
        return self._pull(self._comp_url, timeout_s)

    def ack_completion(self, receipt):
        self._sqs.delete_message(QueueUrl=self._comp_url, ReceiptHandle=receipt)

    def push_request(self, message):
        self._sqs.send_message(QueueUrl=self._req_url, MessageBody=json.dumps(message))

    def healthy(self):
        try:
            self._sqs.get_queue_attributes(QueueUrl=self._req_url, AttributeNames=["QueueArn"])
            return True
        except Exception:
            return False

    def _pull(self, url, timeout_s):
        resp = self._sqs.receive_message(
            QueueUrl=url, MaxNumberOfMessages=1,
            WaitTimeSeconds=min(timeout_s, 20)
        )
        msgs = resp.get("Messages", [])
        if not msgs:
            return None
        msg = msgs[0]
        data = json.loads(msg["Body"])
        data["_receipt"] = msg["ReceiptHandle"]
        return data


class AzureQueue(BlurQueue):
    """Azure Storage Queue implementation."""

    def __init__(self):
        from azure.storage.queue import QueueClient
        conn_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        self._req = QueueClient.from_connection_string(conn_str, REQUEST_QUEUE)
        self._comp = QueueClient.from_connection_string(conn_str, COMPLETION_QUEUE)
        self._req.create_queue()
        self._comp.create_queue()

    def pull_request(self, timeout_s=5):
        return self._pull(self._req)

    def ack_request(self, receipt):
        # receipt is (id, pop_receipt) tuple
        msg_id, pop = receipt
        self._req.delete_message(msg_id, pop)

    def push_completion(self, message):
        self._comp.send_message(json.dumps(message))

    def pull_completion(self, timeout_s=5):
        return self._pull(self._comp)

    def ack_completion(self, receipt):
        msg_id, pop = receipt
        self._comp.delete_message(msg_id, pop)

    def push_request(self, message):
        self._req.send_message(json.dumps(message))

    def healthy(self):
        try:
            self._req.get_queue_properties()
            return True
        except Exception:
            return False

    def _pull(self, client):
        msgs = client.receive_messages(messages_per_page=1, visibility_timeout=60)
        for msg in msgs:
            data = json.loads(msg.content)
            data["_receipt"] = (msg.id, msg.pop_receipt)
            return data
        return None


def create_queue() -> BlurQueue:
    """Factory: create the right queue adapter from BLUR_QUEUE_TYPE env var."""
    queue_type = os.environ.get("BLUR_QUEUE_TYPE", "redis").lower()
    if queue_type == "redis":
        return RedisQueue()
    elif queue_type == "sqs":
        return SqsQueue()
    elif queue_type == "azure":
        return AzureQueue()
    else:
        raise ValueError(f"Unknown BLUR_QUEUE_TYPE: {queue_type}. Use: redis, sqs, azure")
