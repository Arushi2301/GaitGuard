// Movement-specific guidance, keyed by movement id (see movements.ts).
// To support a new movement, add an entry here and in MOVEMENTS; the screens need no changes.

export type MovementGuide = {
  repsLabel: string; // short label for the movement card, e.g. "2–3 slow squats"
  howTo: string[]; // how to perform the movement for the recording
  recordTips: string[]; // filming tips that only apply to this movement
  depthLabel: string; // title of the per-rep list on the result screen
  kneeAngleNote: string; // what the knee angle means for this movement
  repsNote: string; // what a rep means for this movement
  assessmentTitle?: string; // only for movements that have a screening assessment
  assessmentNote?: string;
};

// Recording guidance that is true for any movement
export const generalRecordingTips = [
  'Film from the side so your knees and hips are clearly visible.',
  'Keep your whole body in the frame, head to feet.',
  'Stand 2–3 m from the camera.',
  'Use good lighting and avoid bright windows behind you.',
  'Use the back camera and hold the phone steady, or lean it against something.',
  'Recordings last 15 seconds.',
];

const REP_DETECTION_CAVEAT =
  'Rep detection is designed around squat-style movements, so rep counts for other movements are indicative.';

export const movementGuides: Record<string, MovementGuide> = {
  squat: {
    repsLabel: '2–3 slow squats',
    howTo: [
      'Stand side-on to the camera, feet about shoulder-width apart.',
      'Lower into a squat slowly, then stand back up with control.',
      'Do 2–3 slow, controlled squats during the recording.',
    ],
    recordTips: ['Place the phone at hip height.'],
    depthLabel: 'Depth per rep',
    kneeAngleNote: 'In a squat, a smaller knee angle means a deeper squat.',
    repsNote: 'Each down-and-up cycle counts as one squat rep.',
    assessmentTitle: 'Observed Squat Depth',
    assessmentNote:
      'Squat biomechanics research considers thigh position as well as joint angles. Knee angle alone cannot establish whether the thighs are parallel for every person.',
  },
  walk: {
    repsLabel: '3–4 steps across the frame',
    howTo: [
      'Walk across the frame side-on at your natural pace.',
      'Keep the phone fixed in place, 3–4 m from your path.',
    ],
    recordTips: [],
    depthLabel: 'Knee angle per rep',
    kneeAngleNote: 'In walking, the knee angle changes with every step.',
    repsNote: REP_DETECTION_CAVEAT,
  },
  'drop-jump': {
    repsLabel: '2–3 jumps',
    howTo: [
      'Face the camera with your whole body in frame, about 3 m away.',
      'Step off the box and jump straight up on landing, then repeat.',
    ],
    recordTips: ['Film from the front for this movement.'],
    depthLabel: 'Knee angle per rep',
    kneeAngleNote: 'On landing, a smaller knee angle means the knee bent further to absorb the jump.',
    repsNote: REP_DETECTION_CAVEAT,
  },
};

const defaultGuide: MovementGuide = {
  repsLabel: 'A few slow, controlled reps',
  howTo: ['Perform the movement slowly and with control.'],
  recordTips: [],
  depthLabel: 'Knee angle per rep',
  kneeAngleNote: 'A smaller knee angle means the knee bent further during the movement.',
  repsNote: REP_DETECTION_CAVEAT,
};

export const getMovementGuide = (id?: string): MovementGuide => (id && movementGuides[id]) || defaultGuide;
