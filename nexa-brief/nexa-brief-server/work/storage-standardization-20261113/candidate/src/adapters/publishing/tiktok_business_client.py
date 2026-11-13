"""TikTok for Business Accounts API transport.

This client is intentionally separate from the TikTok for Developers v2 API.
It never logs request bodies, URLs or access tokens.
"""
from __future__ import annotations

from typing import Any

import httpx


BASE_URL = "https://business-api.tiktok.com/open_api/v1.3"


class TikTokBusinessError(RuntimeError):
    """An API request failed; token-bearing response bodies are not exposed."""


class TikTokBusinessClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            response = await self._client.request(method, f"{BASE_URL}{path}", **kwargs)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise TikTokBusinessError(f"TikTok Business request failed: {path}") from exc
        if not isinstance(payload, dict) or payload.get("code") != 0:
            code = payload.get("code", "unknown") if isinstance(payload, dict) else "invalid"
            detail = ""
            if path == "/business/video/publish/" and isinstance(payload, dict):
                message = str(payload.get("message") or "").lower()
                # Only report known field names. The raw message may contain a
                # signed media URL or other sensitive request data.
                fields = [name for name in ("is_brand_organic", "is_branded_content", "video_url", "business_id", "post_info", "caption") if name in message]
                if fields:
                    detail = f"; campos señalados: {', '.join(fields)}"
                if "verif" in message and ("url" in message or "domain" in message or "property" in message):
                    detail += "; TikTok indica que la URL o dominio debe verificarse"
            raise TikTokBusinessError(f"TikTok Business rejected {path} (code {code}{detail})")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise TikTokBusinessError(f"TikTok Business returned invalid data: {path}")
        return data

    async def exchange_code(self, *, app_id: str, secret: str, auth_code: str, redirect_uri: str) -> dict[str, Any]:
        return await self._request("POST", "/tt_user/oauth2/token/", json={
            "client_id": app_id, "client_secret": secret, "grant_type": "authorization_code",
            "auth_code": auth_code, "redirect_uri": redirect_uri,
        })

    async def refresh(self, *, app_id: str, secret: str, refresh_token: str) -> dict[str, Any]:
        return await self._request("POST", "/tt_user/oauth2/refresh_token/", json={
            "client_id": app_id, "client_secret": secret, "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        })

    async def publish_video(self, *, access_token: str, business_id: str, video_url: str,
                            caption: str, disable_comment: bool = False,
                            disable_duet: bool = False, disable_stitch: bool = False) -> dict[str, Any]:
        return await self._request("POST", "/business/video/publish/",
            headers={"Access-Token": access_token}, json={
                "business_id": business_id, "video_url": video_url,
                "post_info": {"caption": caption, "is_brand_organic": False,
                              "is_branded_content": False, "disable_comment": disable_comment,
                              "disable_duet": disable_duet, "disable_stitch": disable_stitch},
            })

    async def publish_status(self, *, access_token: str, business_id: str, publish_id: str) -> dict[str, Any]:
        return await self._request("GET", "/business/publish/status/",
            headers={"Access-Token": access_token},
            params={"business_id": business_id, "publish_id": publish_id})

    async def get_profile(self, *, access_token: str, business_id: str) -> dict[str, Any]:
        return await self._request("GET", "/business/get/", headers={"Access-Token": access_token},
            params={"business_id": business_id, "fields": '["username","display_name","profile_image"]'})

    async def get_account_stats(self, *, access_token: str, business_id: str) -> dict[str, Any]:
        return await self._request("GET", "/business/get/", headers={"Access-Token": access_token},
            params={"business_id": business_id, "fields": '["followers_count","total_likes","videos_count"]'})

    async def list_videos(self, *, access_token: str, business_id: str, cursor: int | None = None) -> dict[str, Any]:
        params = {"business_id": business_id, "fields": '["item_id","create_time","caption","share_url","thumbnail_url","video_views","likes","comments"]', "max_count": 20}
        if cursor is not None:
            params["cursor"] = cursor
        return await self._request("GET", "/business/video/list/", headers={"Access-Token": access_token}, params=params)
