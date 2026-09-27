"""Academy domain kernel.

The Academy flow is intentionally isolated from the legacy video pipeline. It
owns curriculum planning, lesson contracts and generation batches while using
the existing ports for AI, voice and rendering.
"""

