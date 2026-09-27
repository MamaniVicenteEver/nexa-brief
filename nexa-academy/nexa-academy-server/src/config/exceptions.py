class NexaBriefError(Exception):
    """Base exception for all Nexa Brief errors."""


class ConfigurationError(NexaBriefError):
    """Required configuration is missing or invalid."""


class AIGenerationError(NexaBriefError):
    """AI model failed to generate a valid response."""


class AIValidationError(NexaBriefError):
    """AI response could not be parsed or validated as JSON."""


class ImageFetchError(NexaBriefError):
    """All image sources (Unsplash, Pexels, Pixabay, CSS fallback) failed."""


class VoiceSynthesisError(NexaBriefError):
    """The TTS provider failed to synthesize speech after retries."""


class RecordingError(NexaBriefError):
    """Video recording or FFmpeg processing failed."""


class PipelineError(NexaBriefError):
    """An unrecoverable error occurred in the pipeline."""


class PackagingError(NexaBriefError):
    """Output packaging failed."""


# ── Asset Library Exceptions ──────────────────────────────────────────────────

class AssetLibraryError(NexaBriefError):
    """Base for local asset-library (data/image_library, data/music_library) errors."""


class AssetNotFoundError(AssetLibraryError):
    """The requested asset_id does not exist in the local library index."""


class AssetDownloadError(AssetLibraryError):
    """Downloading a user-provided asset URL failed."""


# ── Publisher Exceptions ──────────────────────────────────────────────────────
# These extend NexaBriefError so they are caught by the existing pipeline
# error handler and produce the same structured log events.

class PublisherError(NexaBriefError):
    """Base for all social-media publishing errors."""


class PublishingDisabledError(PublisherError):
    """Auto-publishing is disabled via ENABLE_AUTO_PUBLISHING=false."""


class TokenError(PublisherError):
    """Base for token-related failures."""


class TokenExpiredError(TokenError):
    """The access token has expired and cannot be refreshed automatically.

    The account must be re-authenticated via the OAuth manual flow.
    """


class TokenRefreshError(TokenError):
    """The refresh-token call to the platform API failed."""


class PlatformAPIError(PublisherError):
    """A social-media platform API returned an unexpected error response.

    Attributes:
        platform: 'tiktok' | 'youtube' | 'facebook'
        status_code: HTTP status code returned by the platform.
        body: Raw response body for audit purposes.
    """

    def __init__(self, message: str, platform: str = "", status_code: int = 0, body: str = "") -> None:
        super().__init__(message)
        self.platform = platform
        self.status_code = status_code
        self.body = body


class QuotaExceededError(PublisherError):
    """Daily API quota for the platform has been reached.

    Relevant for YouTube Data API v3 (10,000 units/day; 1,600 per upload).
    """


class VideoNotFoundError(PublisherError):
    """The requested video ID does not exist on the platform."""


class UnsupportedOperationError(PublisherError):
    """The platform does not support this CRUD operation.

    Example: TikTok does not allow editing title/description after publishing.
    """
