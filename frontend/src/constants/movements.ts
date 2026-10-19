export const MOVEMENTS = [
  {
    id: 'squat',
    name: 'Bodyweight Squat',
    view: 'Side view',
    icon: 'body',
    color: 'mint',
    available: true,
    reps: '2–3 slow squats',
    instruction: 'Stand side-on, full body in frame, phone at hip height, 2–3 m away.',
  },
  {
    id: 'walk',
    name: 'Walking',
    view: 'Side view',
    icon: 'walk',
    color: 'peach',
    available: false,
    reps: '3–4 steps across the frame',
    instruction: 'Walk across the frame side-on, phone fixed, 3–4 m away.',
  },
  {
    id: 'drop-jump',
    name: 'Drop Jump',
    view: 'Front view',
    icon: 'arrow-down-circle',
    color: 'lavender',
    available: false,
    reps: '2–3 jumps',
    instruction: 'Face the camera, full body in frame, 3 m away.',
  },
] as const;

export type Movement = (typeof MOVEMENTS)[number];

export const getMovement = (id?: string) => MOVEMENTS.find(m => m.id === id);