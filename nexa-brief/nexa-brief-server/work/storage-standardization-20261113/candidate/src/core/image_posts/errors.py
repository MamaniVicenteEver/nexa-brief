"""Public application errors shared by image-only workflows."""


class ImagePostError(ValueError):
    def __init__(self, code: str, message: str | None = None, status_code: int = 422):
        super().__init__(message or code)
        self.code = code
        self.status_code = status_code
