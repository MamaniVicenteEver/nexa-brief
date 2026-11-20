"""Final JPEG preflight stays local and precedes all Meta side effects."""
from functools import lru_cache
import hashlib
from io import BytesIO
from unittest.mock import AsyncMock

from PIL import Image, ImageCms
import pytest

from src.adapters.publishing.facebook_image_adapter import FacebookImageAdapter
from src.adapters.publishing.instagram_image_adapter import InstagramImageAdapter
from src.adapters.publishing.image_publisher import (
    ImageDeliveryValidationError,
    validate_image_content,
    validate_image_delivery,
    validate_image_delivery_assets,
)


@lru_cache
def jpeg(width=1080, height=1350, *, profile=True):
    output = BytesIO()
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes() if profile else None
    Image.new("RGB", (width, height), "#151515").save(output, "JPEG", quality=92, icc_profile=icc)
    return output.getvalue()


def spec(platform="instagram", *, count=1, placement=None, metadata=None):
    return {
        "platform": platform, "account_alias": "test", "target_id": "target",
        "placement": placement or ("image" if count == 1 else "carousel"),
        "caption": "Texto con fuentes", "slides": [
            {"storage_key": f"slide-{index}.jpg", **(metadata or {})} for index in range(count)
        ],
    }


class MemoryStorage:
    def __init__(self, objects):
        self.objects = objects

    def get(self, key):
        return self.objects[key]


@pytest.mark.parametrize("platform", ["instagram", "facebook"])
@pytest.mark.parametrize("count", [1, 2, 5, 6, 8, 20])
def test_variable_carousel_count(platform, count):
    validate_image_delivery(spec(platform, count=count))


@pytest.mark.parametrize("platform", ["instagram", "facebook"])
@pytest.mark.parametrize("count,placement", [(0, "image"), (2, "image"), (1, "carousel"), (21, "carousel"), (1, "story")])
def test_rejects_invalid_count_and_unimplemented_placements(platform, count, placement):
    with pytest.raises(ImageDeliveryValidationError) as error:
        validate_image_delivery(spec(platform, count=count, placement=placement))
    assert error.value.code == "INVALID_IMAGE_COUNT"


@pytest.mark.parametrize("width,height", [(1080, 1440), (1080, 1920)])
def test_instagram_feed_rejects_tall_profiles_in_metadata(width, height):
    with pytest.raises(ImageDeliveryValidationError) as error:
        validate_image_delivery(spec(metadata={"width": width, "height": height}))
    assert error.value.code == "UNSUPPORTED_IMAGE_RATIO"


@pytest.mark.parametrize("width,height", [(1080, 1350), (1080, 1440), (1080, 1920)])
def test_facebook_accepts_all_product_profiles(width, height):
    validate_image_delivery(spec("facebook", metadata={"width": width, "height": height}))
    assert validate_image_content(jpeg(width, height), platform="facebook") == (width, height)


@pytest.mark.parametrize("width", [319, 1441])
def test_instagram_width_limits(width):
    with pytest.raises(ImageDeliveryValidationError, match="width"):
        validate_image_content(jpeg(width, width), platform="instagram")


@pytest.mark.parametrize("platform,max_bytes", [("facebook", 4_000_000), ("instagram", 8_000_000)])
def test_network_byte_limit_checked_before_decode(platform, max_bytes):
    with pytest.raises(ImageDeliveryValidationError, match="size limit"):
        validate_image_content(b"x" * (max_bytes + 1), platform=platform)


@pytest.mark.parametrize("metadata", [{"mime": "image/webp"}, {"color_profile": "Display P3"}, {"width": 1080}, {"bytes": 0}])
def test_rejects_invalid_metadata(metadata):
    with pytest.raises(ImageDeliveryValidationError):
        validate_image_delivery(spec(metadata=metadata))


def test_rejects_corrupt_non_jpeg_and_missing_profile():
    for content in (b"\xff\xd8\xfftruncated", b"not JPEG", jpeg(profile=False)):
        with pytest.raises(ImageDeliveryValidationError):
            validate_image_content(content, platform="facebook")


@pytest.mark.asyncio
async def test_asset_validation_preserves_approved_bytes_and_checks_all_hashes():
    content = jpeg()
    original_hash = hashlib.sha256(content).hexdigest()
    delivery = spec(count=2)
    storage = MemoryStorage({f"slide-{index}.jpg": content for index in range(2)})
    for asset in delivery["slides"]:
        asset["sha256"] = original_hash
    await validate_image_delivery_assets(delivery, storage)
    assert all(hashlib.sha256(item).hexdigest() == original_hash for item in storage.objects.values())
    delivery["slides"][-1]["sha256"] = "0" * 64
    with pytest.raises(ImageDeliveryValidationError, match="approved asset"):
        await validate_image_delivery_assets(delivery, storage)


@pytest.mark.asyncio
async def test_asset_validation_rejects_mixed_dimensions():
    delivery = spec("facebook", count=2)
    storage = MemoryStorage({"slide-0.jpg": jpeg(), "slide-1.jpg": jpeg(1080, 1920)})
    with pytest.raises(ImageDeliveryValidationError, match="matching dimensions"):
        await validate_image_delivery_assets(delivery, storage)


@pytest.mark.asyncio
@pytest.mark.parametrize("platform", ["instagram", "facebook"])
async def test_last_corrupt_asset_blocks_all_network_requests(platform):
    delivery = spec(platform, count=6)
    objects = {f"slide-{index}.jpg": jpeg() for index in range(6)}
    objects["slide-5.jpg"] = b"\xff\xd8\xfftruncated"
    tokens = AsyncMock()
    tokens.target_id = lambda *_: "target"

    def network_forbidden(**kwargs):
        pytest.fail("Invalid final JPEG must be rejected before opening an HTTP client")

    adapter_class = InstagramImageAdapter if platform == "instagram" else FacebookImageAdapter
    adapter = adapter_class(tokens, MemoryStorage(objects), client_factory=network_forbidden)
    outcome = await adapter.publish_image_delivery(delivery)
    assert outcome.status == "failed_permanent"
    assert outcome.last_error["code"] == "INVALID_IMAGE"
    tokens.get_valid_token.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("height", [1440, 1920])
async def test_instagram_tall_final_bytes_block_before_quota_or_upload(height):
    tokens = AsyncMock()
    adapter = InstagramImageAdapter(tokens, MemoryStorage({"slide-0.jpg": jpeg(1080, height)}))
    adapter.get_content_publishing_limit = AsyncMock()
    outcome = await adapter.publish_image_delivery(spec())
    assert outcome.status == "failed_permanent"
    assert outcome.last_error["code"] == "UNSUPPORTED_IMAGE_RATIO"
    adapter.get_content_publishing_limit.assert_not_called()
    tokens.get_valid_token.assert_not_called()
