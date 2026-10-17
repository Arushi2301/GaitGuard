export const MOVEMENTS = [
  { id: 'squat', name: 'Bodyweight Squat', view: 'Side view', instruction: 'Stand side-on, full body in frame, phone at hip height, 2–3 m away.' },
  { id: 'walk', name: 'Walking', view: 'Side view', instruction: 'Walk across the frame side-on, phone fixed, 3–4 m away.' },
  { id: 'drop-jump', name: 'Drop Jump', view: 'Front view', instruction: 'Face the camera, full body in frame, 3 m away.' },
] as const;

export const getMovement = (id?: string) => MOVEMENTS.find(m => m.id === id);