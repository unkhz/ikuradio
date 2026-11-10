"""The Music: a bed for the voice, made by listening to it.

MusicGen (the melody model of 2023, with all its weirdness intact) is given
the Vocals of a part and the words of the Mood. It hears the voice only as
chroma, the shape of its pitches over time, and grows an accompaniment that
follows that shape in the weather the Mood describes. It never hears the
words, and the voice is not in what it returns: the bed is laid under the
voice later.

    uv run accompany.py --vocals take.m4a --mood "eternity, chamber music" \
        --seconds 30 --out bed.wav

The model is woken for the bed and let go after it, so that the mind which
writes the words can have the GPU back.
"""

import argparse
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


def accompany(vocals: str, mood: str, seconds: float, out: str):
    if not torch.cuda.is_available():
        sys.exit("the Music needs a GPU, and this machine lends it none")
    seconds = min(seconds, LONGEST)

    woke = time.time()
    processor = MusicgenMelodyProcessor.from_pretrained(MODEL)
    model = MusicgenMelodyForConditionalGeneration.from_pretrained(
        MODEL, torch_dtype=torch.float16
    ).to("cuda")
    rate = model.config.audio_encoder.sampling_rate

    voice = listen(vocals, rate)[: int(LONGEST * rate)]
    inputs = processor(
        audio=voice,
        sampling_rate=rate,
        text=[mood],
        padding=True,
        return_tensors="pt",
    ).to("cuda")
    inputs["input_features"] = inputs["input_features"].to(torch.float16)

    began = time.time()
    with torch.inference_mode():
        bed = model.generate(
            **inputs,
            do_sample=True,
            guidance_scale=3.0,
            max_new_tokens=int(seconds * FRAMES_PER_SECOND),
        )
    made = time.time()

    audio = bed[0, 0].float().cpu().numpy()
    # never louder than a recording can hold
    peak = float(np.max(np.abs(audio))) or 1.0
    soundfile.write(out, audio / max(1.0, peak), rate)
    print(
        f"{out}: {len(audio) / rate:.1f}s of {mood!r},"
        f" woke in {began - woke:.1f}s, made in {made - began:.1f}s,"
        f" {torch.cuda.max_memory_allocated() / 2**30:.1f} GiB at most"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--vocals", required=True, help="the voice to accompany")
    parser.add_argument("--mood", required=True, help="the weather, in words")
    parser.add_argument("--seconds", type=float, default=LONGEST)
    parser.add_argument("--out", required=True, help="where the bed is written (.wav)")
    args = parser.parse_args()
    accompany(args.vocals, args.mood, args.seconds, args.out)
