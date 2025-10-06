#!/bin/bash
# TTS WAV rendering script
node server/cli/tts_render.mjs --text "Hello from Chango" --out ./out.wav --rate 1 --pitch 1 --sr 48000