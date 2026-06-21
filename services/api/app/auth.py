import base64
import hashlib
import hmac
import json
import os
import time
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import timedelta

import httpx
from fastapi import HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .config import get_settings
from .database import UserRecord, engine


PBKDF2_ITERATIONS = 390_000


@dataclass(frozen=True)
class Actor:
    id: str
    name: str
    email: str
    role: str
    provisioned: bool = True


current_actor: ContextVar[Actor | None] = ContextVar("current_actor", default=None)


# Local password authentication exists only for isolated automated tests. The
# running application uses Supabase and never stores application passwords.
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, iterations, salt_value, digest_value = password_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            base64.b64decode(salt_value),
            int(iterations),
        )
        return hmac.compare_digest(actual, base64.b64decode(digest_value))
    except (TypeError, ValueError):
        return False


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(user: UserRecord) -> str:
    settings = get_settings()
    header = _encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _encode(
        json.dumps(
            {
                "sub": user.id,
                "role": user.role,
                "exp": int(time.time() + timedelta(minutes=settings.access_token_minutes).total_seconds()),
            },
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    signature = _encode(hmac.new(settings.jwt_secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str) -> str | None:
    try:
        header, payload, signature = token.split(".")
        signing_input = f"{header}.{payload}".encode()
        expected = hmac.new(get_settings().jwt_secret.encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _decode(signature)):
            return None
        data = json.loads(_decode(payload))
        if int(data.get("exp", 0)) <= int(time.time()):
            return None
        return str(data["sub"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def _local_test_actor(token: str) -> Actor | None:
    user_id = decode_access_token(token)
    if not user_id:
        return None
    with Session(engine) as session:
        user = session.get(UserRecord, user_id)
        if not user:
            return None
        return Actor(id=user.id, name=user.name, email=user.email, role=user.role)


async def _supabase_actor(token: str) -> Actor | None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_publishable_key,
                },
            )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    payload = response.json()
    # Accounts cannot enter the app until the mailbox confirmation flow has
    # completed. Supabase returns this timestamp from its authenticated user API.
    if not (payload.get("email_confirmed_at") or payload.get("confirmed_at")):
        return None
    user_id = str(payload.get("id") or "")
    email = str(payload.get("email") or "").strip().lower()
    if not user_id or not email:
        return None
    with Session(engine) as session:
        user = session.get(UserRecord, user_id)
    if user:
        return Actor(id=user.id, name=user.name, email=user.email, role=user.role)
    metadata = payload.get("user_metadata") or {}
    role = str(metadata.get("account_role") or "").strip().lower()
    name = str(metadata.get("full_name") or metadata.get("name") or "").strip()
    return Actor(
        id=user_id,
        name=name,
        email=email,
        role=role,
        provisioned=False,
    )


async def actor_from_request(request: Request) -> Actor | None:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if get_settings().auth_mode == "local_test":
        return _local_test_actor(token)
    return await _supabase_actor(token)


def get_identity() -> Actor:
    actor = current_actor.get()
    if not actor:
        raise HTTPException(status_code=401, detail="A confirmed Supabase account is required")
    return actor


def provision_actor(actor: Actor) -> Actor:
    if actor.provisioned:
        return actor

    role = actor.role.strip().lower()
    if role not in {"student", "employer"}:
        raise HTTPException(status_code=422, detail="Account role is missing or invalid. Create the account again.")

    name = actor.name.strip() or actor.email.split("@", 1)[0].replace(".", " ").replace("_", " ").title()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Account name is missing. Create the account again.")

    with Session(engine) as session:
        existing = session.get(UserRecord, actor.id)
        if existing:
            return Actor(id=existing.id, name=existing.name, email=existing.email, role=existing.role)

        email_owner = find_user_by_email(session, actor.email)
        if email_owner:
            if email_owner.id == actor.id:
                return Actor(id=email_owner.id, name=email_owner.name, email=email_owner.email, role=email_owner.role)
            raise HTTPException(
                status_code=409,
                detail="This verified email is already linked to another application account.",
            )

        user = UserRecord(
            id=actor.id,
            name=name,
            email=actor.email,
            password_hash="supabase-managed",
            role=role,
        )
        session.add(user)
        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            existing = session.get(UserRecord, actor.id)
            if existing:
                return Actor(id=existing.id, name=existing.name, email=existing.email, role=existing.role)
            email_owner = find_user_by_email(session, actor.email)
            if email_owner:
                raise HTTPException(
                    status_code=409,
                    detail="This verified email is already linked to another application account.",
                ) from exc
            raise
        session.refresh(user)
        return Actor(id=user.id, name=user.name, email=user.email, role=user.role)


def get_actor(required_role: str | None = None) -> Actor:
    actor = get_identity()
    if not actor.provisioned:
        actor = provision_actor(actor)
        current_actor.set(actor)
    if required_role and actor.role != required_role:
        raise HTTPException(status_code=403, detail=f"{required_role.title()} account required")
    return actor


def user_response(user: UserRecord | Actor) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        **({"created_at": user.created_at} if isinstance(user, UserRecord) else {}),
    }


def find_user_by_email(session: Session, email: str) -> UserRecord | None:
    return session.exec(select(UserRecord).where(UserRecord.email == email.strip().lower())).first()
