# Research Protocol

## Objective
Measure whether multimodal changes improve detection of **observable conversational events** such as contradiction, response delay, question avoidance, and baseline deviation.

## Do not use as ground truth
Eye direction, fidgeting, facial action, pitch, hesitation, or posture alone are not ground-truth deception labels.

## Label hierarchy
- OBSERVED: directly measured
- VERIFIED_CONFLICT: current and prior statements are logically incompatible
- POSSIBLE_AVOIDANCE: response does not resolve the asked proposition
- BASELINE_SHIFT: statistically meaningful deviation from established baseline
- UNVERIFIABLE: claim cannot currently be checked
- INSUFFICIENT_EVIDENCE: signal quality/quantity inadequate

## Evaluation
Track precision, recall, false-positive rate, calibration error, sensor quality, demographic/context robustness, and inter-rater agreement.

## Human-subject safeguards
Use informed consent for prototype data collection. Minimize retention, encrypt sensitive recordings, support deletion, and avoid covert biometric identification.
