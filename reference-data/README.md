# Reference data (NBA shooters)

Drop pose data here to derive scoring thresholds. Layout:

    reference-data/
      players/
        <player>/
          player.json          # { "name": "...", "shootingHand": "right" }
          clip-01/poses.json    # required; + optional labels.json to pin shots
          clip-02/poses.json
      out/                      # generated — do not edit (gitignored)

Prefer SIDE-view clips (posture/depth metrics need them) and 3+ clips per
player so the per-player spread is measurable. Then:

    npm run metrics:extract          # writes out/metrics + out/players
    npm run metrics:extract -- curry # one player

Boundaries are auto-detected; add a labels.json (same format as test-data/)
when detection misses. The validator's dropdown can point at these folders to
label them with the same tool.
