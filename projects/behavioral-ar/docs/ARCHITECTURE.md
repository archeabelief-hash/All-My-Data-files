# Architecture

## Pipeline
```
Sensors
  camera | microphone | IMU | user input
       ↓
Timestamp + synchronization
       ↓
Feature adapters
  visual | vocal | language | motion | context
       ↓
Personal baseline
       ↓
Temporal event correlator
       ↓
Multimodal fusion
       ↓
Evidence / contradiction layer
       ↓
AR presentation policy
       ↓
HUD
```

## Data layers

### L0 Raw sensor
Original sensor samples. Never silently rewritten by the inference layer.

### L1 Observations
Directly measurable features such as response latency, speech-rate delta, pitch delta, visible posture change, or transcript text.

### L2 Inferences
Probabilistic interpretations such as baseline deviation, question avoidance, or conversational pressure. An inference must list supporting observation IDs.

### L3 Evidence
Externally or internally checkable facts: transcript contradiction, prior statement, source evidence, timestamps.

### L4 Presentation
Minimal AR output. Never display LIAR/LYING as a factual determination.

## Baseline model
Baseline is person- and context-specific. Store rolling distributions rather than generic "normal human" thresholds.

For feature x:
- rolling mean μ
- rolling standard deviation σ
- robust median
- MAD
- context tags

Prototype standardized deviation:
`z = (x - μ) / max(σ, epsilon)`

Production should prefer robust estimators and calibration data.

## Fusion
Fusion should reward independent channel convergence and temporal alignment, while penalizing missing/low-quality sensors. It must not treat correlated features as independent evidence.

## Hardware abstraction
Create adapters behind the same event schema:
- Android phone
- PC webcam/mic
- simulated AR device
- future Meta Wearables adapter
- future Snap Spectacles adapter

This keeps the behavioral engine independent of the glasses vendor.

## Reality-integrity boundary
Maintain separate raw-input and rendered-output records where hardware permits. Inference overlays must never replace the raw evidentiary record.
