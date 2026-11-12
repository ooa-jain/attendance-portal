"""Reference: what the face pipeline should be next time.

Not wired into app.py — this is the shape of the replacement, kept beside the
current code so the two can be compared.

What it replaces
----------------
app.py today does detection with Haar cascades and "recognition" with LBP
histograms compared by chi-square distance. Neither involves a trained model:
Haar is from 2001, LBP from 2006. The histogram encodes lighting and texture
as much as identity, which is why the 0.58 threshold had to be hand-tuned to
one office's lighting and why it drifts.

This version swaps in:

    detection    Haar cascade      ->  SCRFD        (InsightFace)
    identity     LBP histogram     ->  ArcFace      (512-d embedding)
    matching     chi-square        ->  cosine similarity
    liveness     nothing at all    ->  a real anti-spoof model

The last line is the one that matters. Today a printed photo held to the
webcam signs someone in.

    pip install insightface onnxruntime        # onnxruntime-gpu if there is a GPU

Licence: InsightFace's code is MIT, but its pretrained model packs are
released for non-commercial research use. Confirm that covers a university
deployment before shipping, or train/licence a model instead.
"""
import numpy as np

# buffalo_l = SCRFD detector + ArcFace w600k recognition head.
# Loaded once at import; it is ~300 MB of weights and must not be per-request.
_APP = None


def _model():
    global _APP
    if _APP is None:
        from insightface.app import FaceAnalysis
        _APP = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        # det_size is the detector's input, not the photo size. 640 is the
        # usual trade-off; drop to 320 if CPU time matters more than range.
        _APP.prepare(ctx_id=-1, det_size=(640, 640))
    return _APP


def extract_embedding(img_bgr):
    """One face in, one 512-float vector out. None if no face was found.

    Replaces _extract_face_embedding(). The returned vector is already
    L2-normalised by InsightFace, so cosine similarity is a dot product.
    """
    faces = _model().get(img_bgr)
    if not faces:
        return None
    # Largest face, same rule the current code uses.
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.normed_embedding.astype(np.float32)


def similarity(a, b):
    """Cosine similarity of two normalised embeddings, in [-1, 1].

    Higher is more alike — the opposite direction to the current chi-square
    distance, so any threshold comparison flips from < to >.
    """
    return float(np.dot(np.asarray(a, np.float32), np.asarray(b, np.float32)))


def verify(stored_list, live, threshold=0.38):
    """Best match across a person's enrolled photos.

    0.38 is a common starting point for ArcFace at roughly 1-in-10,000 false
    accepts. Do not ship it as given: enrol your real staff, score every pair,
    and set the threshold where genuine and impostor scores actually separate
    on your population and your lighting. That calibration is the single
    highest-value hour in the whole project.
    """
    if live is None or not stored_list:
        return 0.0, False
    best = max(similarity(s, live) for s in stored_list)
    return best, best >= threshold


# ── Liveness ─────────────────────────────────────────────────────────────
# Without this, everything above still accepts a photograph.
#
#   passive, one frame   MiniFASNet / Silent-Face-Anti-Spoofing (Apache-2.0)
#   active challenge     blink or head-turn, prompted at sign-in
#   hosted               AWS Rekognition Face Liveness, FaceTec
#
# The browser prototype in static/face-prototype.html demonstrates the passive
# kind: hold a photo on a phone to the camera and watch the identity score
# stay high while the "real" score collapses.
#
# Storage note: 512 floats is ~2 KB per photo, against ~16 KB for the current
# 16,384-float LBP histogram — and it is a better signal at an eighth of the
# size. Keep storing the embedding rather than the photograph wherever the
# retention policy allows.
