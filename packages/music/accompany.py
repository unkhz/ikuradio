"""The Music: a bed for the voice, made by listening to it.

MusicGen (the melody model of 2023, with all its weirdness intact) is given
the Vocals of a part and the words of the Mood. It hears the voice only as
chroma, the shape of its pitches over time, and grows an accompaniment that
follows that shape in the weather the Mood describes. It never hears the
words, and the voice is not in what it returns: the bed is laid under the
voice later.

    uv run accompany.py --vocals take.m4a --mood "eternity, chamber music" \
        --seconds 30 --out bed.m4a

The model is woken for the bed and let go after it, so that the mind which
writes the words can have the GPU back.
"""

import argparse
import math
import sys
import time

import av
import numpy as np
import soundfile
import torch
from transformers import MusicgenMelodyForConditionalGeneration, MusicgenMelodyProcessor

MODEL = "facebook/musicgen-melody"
# the model was taught on half-minute pieces and hears no further than that
LONGEST = 30.0
# how long two windows of a longer bed play together, fading one into the other
OVERLAP = 3.0
# how many frames of music the model makes for each second of it
FRAMES_PER_SECOND = 50


def listen(path: str, rate: int) -> np.ndarray:
    """Reads any recording as one voice at the model's own rate."""
    resampler = av.AudioResampler(format="flt", layout="mono", rate=rate)
    chunks = []
    with av.open(path) as container:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray()[0])
        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray()[0])
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)


def keep(path: str, audio: np.ndarray, rate: int):
    """Writes the bed: as it is to a .wav, or as the song keeps its voices otherwise."""
    if path.endswith(".wav"):
        soundfile.write(path, audio, rate)
        return
    with av.open(path, "w") as container:
        stream = container.add_stream("aac", rate=rate, layout="mono")
        stream.bit_rate = 96_000
        frame = av.AudioFrame.from_ndarray(
            audio.astype(np.float32)[None, :], format="flt", layout="mono"
        )
        frame.sample_rate = rate
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


def windows(seconds: float) -> list[tuple[float, float]]:
    """Where each window of a bed begins and ends, overlapping by OVERLAP."""
    if seconds <= LONGEST:
        return [(0.0, seconds)]
    count = math.ceil((seconds - OVERLAP) / (LONGEST - OVERLAP))
    step = (seconds - OVERLAP) / count
    return [(i * step, i * step + step + OVERLAP) for i in range(count)]


def join(pieces: list[np.ndarray], rate: int, starts: list[float]) -> np.ndarray:
    """Lays the windows end to end, each fading into the next over the overlap."""
    fade = int(OVERLAP * rate)
    length = int(starts[-1] * rate) + len(pieces[-1])
    bed = np.zeros(length, dtype=np.float32)
    # equal power, so the seam is no quieter than either side of it
    rise = np.sin(np.linspace(0, np.pi / 2, fade, dtype=np.float32)) ** 2
    for i, (piece, start) in enumerate(zip(pieces, starts)):
        piece = piece.copy()
        if i > 0:
            piece[:fade] *= rise[: len(piece[:fade])]
        if i < len(pieces) - 1:
            piece[-fade:] *= rise[::-1][-len(piece[-fade:]) :]
        at = int(start * rate)
        bed[at : at + len(piece)] += piece[: length - at]
    return bed


def accompany(vocals: str, mood: str, seconds: float, out: str):
    if not torch.cuda.is_available():
        sys.exit("the Music needs a GPU, and this machine lends it none")

    woke = time.time()
    processor = MusicgenMelodyProcessor.from_pretrained(MODEL)
    model = MusicgenMelodyForConditionalGeneration.from_pretrained(
        MODEL, torch_dtype=torch.float16
    ).to("cuda")
    rate = model.config.audio_encoder.sampling_rate
    voice = listen(vocals, rate)

    began = time.time()
    pieces, starts = [], []
    # a section longer than the model can hear is grown in windows, each
    # hearing its own stretch of the voice, and joined where they overlap
    for start, end in windows(seconds):
        heard = voice[int(start * rate) : int(end * rate)]
        if len(heard) < rate:
            heard = np.zeros(rate, dtype=np.float32)
        inputs = processor(
            audio=heard,
            sampling_rate=rate,
            text=[mood],
            padding=True,
            return_tensors="pt",
        ).to("cuda")
        inputs["input_features"] = inputs["input_features"].to(torch.float16)
        with torch.inference_mode():
            grown = model.generate(
                **inputs,
                do_sample=True,
                guidance_scale=3.0,
                max_new_tokens=int((end - start) * FRAMES_PER_SECOND),
            )
        pieces.append(grown[0, 0].float().cpu().numpy())
        starts.append(start)
    made = time.time()

    audio = join(pieces, rate, starts)
    # never louder than a recording can hold
    peak = float(np.max(np.abs(audio))) or 1.0
    keep(out, audio / max(1.0, peak), rate)
    print(
        f"{out}: {len(audio) / rate:.1f}s of {mood!r} in {len(pieces)} windows,"
        f" woke in {began - woke:.1f}s, made in {made - began:.1f}s,"
        f" {torch.cuda.max_memory_allocated() / 2**30:.1f} GiB at most"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--vocals", required=True, help="the voice to accompany")
    parser.add_argument("--mood", required=True, help="the weather, in words")
    parser.add_argument("--seconds", type=float, default=LONGEST, help="as long as the section")
    parser.add_argument("--out", required=True, help="where the bed is written (.wav, or .m4a)")
    args = parser.parse_args()
    accompany(args.vocals, args.mood, args.seconds, args.out)
