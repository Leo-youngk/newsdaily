"""本地 whisper 转写，输出与 Cloudflare Workers AI 同构的 JSON。

存在的理由：Workers AI 免费额度每天只有 214 音频分钟，且实测不按 00:00 UTC
重置（见 transcribe-pipeline-pitfalls）。本机有独显时直接跑，额度无上限。

模型固定用 large-v3-turbo，与 Workers AI 侧同一个模型，保证两条路产出的
逐字稿质量一致，不会出现"哪天转的决定了读起来什么样"。

用法：python whisper_local.py --audio a.mp3 --lang zh
stdout 是纯 JSON，进度和日志一律走 stderr。
"""

import argparse
import json
import os
import sys
from pathlib import Path


def _add_cuda_dll_dirs() -> None:
    """Windows 上 ctranslate2 不会自动找到 pip 装的 cuBLAS / cuDNN。

    Linux 靠 RPATH 能找到，Windows 必须显式把 DLL 目录挂进搜索路径，
    否则加载时报 "Library cublas64_12.dll is not found" 而不是任何有用的错。
    """
    if os.name != 'nt':
        return
    base = Path(sys.prefix) / 'Lib' / 'site-packages' / 'nvidia'
    if not base.is_dir():
        return
    for sub in sorted(base.glob('*/bin')):
        try:
            os.add_dll_directory(str(sub))
        except OSError:
            pass


_add_cuda_dll_dirs()

from faster_whisper import WhisperModel  # noqa: E402

# 与 etl/src/whisper.ts 保持一致：中文不给引导词的话几乎不输出标点，
# 整集会连成一片没法读。
INITIAL_PROMPT = {
    'zh': '以下是一段普通话播客对话的文字记录，使用标准中文标点符号。'
          '比如：这个问题我们先放一放，等会儿再聊。你觉得呢？对，我同意。',
    'en': '',
}


def pick_device(requested: str) -> tuple[str, str]:
    """返回 (device, compute_type)。auto 时优先 CUDA。"""
    if requested in ('cuda', 'cpu'):
        return requested, 'float16' if requested == 'cuda' else 'int8'
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return 'cuda', 'float16'
    except Exception as e:  # noqa: BLE001
        print(f'[local] CUDA 探测失败，退回 CPU：{e}', file=sys.stderr)
    return 'cpu', 'int8'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--lang', default='zh', choices=['zh', 'en'])
    ap.add_argument('--model', default='large-v3-turbo')
    ap.add_argument('--device', default='auto', choices=['auto', 'cuda', 'cpu'])
    args = ap.parse_args()

    device, compute_type = pick_device(args.device)
    print(f'[local] device={device} compute={compute_type} model={args.model}', file=sys.stderr)

    try:
        model = WhisperModel(args.model, device=device, compute_type=compute_type)
    except Exception as e:  # noqa: BLE001
        # 4G 显存的笔记本显卡遇到别的进程占用时会 OOM，退回 CPU 也比整条失败强，
        # 但必须让上层看得见现在走的是慢路径
        if device == 'cuda':
            print(f'[local] CUDA 初始化失败，降级到 CPU（会慢很多）：{e}', file=sys.stderr)
            device, compute_type = 'cpu', 'int8'
            model = WhisperModel(args.model, device=device, compute_type=compute_type)
        else:
            raise

    segments_iter, info = model.transcribe(
        args.audio,
        language=args.lang,
        task='transcribe',
        beam_size=5,
        vad_filter=True,
        initial_prompt=INITIAL_PROMPT.get(args.lang) or None,
        # 长音频里前文条件化会让模型陷进复读机循环，播客这种一小时起步的
        # 素材必须关掉，宁可牺牲一点上下文连贯性
        condition_on_previous_text=False,
    )

    total = float(info.duration or 0)
    segments = []
    texts = []
    last_report = -30.0
    for s in segments_iter:
        txt = (s.text or '').strip()
        if not txt:
            continue
        segments.append({'start': float(s.start), 'end': float(s.end), 'text': txt})
        texts.append(txt)
        if s.start - last_report >= 30:
            last_report = s.start
            pct = (s.start / total * 100) if total else 0
            print(f'[local] {s.start / 60:.1f}/{total / 60:.1f} 分钟 ({pct:.0f}%)', file=sys.stderr)

    out = {
        'text': ('\n'.join(texts)).strip(),
        'segments': segments,
        'duration': total,
        'device': device,
    }
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
